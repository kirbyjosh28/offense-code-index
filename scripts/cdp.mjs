/**
 * Minimal Chrome DevTools Protocol client.
 *
 * The project ships no runtime or build dependencies on purpose — the threat
 * model (compliance/threat-model.md) advertises that, and the SBOM is generated
 * by enumerating package-lock.json. So layout verification drives the
 * preinstalled Chromium directly over CDP using Node's built-in WebSocket
 * rather than adding a browser-automation package.
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  path.join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers", "chromium");

const DEVTOOLS_PATTERN = /DevTools listening on (ws:\/\/\S+)/;

/** Resolves once Chromium prints its DevTools endpoint, or rejects on exit. */
const waitForEndpoint = (child, timeoutMs) =>
  new Promise((resolve, reject) => {
    let buffered = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Chromium did not report a DevTools endpoint in ${timeoutMs}ms`));
    }, timeoutMs);

    const onData = (chunk) => {
      buffered += chunk;
      const match = buffered.match(DEVTOOLS_PATTERN);
      if (!match) return;
      cleanup();
      resolve(match[1]);
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`Chromium exited early (code ${code}):\n${buffered}`));
    };
    function cleanup() {
      clearTimeout(timer);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
    }

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", onData);
    child.on("exit", onExit);
  });

class CdpSession {
  #socket;
  #sessionId;
  #nextId;
  #pending;
  #listeners;

  constructor(socket, sessionId, counter) {
    this.#socket = socket;
    this.#sessionId = sessionId;
    this.#nextId = counter;
    this.#pending = new Map();
    this.#listeners = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined && this.#pending.has(message.id)) {
        const { resolve, reject } = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        if (message.error) reject(new Error(`${message.method ?? "CDP"}: ${message.error.message}`));
        else resolve(message.result);
        return;
      }
      if (message.method && this.#listeners.has(message.method)) {
        for (const listener of this.#listeners.get(message.method)) listener(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.#nextId();
    const payload = { id, method, params };
    if (this.#sessionId) payload.sessionId = this.#sessionId;
    this.#socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        this.#listeners.get(method).delete(listener);
        resolve(params);
      };
      if (!this.#listeners.has(method)) this.#listeners.set(method, new Set());
      this.#listeners.get(method).add(listener);
    });
  }

  /** Evaluates an expression in the page and returns its value by value. */
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? "Evaluation failed");
    }
    return result.result.value;
  }

  /** Applies a mobile viewport and waits for the page to settle at that size. */
  async setViewport({ width, height }) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await this.evaluate(
      "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    );
  }

  /**
   * Polls an in-page predicate until it is truthy. The client renders its rows
   * from an async module import, so frame counting is not a reliable substitute.
   */
  async waitFor(expression, { timeoutMs = 10_000, intervalMs = 50 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await this.evaluate(`Boolean(${expression})`)) return;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${expression}`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  async goto(url) {
    const loaded = this.once("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loaded;
    // Rows arrive after the module import resolves; wait for the list, not a frame.
    await this.waitFor(`document.querySelector(".offense-row")`);
    await this.evaluate(
      "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    );
  }
}

/**
 * Launches headless Chromium and attaches to a fresh page target.
 * Returns the session plus a close() that tears down browser and profile.
 */
export const launchBrowser = async ({ timeoutMs = 30_000 } = {}) => {
  const profile = await mkdtemp(path.join(tmpdir(), "offense-index-cdp-"));
  const child = spawn(
    CHROMIUM,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  let endpoint;
  try {
    endpoint = await waitForEndpoint(child, timeoutMs);
  } catch (error) {
    child.kill("SIGKILL");
    await rm(profile, { recursive: true, force: true });
    throw error;
  }

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP socket failed")), { once: true });
  });

  let id = 0;
  const counter = () => (id += 1);
  const browser = new CdpSession(socket, null, counter);
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });

  const page = new CdpSession(socket, sessionId, counter);
  await page.send("Page.enable");
  await page.send("Runtime.enable");

  return {
    page,
    close: async () => {
      try {
        socket.close();
      } catch {
        /* the browser is going away regardless */
      }
      child.kill("SIGKILL");
      await new Promise((resolve) => child.once("exit", resolve));
      await rm(profile, { recursive: true, force: true });
    },
  };
};

/**
 * Starts scripts/server.mjs on an ephemeral port and resolves its base URL.
 * `root` selects which checkout to serve, so a caller can stand up a second
 * copy of the site (a worktree at an older commit, say) for comparison.
 */
export const startServer = async ({ timeoutMs = 20_000, root: rootOverride } = {}) => {
  const root =
    rootOverride ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const port = 4200 + (process.pid % 400);
  const child = spawn(process.execPath, [path.join(root, "scripts", "server.mjs")], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (!chunk.includes("http://")) return;
      clearTimeout(timer);
      resolve();
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (code ${code})`));
    });
  });

  return {
    origin: `http://127.0.0.1:${port}`,
    close: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
};
