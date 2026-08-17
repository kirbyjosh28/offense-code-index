import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  citationMatches,
  extractStatutoryText,
  hashStatutoryBody,
  subsectionPresent,
} from "./lib/ilga.mjs";
import { buildUrl, createCache, createPacer, fetchDocument } from "./lib/ilga-client.mjs";

/**
 * Retrieve current statutory text from ILGA for every section behind the corpus, and
 * detect what has changed since the last sweep.
 *
 * This script establishes what ILGA published on a given date and fingerprints it. That
 * is a provenance claim, not a legal one: nothing here certifies a record as current
 * law, and section status is deliberately called "retrieved" rather than "verified" so
 * the word "verified" stays reserved for a recorded human review.
 *
 *   node scripts/verify-ilga.mjs                 full sweep, using cache where fresh
 *   node scripts/verify-ilga.mjs --offline       cache only, no network
 *   node scripts/verify-ilga.mjs --refresh       ignore cache, refetch everything
 *   node scripts/verify-ilga.mjs --limit=25      first N sections, for iteration
 *
 * Exits non-zero when statutory text has changed since the last sweep. A change never
 * republishes anything automatically; it marks records for review.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_PATH = path.join(root, "src", "data", "enrichment", "citation-model.json");
const CONFIG_PATH = path.join(root, "config", "enrichment-version.json");
const SECTIONS_DIR = path.join(root, "src", "data", "enrichment", "sections");
const MANIFEST_PATH = path.join(root, "src", "data", "enrichment", "manifest.json");
const REVIEW_QUEUE_PATH = path.join(root, "content", "review-queue", "statutory-changes.json");
const CACHE_DIR = path.join(root, "cache", "ilga");

const args = new Set(process.argv.slice(2));
const offline = args.has("--offline");
const refresh = args.has("--refresh");
const limitArg = [...args].find((arg) => arg.startsWith("--limit="));
let limit = Infinity;
if (limitArg) {
  const raw = limitArg.split("=")[1];
  limit = Number.parseInt(raw, 10);
  if (!Number.isInteger(limit) || limit < 1) {
    console.error(`--limit must be a positive integer; received ${JSON.stringify(raw)}.`);
    process.exit(1);
  }
}
const partialSweep = Number.isFinite(limit);

/**
 * How long a cached page is trusted without revalidation. Long enough that iterating on
 * the pipeline costs ILGA nothing, short enough that a weekly sweep actually checks.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const loadPreviousSections = async () => {
  const previous = new Map();
  let files = [];
  try {
    files = await readdir(SECTIONS_DIR);
  } catch {
    return previous;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = await readJson(path.join(SECTIONS_DIR, file));
      previous.set(parsed.sectionKey, parsed);
    } catch {
      // A corrupt cache entry is not a reason to abort a sweep; it will be overwritten.
    }
  }
  return previous;
};

const model = await readJson(MODEL_PATH);
const config = await readJson(CONFIG_PATH);
const template = config.ilga.urlTemplate;

const previousSections = await loadPreviousSections();
const cache = createCache(CACHE_DIR);
const pace = createPacer(1_500);

const sectionEntries = Object.values(model.sections).slice(0, limit);
const startedAt = new Date().toISOString();

console.log(
  `Sweeping ${sectionEntries.length} statutory sections${offline ? " (offline, cache only)" : ""}${refresh ? " (refresh, ignoring cache)" : ""}.`
);
if (!offline) console.log("Pacing at one request per 1.5s to stay a considerate client of a public service.\n");

const results = [];
const changes = [];
let processed = 0;

for (const section of sectionEntries) {
  processed += 1;
  const { sectionKey, docName, citation } = section;
  const url = buildUrl(template, docName);
  const previous = previousSections.get(sectionKey);

  let html = null;
  let retrievedAt = new Date().toISOString();
  let transport = "network";

  const cached = await cache.get(docName);
  const cacheIsFresh = Boolean(cached) && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL_MS;

  if (cached && !refresh && (offline || cacheIsFresh)) {
    html = cached.html;
    retrievedAt = cached.fetchedAt;
    transport = "cache";
  }

  if (!html && !offline) {
    await pace();
    // Revalidate rather than refetch when we still hold a copy: ILGA answers 304 and
    // sends nothing. --refresh deliberately drops the validators to force a full body.
    const response = await fetchDocument(url, {
      etag: refresh ? null : (cached?.etag ?? null),
      lastModified: refresh ? null : (cached?.lastModified ?? null),
    });

    if (response.notModified && cached) {
      html = cached.html;
      transport = "not-modified";
      await cache.touch(docName);
    } else if (response.html) {
      html = response.html;
      transport = "network";
      const entry = await cache.set(docName, {
        html: response.html,
        etag: response.etag,
        lastModified: response.lastModified,
        url: response.url,
        status: response.status,
      });
      retrievedAt = entry.fetchedAt;
    } else {
      results.push({
        sectionKey,
        citation,
        docName,
        ilgaUrl: url,
        status: "fetch-failed",
        detail: response.error ?? `HTTP ${response.status}`,
        offenseIds: section.offenseIds,
      });
      if (processed % 25 === 0) console.log(`  ${processed}/${sectionEntries.length}`);
      continue;
    }
  }

  if (!html) {
    results.push({
      sectionKey,
      citation,
      docName,
      ilgaUrl: url,
      status: "not-fetched",
      detail: offline ? "no cached copy" : "no response body",
      offenseIds: section.offenseIds,
    });
    continue;
  }

  const extracted = extractStatutoryText(html);

  let status;
  if (!extracted.available) {
    // ILGA serves this with HTTP 200. A section the 2024 publication cited that ILGA no
    // longer serves is a genuine finding, not a pipeline error.
    status = extracted.reason === "not-available" ? "unavailable" : "unparseable";
  } else if (!citationMatches(extracted.canonicalCitation, section)) {
    status = "citation-mismatch";
  } else if (extracted.repealed) {
    status = "repealed";
  } else {
    status = "retrieved";
  }

  const bodyHash = extracted.available ? hashStatutoryBody(extracted.bodyText) : null;
  const changed = Boolean(previous && previous.bodyHash && bodyHash && previous.bodyHash !== bodyHash);
  const actsBefore = (previous?.publicActs ?? []).map((act) => act.publicAct).join(",");
  const actsAfter = extracted.publicActs.map((act) => act.publicAct).join(",");
  const actsChanged = Boolean(previous && actsBefore !== actsAfter);

  if (changed || actsChanged) {
    changes.push({
      sectionKey,
      citation,
      ilgaUrl: url,
      affectedOffenseIds: section.offenseIds,
      bodyChanged: changed,
      previousBodyHash: previous?.bodyHash ?? null,
      currentBodyHash: bodyHash,
      previousPublicActs: previous?.publicActs ?? [],
      currentPublicActs: extracted.publicActs,
      previousSourceLine: previous?.sourceLine ?? null,
      currentSourceLine: extracted.sourceLine,
      detectedAt: startedAt,
    });
  }

  const record = {
    schemaVersion: 1,
    sectionKey,
    citation,
    docName,
    ilgaUrl: url,
    // "retrieved", never "verified": machine retrieval is a provenance claim only.
    status,
    retrievedAt,
    transport,
    canonicalCitation: extracted.canonicalCitation,
    headingText: extracted.headingText,
    blocks: extracted.blocks,
    sourceLine: extracted.sourceLine,
    publicActs: extracted.publicActs,
    repealed: extracted.repealed,
    bodyHash,
    changedSincePreviousSweep: changed || actsChanged,
    offenseIds: section.offenseIds,
  };

  results.push(record);

  if (processed % 25 === 0 || processed === sectionEntries.length) {
    console.log(`  ${processed}/${sectionEntries.length}`);
  }
}

await cache.save();

// Write one file per section: the fetch unit is the section, and the client fetches
// these lazily so statutory text never enters the initial payload.
//
// Only sections this run actually retrieved are rewritten. A section that failed to
// fetch keeps its last good copy — deleting it would destroy committed statutory data
// and, because the change-detection baseline is read back from these same files, would
// silently reset that baseline so a later real amendment went unnoticed.
await mkdir(SECTIONS_DIR, { recursive: true });
const written = results.filter((result) => result.blocks);
await Promise.all(
  written.map((result) =>
    writeFile(path.join(SECTIONS_DIR, `${result.sectionKey}.json`), `${JSON.stringify(result, null, 2)}\n`)
  )
);

// Prune only after a complete online sweep, and only sections the corpus no longer
// cites. A partial or offline run has no basis for deciding a section is obsolete.
let pruned = 0;
if (!partialSweep && !offline) {
  const liveKeys = new Set(Object.keys(model.sections));
  for (const file of await readdir(SECTIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    if (liveKeys.has(file.replace(/\.json$/, ""))) continue;
    await unlink(path.join(SECTIONS_DIR, file));
    pruned += 1;
  }
}

const statusCounts = results.reduce((counts, result) => {
  counts[result.status] = (counts[result.status] ?? 0) + 1;
  return counts;
}, {});

// Per-record status: a section can survive an amendment while the specific subsection a
// 2024 record cites has been renumbered away.
const recordStatuses = {};
const sectionByKey = new Map(results.map((result) => [result.sectionKey, result]));

for (const [offenseId, entry] of Object.entries(model.records)) {
  if (!entry.sectionKey) {
    recordStatuses[offenseId] = { status: entry.resolution === "not-applicable" ? "not-applicable" : "unresolved" };
    continue;
  }
  const section = sectionByKey.get(entry.sectionKey);
  if (!section) {
    recordStatuses[offenseId] = { status: "not-swept", sectionKey: entry.sectionKey };
    continue;
  }

  const present = section.blocks ? subsectionPresent(section.blocks, entry.subsectionPath) : null;
  recordStatuses[offenseId] = {
    status: section.status === "retrieved" && present === false ? "subsection-not-found" : section.status,
    sectionKey: entry.sectionKey,
    subsectionResolved: present,
    changedSincePreviousSweep: Boolean(section.changedSincePreviousSweep),
  };
}

const recordCounts = Object.values(recordStatuses).reduce((counts, entry) => {
  counts[entry.status] = (counts[entry.status] ?? 0) + 1;
  return counts;
}, {});

await writeFile(
  MANIFEST_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: startedAt,
      sweep: { sectionsSwept: results.length, offline, refresh, partial: partialSweep },
      urlTemplate: template,
      sectionStatusCounts: statusCounts,
      recordStatusCounts: recordCounts,
      changedSections: changes.length,
      records: recordStatuses,
    },
    null,
    2
  )}\n`
);

if (changes.length) {
  await mkdir(path.dirname(REVIEW_QUEUE_PATH), { recursive: true });
  await writeFile(
    REVIEW_QUEUE_PATH,
    `${JSON.stringify({ schemaVersion: 1, detectedAt: startedAt, changes }, null, 2)}\n`
  );
}

if (pruned) console.log(`\nPruned ${pruned} section file(s) the corpus no longer cites.`);

console.log("\nSection status:");
for (const [status, count] of Object.entries(statusCounts).sort((left, right) => right[1] - left[1])) {
  console.log(`  ${String(count).padStart(4)}  ${status}`);
}
console.log("\nRecord status:");
for (const [status, count] of Object.entries(recordCounts).sort((left, right) => right[1] - left[1])) {
  console.log(`  ${String(count).padStart(4)}  ${status}`);
}

if (changes.length) {
  console.error(`\n${changes.length} section(s) changed since the last sweep.`);
  console.error(`Review queue written to ${path.relative(root, REVIEW_QUEUE_PATH)}.`);
  console.error("Records joined to these sections are marked for review. Nothing was republished.");
  process.exitCode = 1;
} else if (previousSections.size) {
  console.log("\nNo statutory text changed since the last sweep.");
}
