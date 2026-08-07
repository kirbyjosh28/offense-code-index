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
const vercel = read("vercel.json");

test("the one-page document exposes navigation, search, all sections, and source context", () => {
  assert.match(html, /<nav class="pill-nav" aria-label="Primary navigation">/);
  assert.match(html, /href="#offenses"/);
  assert.match(html, /href="#guides"/);
  assert.match(html, /<header class="site-header">[\s\S]*class="search-dock"[\s\S]*role="search"/);
  assert.match(html, /type="search"/);
  assert.match(html, /maxlength="120"/);
  assert.match(html, /id="search-experience"/);
  assert.match(html, /id="typewriter-text"[^>]*>Search all 953 offenses/);
  assert.match(html, /class="typewriter-placeholder" aria-hidden="true"/);
  assert.match(html, /id="search-tools" role="group" aria-label="Quick filters"/);
  assert.match(html, /data-family-filter="Vehicle Code"/);
  assert.match(html, /id="quick-mandatory"[^>]*aria-pressed="false"/);
  assert.match(html, /aria-describedby="search-assist"/);
  assert.match(html, /aria-label="Common traffic stop searches"/);
  assert.match(html, /data-search-query="no rear registration light"/);
  assert.match(html, /data-search-query="expired registration"/);
  assert.match(html, /data-search-query="speeding"/);
  assert.match(html, /data-search-query="headlight out"/);
  assert.match(html, /data-search-query="taillight out"/);
  assert.doesNotMatch(html, /Start with the search above/);
  assert.doesNotMatch(html, /class="intro-copy"/);
  assert.doesNotMatch(html, /Everyday-language search · searches all categories/);
  assert.doesNotMatch(html, /class="search-capability"/);
  assert.doesNotMatch(html, /aria-describedby="search-capability"/);
  assert.match(html, /role="search"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="offenses"/);
  assert.match(html, /id="guides"/);
  assert.doesNotMatch(html, /href="#counties"|id="counties"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /Find the record, open its official source page/);
  assert.match(html, /Source-first results/);
  assert.match(html, /reference—not current law/);
  assert.match(html, /https:\/\/www\.ilsos\.gov\/content\/dam\/departments\/police\/offense_code24\.pdf/);
  assert.doesNotMatch(html, /role="tablist"/);
});

