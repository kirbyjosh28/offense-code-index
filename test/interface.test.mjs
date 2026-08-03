import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const build = read("scripts/build-sites.mjs");
const server = read("scripts/server.mjs");

test("the one-page document exposes navigation, search, all sections, and source context", () => {
  assert.match(html, /<nav class="pill-nav" aria-label="Primary navigation">/);
  assert.match(html, /href="#offenses"/);
  assert.match(html, /href="#counties"/);
  assert.match(html, /href="#guides"/);
  assert.match(html, /type="search"/);
  assert.match(html, /maxlength="120"/);
  assert.match(html, /role="search"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="offenses"/);
  assert.match(html, /id="counties"/);
  assert.match(html, /id="guides"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /2024 reference only/);
  assert.match(html, /https:\/\/www\.ilsos\.gov\/content\/dam\/departments\/police\/offense_code24\.pdf/);
  assert.doesNotMatch(html, /role="tablist"/);
});

test("minimal responsive styles center the pill navigation and search accessibly", () => {
  assert.match(css, /\.site-header\s*\{[^}]*justify-content:\s*center/s);
  assert.match(css, /\.pill-nav\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.search-shell\s*\{[^}]*width:\s*min\(100%,\s*740px\)[^}]*margin:\s*1\.1rem auto 0[^}]*border-radius:\s*999px/s);
  assert.match(css, /body\s*\{[^}]*font-size:\s*16px/s);
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("all records and reference sections render without pagination", () => {
  assert.match(app, /state\.data\.offenses[\s\S]*\.map\(\(offense, index\)/);
  assert.match(app, /state\.data\.counties\.forEach/);
  assert.match(app, /guides\.forEach/);
  assert.doesNotMatch(app, /PAGE_SIZE|load-more|\.slice\(0,\s*state/);
});

test("user search text is rendered through text nodes rather than HTML injection", () => {
  assert.match(app, /document\.createTextNode\(text\)/);
  assert.match(app, /mark\.textContent\s*=\s*match\[0\]/);
  assert.doesNotMatch(app, /innerHTML\s*=/);
});

test("search and filters preserve useful keyboard and URL contracts", () => {
  assert.match(app, /event\.key === "\/"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /url\.searchParams\.set\("q", state\.query\)/);
  assert.match(app, /url\.searchParams\.set\("family", state\.family\)/);
  assert.match(app, /url\.searchParams\.set\("chapter", state\.chapter\)/);
  assert.match(app, /url\.hash = offense\.id/);
  assert.match(app, /document\.getElementById\(window\.location\.hash\.slice\(1\)\)/);
  assert.doesNotMatch(app, /document\.querySelector\(window\.location\.hash\)/);
});

test("the production bundle includes the fuzzy-search module", () => {
  assert.match(build, /src", "search\.js"/);
  assert.match(build, /client, "src", "search\.js"/);
});

test("the local server rejects traversal and emits defensive response headers", () => {
  assert.match(server, /filePath\.startsWith\(`\$\{root\}\$\{path\.sep\}`\)/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
});
