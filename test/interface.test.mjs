import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const freshness = read("src/freshness.js");
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
  assert.match(html, /class="search-shell" role="search" aria-busy="true"/);
  assert.match(html, /maxlength="120"[\s\S]*disabled/);
  assert.match(html, /id="search-experience"/);
  assert.match(html, /placeholder="Search offense or code\."/);
  assert.match(html, /<meta name="app-build" content="dev" \/>/);
  assert.doesNotMatch(html, /typewriter/i);
  assert.match(html, /id="search-tools" role="region" aria-label="Search suggestions and filters"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /id="command-results" role="listbox"/);
  assert.match(html, /id="search-match-count" aria-hidden="true" hidden/);
  assert.match(html, /class="quick-filter-row"/);
  assert.match(html, /data-family-filter="Vehicle Code"/);
  assert.match(html, /id="quick-mandatory"[^>]*aria-pressed="false"/);
  assert.match(html, /aria-describedby="search-assist search-safety-instructions"/);
  assert.match(html, /aria-controls="command-results"/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-keyshortcuts="\/"/);
  assert.match(html, /id="common-stops-label">Common stops/);
  assert.match(html, /class="search-prompts" role="group" aria-labelledby="common-stops-label"/);
  assert.match(html, /data-search-query="no rear registration light"/);
  assert.match(html, /data-search-query="expired registration"/);
  assert.match(html, /data-search-query="speeding over limit"/);
  assert.match(html, /data-search-query="headlights"/);
  assert.match(html, /data-search-query="taillights"/);
  assert.match(html, /data-search-query="no insurance"/);
  const searchToolsPosition = html.indexOf('id="search-tools"');
  const searchPromptsPosition = html.indexOf('class="search-prompts"');
  const introPosition = html.indexOf('class="intro"');
  assert.ok(searchToolsPosition >= 0 && searchPromptsPosition > searchToolsPosition);
  assert.ok(searchPromptsPosition < introPosition, "common-stop suggestions belong in the floating search panel");
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
  assert.match(html, /href="#main-content"/);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
  assert.match(html, /id="browse-filter-toggle"[^>]*aria-controls="filter-bar"/);
  assert.match(html, /<fieldset class="filter-bar" id="filter-bar" hidden>[\s\S]*<legend class="sr-only">Filter offenses<\/legend>/);
  assert.match(html, /Locate a possible source match, open its exact page/);
  assert.match(html, /class="source-status" role="note" aria-labelledby="source-status-title"/);
  assert.match(html, /Source: official SOS Police publication/);
  assert.match(html, /not affiliated with or endorsed by Illinois or any government agency/);
  assert.match(html, /Historical reporting reference only—not current law or legal advice/);
  assert.match(html, /id="source-review-status">Content review due · Approval dates pending/);
  assert.match(html, /class="search-boundary" role="note"/);
  assert.match(html, /id="search-safety-instructions"/);
  assert.match(html, /Do not enter names, plates, license numbers, case details, narratives, personal information, or CJI/);
  assert.match(html, /Open source PDF/);
  assert.doesNotMatch(html, /class="notice"|Source-first results/);
  assert.match(html, /id="result-summary" tabindex="-1"/);
  assert.match(html, /Share results/);
  assert.match(html, /class="empty-suggestions" role="group" aria-label="Suggested searches"/);
  assert.match(html, /class="update-prompt" id="update-prompt" aria-labelledby="update-title" hidden/);
  assert.match(html, /id="update-title">New version ready/);
  assert.match(html, /id="update-later"[^>]*>Later/);
  assert.match(html, /id="update-refresh"[^>]*>Refresh/);
  assert.match(html, /id="update-announcement" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /https:\/\/www\.ilsos\.gov\/content\/dam\/departments\/police\/offense_code24\.pdf/);
  assert.doesNotMatch(html, /role="tablist"/);
});

