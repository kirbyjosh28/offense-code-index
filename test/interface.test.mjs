import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const server = read("scripts/server.mjs");

test("the document exposes semantic navigation, search, status, and source context", () => {
  assert.match(html, /<main>/);
  assert.match(html, /type="search"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-view="guides"/);
  assert.match(html, /aria-controls="results"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /https:\/\/www\.ilsos\.gov\/content\/dam\/departments\/police\/offense_code24\.pdf/);
});

test("responsive styles retain hidden-state, focus, touch, and motion safeguards", () => {
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("user search text is rendered through text nodes rather than HTML injection", () => {
  assert.match(app, /document\.createTextNode\(value\)/);
  assert.match(app, /mark\.textContent\s*=\s*match\[0\]/);
  assert.doesNotMatch(app, /innerHTML\s*=\s*state\.query/);
});

test("navigation and mobile filters expose keyboard and focus-management contracts", () => {
  assert.match(app, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/);
  assert.match(app, /elements\.filterTrigger\.focus\(\)/);
  assert.match(app, /setAttribute\("aria-modal", "true"\)/);
  assert.match(app, /event\.key !== "Tab"/);
  assert.match(app, /elements\.filters\.hidden = true/);
  assert.match(app, /clearTimeout\(closeFilters\.hideTimer\)/);
  assert.match(app, /elements\.filterTrigger\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(app, /!elements\.filters\.classList\.contains\("is-open"\)/);
  assert.match(app, /firstNewRow\.focus\(\)/);
});

test("search supports canonical Vehicle Code aliases and exact-match ranking", () => {
  assert.match(app, /625 ILCS 5\/\$\{offense\.code\}/);
  assert.match(app, /offenseSearchScore/);
  assert.match(app, /reports\.includes\(query\)/);
});

test("the local server rejects traversal and emits defensive response headers", () => {
  assert.match(server, /filePath\.startsWith\(`\$\{root\}\$\{path\.sep\}`\)/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
});
