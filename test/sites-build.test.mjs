import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mimeFor = (pathname) => {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
};

const render = async (pathname = "/", method = "GET") => {
  const workerUrl = pathToFileURL(path.join(root, "dist", "server", "index.js"));
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://example.test${pathname}`, { method }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          try {
            const body = await readFile(path.join(root, "dist", "client", url.pathname));
            return new Response(body, { headers: { "Content-Type": mimeFor(url.pathname) } });
          } catch {
            return new Response("Not found", { status: 404 });
          }
        },
      },
    }
  );
};

test("the Sites worker serves the finished index and its defensive headers", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(await response.text(), /Illinois Offense Code Index/);
});

test("the Sites bundle contains the complete structured dataset", async () => {
  const response = await render("/src/data/offense-codes.json");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.offenses.length, 953);
  assert.equal(data.counties.length, 103);
});

test("the Sites worker rejects mutating HTTP methods", async () => {
  const response = await render("/", "POST");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});