test("minimal responsive styles center the pill navigation and search accessibly", () => {
  assert.match(css, /--page-gutter:\s*16px/);
  assert.match(
    css,
    /padding-inline:\s*var\(--page-gutter\)|padding-right:\s*var\(--page-gutter\)[^}]*padding-left:\s*var\(--page-gutter\)/s
  );
  assert.match(css, /@media\s*\(min-width:\s*640px\)[\s\S]*--page-gutter:\s*32px/s);
  assert.match(css, /@media\s*\(min-width:\s*980px\)[\s\S]*--page-gutter:\s*48px/s);
  assert.match(css, /--header-height:\s*120px/);
  assert.match(css, /--text-faint:\s*#6d6b63/, "light faint text must clear 4.5:1 on the page background");
  assert.match(css, /\.site-header\s*\{[^}]*height:\s*var\(--header-height\)[^}]*grid-template-rows:\s*48px 56px[^}]*justify-items:\s*center[^}]*gap:\s*var\(--space-2\)/s);
  assert.match(css, /\.pill-nav\s*\{[^}]*height:\s*48px[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.search-dock\s*\{[^}]*height:\s*56px/s);
  assert.match(css, /\.search-experience\s*\{[^}]*width:\s*min\(100%,\s*680px\)[^}]*height:\s*56px[^}]*transition:\s*width var\(--duration-medium\)/s);
  assert.match(css, /\.search-experience\.is-open\s*\{[^}]*width:\s*min\(100%,\s*760px\)/s);
  assert.match(css, /\.search-shell\s*\{[^}]*width:\s*100%[^}]*margin:\s*0 auto[^}]*border-radius:\s*var\(--radius-pill\)/s);
  assert.match(css, /\.search-shell\s*\{[^}]*min-height:\s*56px/s);
  assert.match(css, /\.search-experience\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.search-tools\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /backdrop-filter:\s*blur\(18px\) saturate\(1\.1[28]\)/);
  assert.match(css, /input::\-webkit-search-cancel-button\s*\{[^}]*appearance:\s*none/s);
  assert.match(css, /body\s*\{[^}]*font-size:\s*16px/s);
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.pill-nav a,[\s\S]*\.pill-nav button\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  assert.match(css, /\.quick-filter,[\s\S]*\.more-filters\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.search-tools-footer \.shortcut-toggle\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.clear-recents\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.source-status-action\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.empty-suggestions button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.text-button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.row-action\s*\{[^}]*min-width:\s*52px[^}]*min-height:\s*44px/s);
  assert.match(css, /\.update-prompt button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.filter-bar select,[\s\S]*\.reset-filters\s*\{[^}]*min-height:\s*48px/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("motion uses cohesive tokens, targeted properties, and reduced-motion safeguards", () => {
  assert.match(css, /--ease-out:\s*cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(css, /--ease-in-out:\s*cubic-bezier\(0\.77, 0, 0\.175, 1\)/);
  assert.match(css, /@keyframes\s+surface-enter/);
  assert.match(css, /\.search-tools\s*\{[^}]*transition:[^}]*200ms/s);
  assert.match(css, /\.search-prompts,\s*\.quick-filter-row\s*\{[^}]*overflow-x:\s*auto[^}]*scroll-snap-type:\s*inline proximity/s);
  assert.match(css, /\.search-prompts,\s*\.quick-filter-row\s*\{[^}]*(?:-webkit-)?mask-image:\s*linear-gradient/s);
  assert.match(css, /\.search-prompts\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/s);
  assert.match(css, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/);
  assert.match(css, /\.site-header\.is-scrolled \.pill-nav/);
  assert.doesNotMatch(css, /\.site-header\.is-scrolled \.pill-nav\s*\{[^}]*(?:opacity|scale\()/s);
  assert.match(css, /\.motion-ready \.section-heading\.is-reveal-ready/);
  assert.match(css, /::view-transition-old\(root\)/);
  assert.doesNotMatch(css, /search-border-drift|typewriter-caret/);
  assert.doesNotMatch(css, /\.search-shell:focus-within\s*\{[^}]*animation:/s);
  assert.doesNotMatch(css, /animation:[^;]*infinite/);
  assert.doesNotMatch(css, /transition:\s*all/);
  assert.doesNotMatch(css, /\bease-in\b(?!-out)/);
});

test("the search pill responds to pointer input without moving for reduced motion", () => {
  assert.match(css, /\.site-header \.search-shell\.is-pressed\s*\{[^}]*transform:\s*scale\(0\.99\)/s);
  assert.match(css, /\.site-header \.search-shell\.is-engaged\s*\{[^}]*transform:\s*scale\(1\.006\)/s);
  assert.match(css, /\.search-shell\.is-engaged \.search-icon\s*\{[^}]*transform:\s*rotate\(-5deg\) scale\(1\.04\)/s);
  assert.match(css, /\.search-shell\.is-engaged \.search-icon::before\s*\{[^}]*opacity:\s*0\.24[^}]*transform:\s*scale\(1\)/s);
  assert.doesNotMatch(css, /\.search-icon\s*\{[^}]*opacity var\(--duration-medium\)/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.site-header \.search-shell\.is-pressed,[\s\S]*\.site-header \.search-shell\.is-engaged,[\s\S]*\.search-shell\.is-engaged \.search-icon,[\s\S]*\.search-shell\.is-engaged \.search-icon::before,[\s\S]*\{\s*transform:\s*none/s);

  assert.match(app, /addEventListener\("pointerdown", \(event\) => \{[\s\S]*event\.button !== 0 \|\| prefersReducedMotion\(\)[\s\S]*classList\.add\("is-pressed"\)/);
  assert.match(app, /window\.addEventListener\("pointerup"[\s\S]*classList\.replace\("is-pressed", "is-engaged"\)/);
  assert.match(app, /window\.addEventListener\("pointercancel"[\s\S]*classList\.remove\("is-pressed"\)/);
  assert.match(app, /searchShell\.addEventListener\("click", \(event\)[\s\S]*event\.target\.closest\("button"\)[\s\S]*elements\.search\.focus\(\)/);
  assert.match(app, /searchShell\.addEventListener\("focusout"[\s\S]*requestAnimationFrame[\s\S]*contains\(document\.activeElement\)[\s\S]*classList\.remove\("is-pressed", "is-engaged"\)/);
  assert.match(app, /searchExperience\.addEventListener\("focusin"[\s\S]*setSearchExperienceOpen\(true\)/);
  assert.match(app, /search\.addEventListener\("click", \(\) => setSearchExperienceOpen\(true\)\)/);
  assert.match(app, /searchExperience\.addEventListener\("focusout"[\s\S]*requestAnimationFrame[\s\S]*contains\(document\.activeElement\)[\s\S]*setSearchExperienceOpen\(false\)/);
  assert.match(app, /searchTools\.inert\s*=\s*!open/);
  assert.match(app, /search\.setAttribute\([\s\S]*"aria-expanded",[\s\S]*String\(open && Boolean\(normalizeText\(state\.query\)\)\)[\s\S]*\)/);
  assert.match(app, /if \(!open\)\s*\{\s*elements\.search\.removeAttribute\("aria-activedescendant"\)/s);
  const experienceFocusout = app.slice(
    app.indexOf('elements.searchExperience.addEventListener("focusout"'),
    app.indexOf('elements.search.addEventListener("input"')
  );
  assert.doesNotMatch(experienceFocusout, /state\.(?:query|family|chapter|mandatoryOnly)\s*=/);
});

test("search guidance is concise and free of ambient animation", () => {
  assert.doesNotMatch(app, /TYPEWRITER|typewriter/i);
  assert.match(app, /document\.addEventListener\("visibilitychange", checkWhenVisible\)/);
  assert.match(app, /document\.visibilityState === "visible"/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.search-tools[\s\S]*transition-duration:\s*0\.01ms/s);
});

test("deployment freshness is isolated, optional, and non-disruptive", () => {
  assert.match(app, /createFreshnessMonitor/);
  assert.match(app, /fetchBuildVersion/);
  assert.match(app, /const setupFreshness = \(\) =>/);
  assert.match(app, /if \(!isBuildId\(currentBuild\)\) return/);
  assert.match(app, /window\.addEventListener\("pageshow", checkForUpdate\)/);
  assert.match(app, /window\.addEventListener\("focus", checkForUpdate\)/);
  assert.match(app, /sessionStorage\.setItem\(UPDATE_SUPPRESSION_KEY, build\)/);
  assert.match(app, /window\.location\.reload\(\)/);
  assert.match(freshness, /throttleMs = 60_000/);
  assert.match(freshness, /timeoutMs = 3000/);
  assert.match(freshness, /cache: "no-store"/);
  assert.match(css, /html\.update-ready \.toast\s*\{[^}]*bottom:/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.update-prompt[\s\S]*transition-duration:\s*0\.01ms/s);
});

test("the slash shortcut is discoverable, optional, and does not intercept editing", () => {
  assert.match(html, /id="shortcut-toggle"[^>]*aria-pressed="true"/);
  assert.match(app, /const SHORTCUT_STORAGE_KEY = "offense-index-slash-shortcut"/);
  assert.match(app, /localStorage\.getItem\(SHORTCUT_STORAGE_KEY\) !== "off"/);
  assert.match(app, /shortcutToggle\.addEventListener\("click"/);
  assert.match(app, /search\.setAttribute\("aria-keyshortcuts", "\/"\)/);
  assert.match(app, /search\.removeAttribute\("aria-keyshortcuts"\)/);
  assert.match(app, /target\.matches\("input, textarea, select"\) \|\| target\.isContentEditable/);
  assert.match(app, /!event\.altKey[\s\S]*!event\.ctrlKey[\s\S]*!event\.metaKey[\s\S]*!isEditableTarget/);
});

test("all offenses and guides render without pagination or a county section", () => {
  assert.match(app, /createSearchIndex\(state\.data\.offenses\)/);
  assert.match(app, /elements\.search\.disabled = false/);
  assert.match(app, /elements\.searchShell\.setAttribute\("aria-busy", "false"\)/);
  assert.match(app, /state\.searchResult\.matches\.map\(\(\{ offense \}\) => offense\)/);
  assert.match(app, /guides\.forEach/);
  assert.doesNotMatch(app, /countyList|createCountyRow|state\.data\.counties\.forEach/);
  assert.doesNotMatch(app, /PAGE_SIZE|load-more|\.slice\(0,\s*state/);
  assert.doesNotMatch(css, /content-visibility/, "deep links must not drift as offense rows are laid out");
});

test("every offense record links to its exact source page with verification context", () => {
  assert.match(app, /sourceLink\.href = `\$\{SOURCE_PDF\}#page=\$\{offense\.page\}`/);
  assert.match(app, /sourceLink\.target = "_blank"/);
  assert.match(app, /sourceLink\.rel = "noopener noreferrer"/);
  assert.match(app, /sourceLink\.className = "source-proof"/);
  assert.match(app, /sourceLabel\.textContent = "Source publication"/);
  assert.match(app, /sourceDetail\.textContent = `February 2024 · PDF page \$\{offense\.page\}`/);
  assert.match(app, /sourceAction\.textContent = "Open ↗"/);
  assert.match(app, /PDF page \$\{offense\.page\} for ILCS section \$\{displayCode\}/);
  assert.match(app, /ILCS section \$\{displayCode\} in a new tab/);
  assert.match(app, /Possible source match · Independent reference/);
  assert.match(app, /Verify current ILCS and agency policy/);
  assert.match(app, /correctionLink\.href = "\/trust\/corrections\.html"/);
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
  assert.match(app, /serializeShareState/);
  assert.match(app, /parseShareFragment/);
  assert.match(app, /readLegacyShareState/);
  assert.match(app, /url\.search = ""/);
  assert.doesNotMatch(app, /url\.searchParams\.set\("q"/);
  assert.match(app, /url\.hash = encodeURIComponent\(offense\.id\)/);
  assert.match(app, /elements\.searchPrompts\.forEach/);
  assert.match(app, /prompt\.dataset\.searchQuery/);
  assert.match(app, /const activateSuggestedSearch = \(query\) =>/);
  assert.match(app, /activateSuggestedSearch\(prompt\.dataset\.searchQuery\)/);
  assert.match(app, /setSearchExperienceOpen\(false\)/);
  assert.match(app, /offensesSection\.scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(app, /resultSummary\.focus\(\{ preventScroll: true \}\)/);
  const suggestedSearchFrame = app.slice(
    app.indexOf("window.requestAnimationFrame(() => {", app.indexOf("const activateSuggestedSearch")),
    app.indexOf("const buildFilters")
  );
  assert.ok(
    suggestedSearchFrame.indexOf('resultSummary.focus({ preventScroll: true })') <
      suggestedSearchFrame.indexOf("setSearchExperienceOpen(false)"),
    "focus must leave the tools panel before it becomes inert"
  );
  assert.match(app, /searchMatchCount\.textContent = `\$\{state\.resultCount\.toLocaleString\(\)\}/);
  assert.match(app, /prompt\.setAttribute\("aria-current", "true"\)/);
  assert.match(app, /const clearBrowseFilters = \(\) =>/);
  assert.doesNotMatch(app, /if \(state\.query\) clearBrowseFilters\(\)/);
  assert.match(app, /hiddenByFilters/);
  assert.match(app, /hiddenFilterNote\.addEventListener\("click"/);
  assert.match(app, /quickFamilyFilters\.forEach/);
  assert.match(app, /quickMandatory\.addEventListener\("click"/);
  assert.match(app, /familyFilter\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /decodeHash\(window\.location\.hash/);
  assert.match(app, /document\.getElementById\(targetId\)/);
  assert.doesNotMatch(app, /document\.querySelector\(window\.location\.hash\)/);
  const searchEscapeBranch = app.slice(
    app.indexOf('if (event.key === "Escape" && elements.searchExperience.contains(document.activeElement))'),
    app.indexOf("syncSearchControls();", app.indexOf('if (event.key === "Escape" && elements.searchExperience.contains(document.activeElement)'))
  );
  assert.match(searchEscapeBranch, /setSearchExperienceOpen\(false\)/);
  assert.doesNotMatch(searchEscapeBranch, /search\.blur\(\)/, "Escape must dismiss tools without moving focus");
  assert.match(app, /event\.key === "ArrowDown"/);
  assert.match(app, /"ArrowUp"/);
  assert.match(app, /event\.key === "Enter"/);
  assert.doesNotMatch(app, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
  assert.match(app, /aria-activedescendant/);
  assert.match(app, /document\.createElement\("div"\)[\s\S]*option\.setAttribute\("role", "option"\)[\s\S]*option\.tabIndex = -1/s);
  assert.match(app, /const RECENT_SELECTIONS_KEY/);
  assert.match(app, /sessionStorage\.setItem\(RECENT_SELECTIONS_KEY, JSON\.stringify\(state\.recentOffenseIds\)\)/);
  assert.doesNotMatch(app, /sessionStorage\.setItem\([^\n]*state\.query/);
});

test("motion setup is passive, progressive, and does not animate result rendering", () => {
  assert.match(app, /window\.scrollY > 24/);
  assert.match(app, /\{ passive: true \}/);
  assert.match(app, /new IntersectionObserver/);
  assert.match(app, /threshold:\s*0\.12/);
  assert.match(app, /document\.startViewTransition/);
  assert.match(app, /prefersReducedMotion\(\)/);
  const renderBody = app.slice(app.indexOf("const renderOffenses"), app.indexOf("const clearBrowseFilters"));
  assert.doesNotMatch(renderBody, /animate|transition|requestAnimationFrame/);
});

test("command search preserves focus, contrast, and short-viewport access", () => {
  assert.match(css, /\.command-results\s*\{[^}]*max-height:\s*344px/s);
  assert.doesNotMatch(css, /\.command-results\s*\{[^}]*100vh - 330px/s);
  assert.match(css, /\.command-option\[aria-selected="true"\] \.command-detail\s*\{[^}]*color:\s*var\(--text-soft\)/s);

  const selectCandidateBody = app.slice(
    app.indexOf("const selectCandidate"),
    app.indexOf("const activateSuggestedSearch")
  );
  assert.ok(
    selectCandidateBody.indexOf("row.focus({ preventScroll: true })") <
      selectCandidateBody.indexOf("setSearchExperienceOpen(false)"),
    "the selected row must receive focus before the popup is made inert"
  );
  const suggestedSearchBody = app.slice(
    app.indexOf("const activateSuggestedSearch"),
    app.indexOf("const buildFilters")
  );
  assert.ok(
    suggestedSearchBody.indexOf("elements.search.focus({ preventScroll: true })") <
      suggestedSearchBody.indexOf("renderOffenses()"),
    "a shortcut must move focus before hiding its source controls"
  );
});

test("the production bundle includes the fuzzy-search module", () => {
  assert.match(build, /src", "search\.js"/);
  assert.match(build, /src", "freshness\.js"/);
  assert.match(build, /src", "share-state\.js"/);
  assert.match(build, /trustFiles/);
  assert.match(build, /config", "source-version\.json"/);
  assert.match(build, /artifact-checksums\.json/);
  assert.match(build, /sbom\.cdx\.json/);
  assert.match(build, /client, "src", "search\.js"/);
  assert.match(build, /client, "version\.json"/);
  assert.match(build, /client, "index\.html"/);
});

test("Vercel serves the static client with the same defensive policy", () => {
  const config = JSON.parse(vercel);
  assert.equal(config.installCommand, "npm install --ignore-scripts");
  assert.equal(config.buildCommand, "npm run build:production");
  assert.equal(config.devCommand, "npm run dev");
  assert.equal(config.outputDirectory, "dist/client");
  const securityPolicy = config.headers.find(({ source }) => source === "/(.*)");
  const headers = Object.fromEntries(securityPolicy.headers.map(({ key, value }) => [key, value]));
  assert.match(headers["Content-Security-Policy"], /default-src 'self'/);
  assert.equal(headers["Permissions-Policy"], "camera=(), geolocation=(), microphone=()");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.match(headers["Content-Security-Policy"], /require-trusted-types-for 'script'/);
  const versionPolicy = config.headers.find(({ source }) => source === "/version.json");
  assert.deepEqual(versionPolicy.headers, [{ key: "Cache-Control", value: "no-store, max-age=0" }]);
});

test("the local server rejects traversal and emits defensive response headers", () => {
  assert.match(server, /filePath\.startsWith\(`\$\{root\}\$\{path\.sep\}`\)/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
  assert.match(server, /try \{/);
  assert.match(server, /decodeURIComponent\(pathname\)/);
  assert.match(server, /response\.writeHead\(400/);
  assert.match(server, /"Bad request"/);
});

test("the statute sheet preserves the existing deep-link and rendering contracts", () => {
  // A third fragment shape. The bare "#<id>" form must keep scrolling only, so links
  // shared before the sheet existed resolve exactly as they did.
  assert.match(app, /const OFFENSE_HASH_PREFIX = "#offense\/"/);
  assert.match(app, /readOffenseHash\(window\.location\.hash\)/);
  assert.match(app, /url\.hash = encodeURIComponent\(offense\.id\)/);

  // Statutory text is structured data rendered as text nodes, never markup.
  assert.match(app, /paragraph\.textContent = block\.text/);
  assert.doesNotMatch(app, /innerHTML\s*=/);

  // A section key reaches a URL, so it is validated and cannot express a path segment.
  assert.match(app, /const SECTION_KEY_PATTERN = /);
  assert.match(app, /SECTION_KEY_PATTERN\.test\(sectionKey\)/);
  assert.match(app, /encodeURIComponent\(sectionKey\)/);
  assert.ok(
    app.includes("^https:\\/\\/www\\.ilga\\.gov\\/"),
    "the outbound statute link must be checked against the official ILGA host"
  );

  // Statutory text must stay out of the initial payload and be fetched on demand.
  assert.match(app, /const sectionRequests = new Map\(\)/);
  assert.match(app, /sectionRequests\.has\(sectionKey\)/);

  // Retrieval date and the absence of human review are unconditional visible text.
  assert.match(app, /retrieved from ilga\.gov on/);
  assert.match(app, /not reviewed by a person/);

  // The sheet must not be built inside the render path the motion test guards.
  const renderBody = app.slice(app.indexOf("const renderOffenses"), app.indexOf("const clearBrowseFilters"));
  assert.doesNotMatch(renderBody, /openStatuteSheet|createSheetContent/);
});

test("the statute sheet is one shared modal dialog, not a panel per row", () => {
  // 953 per-row panels would nest tinted surfaces four deep inside an offense row.
  assert.match(html, /<dialog class="statute-sheet" id="statute-sheet"/);
  assert.match(app, /elements\.statuteSheet\.showModal\(\)|sheet\.showModal\(\)/);
  assert.doesNotMatch(app, /class = "offense-detail"|className = "offense-detail"/);
  assert.doesNotMatch(css, /\.offense-detail\b/);

  // showModal() supplies focus trapping, Escape, and background inerting; the app only
  // has to give focus back to whatever opened the sheet.
  assert.match(app, /statuteSheet\.addEventListener\("close"/);

  // Not every engine dispatches "close" — one embedded browser tested here never does —
  // so focus restoration and tear-down must not depend on that event alone.
  assert.match(app, /const finishStatuteSheetClose = \(\) =>/);
  assert.match(app, /event\.key !== "Escape"\) return;\s*\n\s*event\.preventDefault\(\);\s*\n\s*closeStatuteSheet\(\);/);
  assert.match(app, /sheetReturnFocus\?\.isConnected/);
  assert.match(app, /statuteButton\.setAttribute\("aria-haspopup", "dialog"\)/);
});

test("the statute sheet uses the system's deepest-overlay and skeleton vocabulary", () => {
  // Glass is reserved for floating surfaces; this is the only new floating surface.
  assert.match(css, /\.statute-sheet\s*\{[^}]*background:\s*var\(--glass\)/s);
  assert.match(css, /\.statute-sheet\s*\{[^}]*backdrop-filter:\s*blur\(22px\) saturate\(1\.08\)/s);
  assert.match(css, /\.statute-sheet\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/s);
  assert.match(css, /\.statute-sheet\s*\{[^}]*box-shadow:\s*var\(--shadow-float\)/s);
  assert.match(css, /\.statute-sheet::backdrop/);

  // Entrance uses the existing keyframe and is stripped under reduced motion.
  assert.match(css, /\.statute-sheet\[open\]\s*\{[^}]*animation:\s*sheet-enter/s);
  assert.match(css, /\.statute-sheet\[open\]\s*\{\s*animation:\s*none/s);

  // A wait must read the same here as in the results list.
  assert.match(css, /\.statute-skeleton\s*\{[^}]*repeating-linear-gradient/s);
  assert.match(css, /\.statute-skeleton\s*\{[^}]*opacity:\s*0\.42/s);
  assert.match(app, /announcement\.className = "sr-only"/);

  // Field use: gloved hands, one-handed, so every control keeps the 44px target.
  assert.match(css, /\.detail-ilga\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.detail-copy-link\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.statute-sheet-close\s*\{[^}]*min-height:\s*44px/s);
  // Mobile: bottom-anchored, within thumb reach.
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*\.statute-sheet\s*\{[^}]*margin:\s*auto auto 0/s);
});

test("new controls join the shared motion and badge vocabularies", () => {
  // Every other 44px pill carries the same 4-part transition and is registered in the
  // global press, hover, and reduced-motion lists.
  for (const control of ["statute-sheet-close", "detail-ilga", "detail-copy-link"]) {
    const rule = new RegExp(`\\.${control}\\s*\\{[^}]*transition:[^}]*transform 100ms var\\(--ease-out\\)`, "s");
    assert.match(css, rule, `.${control} must carry the shared transition`);
    assert.match(css, new RegExp(`\\.${control}:active,`), `.${control} must press like every other control`);
    assert.match(css, new RegExp(`\\.${control}:hover`), `.${control} must have a hover state`);
  }

  // Two badges in the same column must not be two different recipes.
  assert.match(css, /\.statutory-flag::before\s*\{[^}]*background:\s*currentColor/s);
  assert.match(css, /\.statutory-flag\s*\{[^}]*color:\s*var\(--accent\)/s);
  assert.doesNotMatch(css, /\.statutory-flag\s*\{[^}]*border:/s);

  // Off-scale values the design system does not contain.
  assert.doesNotMatch(css, /font-size:\s*15px/);
  assert.doesNotMatch(css, /font-weight:\s*600/);
  assert.doesNotMatch(css, /line-height:\s*1\.6\b/);
});