test("minimal responsive styles center the pill navigation and search accessibly", () => {
  assert.match(css, /\.site-header\s*\{[^}]*justify-content:\s*center/s);
  assert.match(css, /\.pill-nav\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.search-experience\s*\{[^}]*width:\s*min\(100%,\s*520px\)[^}]*transition:\s*width var\(--duration-expand\)/s);
  assert.match(css, /\.search-experience\.is-open,[\s\S]*\.search-experience\.has-context\s*\{[^}]*width:\s*min\(100%,\s*820px\)/s);
  assert.match(css, /\.search-shell\s*\{[^}]*width:\s*100%[^}]*margin:\s*0 auto[^}]*border-radius:\s*999px/s);
  assert.match(css, /backdrop-filter:\s*blur\(18px\) saturate\(1\.18\)/);
  assert.match(css, /input::\-webkit-search-cancel-button\s*\{[^}]*appearance:\s*none/s);
  assert.match(css, /body\s*\{[^}]*font-size:\s*16px/s);
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("motion uses cohesive tokens, targeted properties, and reduced-motion safeguards", () => {
  assert.match(css, /--ease-out:\s*cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(css, /--ease-in-out:\s*cubic-bezier\(0\.77, 0, 0\.175, 1\)/);
  assert.match(css, /@keyframes\s+surface-enter/);
  assert.match(css, /@keyframes\s+search-border-drift/);
  assert.match(css, /@keyframes\s+typewriter-caret/);
  assert.match(css, /@keyframes\s+prompt-enter/);
  assert.match(css, /\.search-prompts button:nth-of-type\(5\)\s*\{[^}]*animation-delay:\s*380ms/s);
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.search-prompts\s*\{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/);
  assert.match(css, /\.site-header\.is-scrolled \.search-shell/);
  assert.match(css, /\.motion-ready \.section-heading\.is-reveal-ready/);
  assert.match(css, /::view-transition-old\(root\)/);
  assert.doesNotMatch(css, /transition:\s*all/);
  assert.doesNotMatch(css, /\bease-in\b(?!-out)/);
});

test("the search pill responds to pointer input without moving for reduced motion", () => {
  assert.match(css, /\.site-header \.search-shell\.is-pressed\s*\{[^}]*transform:\s*scale\(0\.985\)[^}]*transition-duration:\s*160ms[^}]*transition-timing-function:\s*var\(--ease-out\)/s);
  assert.match(css, /\.site-header \.search-shell\.is-engaged\s*\{[^}]*transform:\s*scale\(1\.018\)[^}]*transition-duration:\s*var\(--duration-fast\)[^}]*transition-timing-function:\s*var\(--ease-out\)/s);
  assert.match(css, /\.search-shell\.is-engaged \.search-icon\s*\{[^}]*transform:\s*rotate\(-8deg\) scale\(1\.08\)[^}]*transition-duration:\s*var\(--duration-fast\)/s);
  assert.match(css, /\.search-shell\.is-engaged \.search-icon::before\s*\{[^}]*opacity:\s*0\.28[^}]*transform:\s*scale\(1\)[^}]*transition-duration:\s*var\(--duration-fast\)/s);
  assert.doesNotMatch(css, /\.search-icon\s*\{[^}]*opacity var\(--duration-medium\)/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.site-header \.search-shell\.is-pressed,[\s\S]*\.site-header \.search-shell\.is-engaged,[\s\S]*\.search-shell\.is-engaged \.search-icon,[\s\S]*\.search-shell\.is-engaged \.search-icon::before,[\s\S]*\{\s*transform:\s*none/s);

  assert.match(app, /addEventListener\("pointerdown", \(event\) => \{[\s\S]*event\.button !== 0 \|\| prefersReducedMotion\(\)[\s\S]*classList\.add\("is-pressed"\)/);
  assert.match(app, /window\.addEventListener\("pointerup"[\s\S]*classList\.replace\("is-pressed", "is-engaged"\)/);
  assert.match(app, /window\.addEventListener\("pointercancel"[\s\S]*classList\.remove\("is-pressed"\)/);
  assert.match(app, /searchShell\.addEventListener\("click", \(event\)[\s\S]*event\.target\.closest\("button"\)[\s\S]*elements\.search\.focus\(\)/);
  assert.match(app, /searchShell\.addEventListener\("focusout"[\s\S]*requestAnimationFrame[\s\S]*contains\(document\.activeElement\)[\s\S]*classList\.remove\("is-pressed", "is-engaged"\)/);
  assert.match(app, /searchExperience\.addEventListener\("focusin"[\s\S]*setSearchExperienceOpen\(true\)/);
  assert.match(app, /searchTools\.inert\s*=\s*!open/);
});

test("typewriter suggestions are decorative, pausable, and motion-safe", () => {
  assert.match(app, /const TYPEWRITER_SUGGESTIONS = \[/);
  assert.match(app, /document\.hidden \|\| elements\.search\.value/);
  assert.match(app, /document\.addEventListener\("visibilitychange", sync\)/);
  assert.match(app, /if \(prefersReducedMotion\(\)\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.typewriter-placeholder i/);
});

test("all offenses and guides render without pagination or a county section", () => {
  assert.match(app, /state\.data\.offenses[\s\S]*\.map\(\(offense, index\)/);
  assert.match(app, /guides\.forEach/);
  assert.doesNotMatch(app, /countyList|createCountyRow|state\.data\.counties\.forEach/);
  assert.doesNotMatch(app, /PAGE_SIZE|load-more|\.slice\(0,\s*state/);
});

test("every offense record links to its exact page in the official source", () => {
  assert.match(app, /sourceLink\.href = `\$\{SOURCE_PDF\}#page=\$\{offense\.page\}`/);
  assert.match(app, /sourceLink\.target = "_blank"/);
  assert.match(app, /sourceLink\.rel = "noopener noreferrer"/);
  assert.match(app, /sourceLink\.className = "source-proof"/);
  assert.match(app, /sourceLabel\.textContent = "Official source"/);
  assert.match(app, /sourceAction\.textContent = "Open exact page ↗"/);
  assert.match(app, /PDF page \$\{offense\.page\} for ILCS section \$\{displayCode\}/);
  assert.match(app, /ILCS section \$\{displayCode\} in a new tab/);
  assert.match(css, /\.source-proof\s*\{[^}]*min-height:\s*44px/s);
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
  assert.match(app, /elements\.searchPrompts\.forEach/);
  assert.match(app, /prompt\.dataset\.searchQuery/);
  assert.match(app, /const clearBrowseFilters = \(\) =>/);
  assert.match(app, /if \(state\.query\) clearBrowseFilters\(\)/);
  assert.match(app, /quickFamilyFilters\.forEach/);
  assert.match(app, /quickMandatory\.addEventListener\("click"/);
  assert.match(app, /familyFilter\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /document\.getElementById\(window\.location\.hash\.slice\(1\)\)/);
  assert.doesNotMatch(app, /document\.querySelector\(window\.location\.hash\)/);
});

test("motion setup is passive, progressive, and does not animate result rendering", () => {
  assert.match(app, /window\.scrollY > 24/);
  assert.match(app, /\{ passive: true \}/);
  assert.match(app, /new IntersectionObserver/);
  assert.match(app, /threshold:\s*0\.12/);
  assert.match(app, /document\.startViewTransition/);
  assert.match(app, /prefersReducedMotion\(\)/);
  const renderBody = app.slice(app.indexOf("const renderOffenses"), app.indexOf("const resetFilters"));
  assert.doesNotMatch(renderBody, /animate|transition|requestAnimationFrame/);
});

test("the production bundle includes the fuzzy-search module", () => {
  assert.match(build, /src", "search\.js"/);
  assert.match(build, /client, "src", "search\.js"/);
  assert.match(build, /client, "index\.html"/);
});

test("Vercel serves the static client with the same defensive policy", () => {
  const config = JSON.parse(vercel);
  assert.equal(config.installCommand, "npm install --ignore-scripts");
  assert.equal(config.buildCommand, "npm run build");
  assert.equal(config.devCommand, "npm run dev");
  assert.equal(config.outputDirectory, "dist/client");
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
  assert.match(headers["Content-Security-Policy"], /default-src 'self'/);
  assert.equal(headers["Permissions-Policy"], "camera=(), geolocation=(), microphone=()");
  assert.equal(headers["X-Frame-Options"], "DENY");
});

test("the local server rejects traversal and emits defensive response headers", () => {
  assert.match(server, /filePath\.startsWith\(`\$\{root\}\$\{path\.sep\}`\)/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
});
