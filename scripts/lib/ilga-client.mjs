import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Polite, cached HTTP client for ILGA fulltext pages.
 *
 * ILGA is a public service run for the people of Illinois, not an API. This client is
 * deliberately slow: one request at a time, a real delay between them, conditional
 * requests when we already hold a copy, and an identifying User-Agent. A full sweep of
 * the ~709 sections behind the corpus takes roughly 18 minutes, which is fine for
 * something that runs weekly and never during a build.
 */

export const USER_AGENT =
  "illinois-offense-code-index/1.0 (statutory reference verification; contact via repository issues)";

/**
 * Candidate URL templates, most-preferred first.
 *
 * ILGA has moved this path before, so the working template is discovered by
 * scripts/ilga-probe.mjs and pinned into config/enrichment-version.json rather than
 * hardcoded at the call site.
 */
export const URL_TEMPLATES = [
  "https://www.ilga.gov/legislation/ilcs/fulltext?DocName={docName}",
  "https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName={docName}",
];

export const buildUrl = (template, docName) => template.replace("{docName}", docName);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch one document with a timeout and bounded retries.
 *
 * Retries cover transport failures and 5xx only. A 4xx is an answer, not an outage, and
 * ILGA's "document not available" notice arrives as a 200 and is handled by the caller
 * via extractStatutoryText.
 */
export const fetchDocument = async (
  url,
  { etag = null, lastModified = null, timeoutMs = 20_000, retries = 2, retryDelayMs = 4_000 } = {}
) => {
  const headers = { "user-agent": USER_AGENT, accept: "text/html" };
  if (etag) headers["if-none-match"] = etag;
  if (lastModified) headers["if-modified-since"] = lastModified;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
      clearTimeout(timer);

      if (response.status === 304) {
        return { status: 304, notModified: true, html: null, etag, lastModified, url };
      }
      if (response.status >= 500 && attempt < retries) {
        lastError = new Error(`Upstream ${response.status}`);
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return {
        status: response.status,
        notModified: false,
        html: await response.text(),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        url: response.url || url,
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) await sleep(retryDelayMs * (attempt + 1));
    }
  }

  return { status: 0, notModified: false, html: null, error: String(lastError), url };
};

/**
 * On-disk cache of fetched pages, keyed by DocName.
 *
 * The cache is gitignored working state, not a build input, so a fresh clone simply
 * re-fetches. Its purpose is to make re-runs free and to keep load off ILGA while the
 * pipeline is being iterated on.
 */
export const createCache = (directory) => {
  const indexPath = path.join(directory, "index.json");
  let index = null;

  const load = async () => {
    if (index) return index;
    try {
      index = JSON.parse(await readFile(indexPath, "utf8"));
    } catch {
      index = { schemaVersion: 1, entries: {} };
    }
    return index;
  };

  return {
    async get(docName) {
      const current = await load();
      const entry = current.entries[docName];
      if (!entry) return null;
      try {
        return { ...entry, html: await readFile(path.join(directory, entry.file), "utf8") };
      } catch {
        return null;
      }
    },

    async set(docName, { html, etag, lastModified, url, status }) {
      const current = await load();
      const file = `${docName}.html`;
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, file), html);
      current.entries[docName] = {
        file,
        url,
        status,
        etag: etag ?? null,
        lastModified: lastModified ?? null,
        sha256: createHash("sha256").update(html, "utf8").digest("hex"),
        fetchedAt: new Date().toISOString(),
      };
      return current.entries[docName];
    },

    async touch(docName) {
      const current = await load();
      if (current.entries[docName]) current.entries[docName].fetchedAt = new Date().toISOString();
    },

    async save() {
      const current = await load();
      await mkdir(directory, { recursive: true });
      await writeFile(indexPath, `${JSON.stringify(current, null, 2)}\n`);
    },
  };
};

/** Serial rate limiter. Guarantees at least `delayMs` between the start of each request. */
export const createPacer = (delayMs) => {
  let previous = 0;
  return async () => {
    const wait = previous + delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    previous = Date.now();
  };
};
