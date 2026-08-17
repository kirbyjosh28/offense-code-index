import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLog, latestDecisions, publishableState } from "./lib/review-log.mjs";

/**
 * Validate generated enrichment content before it can be published.
 *
 * Two independent guarantees:
 *
 * 1. **Traceability.** Every quick element must carry a `sourceMapping` whose
 *    `sourceText` is a *verbatim substring* of the statutory text it claims to come
 *    from. An element that cannot be anchored is rejected. This turns "traceable to
 *    source" from a promise into a build assertion.
 *
 * 2. **Review integrity.** The review log's hash chain must be intact, and every
 *    publishable record's signed hashes must still match both its draft and the current
 *    statutory text.
 *
 *   node scripts/validate-enrichment.mjs
 *
 * Exits non-zero on any failure. An empty content directory is valid: it means nothing
 * has been drafted yet, which is the current state of this project.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const listJson = async (dir) => {
  try {
    return (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  } catch {
    return [];
  }
};

/** Normalize exactly as the extractor does, so offsets and substrings line up. */
const collapse = (value) => String(value ?? "").replace(/[\s ]+/g, " ").trim();

export const validateEnrichment = async ({ root: base = root } = {}) => {
  const failures = [];
  const draftFiles = await listJson(path.join(base, "content", "drafts"));
  const model = await readJson(path.join(base, "src", "data", "enrichment", "citation-model.json")).catch(() => null);

  const chain = await readLog(path.join(base, "content", "review-log.ndjson"));
  if (!chain.ok) failures.push(...chain.failures.map((failure) => `review log: ${failure}`));
  const decisions = latestDecisions(chain.entries);

  const sectionText = new Map();
  for (const file of await listJson(path.join(base, "src", "data", "enrichment", "sections"))) {
    const section = await readJson(path.join(base, "src", "data", "enrichment", "sections", file));
    const body = (section.blocks ?? [])
      .filter((block) => block.type !== "source")
      .map((block) => block.text)
      .join("\n");
    sectionText.set(section.sectionKey, body);
  }

  let publishable = 0;
  const withheld = [];

  for (const file of draftFiles) {
    const offenseId = file.replace(/\.json$/, "");
    const draftPath = path.join(base, "content", "drafts", file);
    const draftRaw = await readFile(draftPath, "utf8");
    const draft = JSON.parse(draftRaw);

    const record = model?.records?.[offenseId];
    if (!record) {
      failures.push(`${offenseId}: draft exists for a record the citation model does not contain`);
      continue;
    }
    const body = record.sectionKey ? sectionText.get(record.sectionKey) : null;
    if (!body) {
      failures.push(`${offenseId}: no retrieved statutory text for ${record.sectionKey ?? "an unresolved record"}`);
      continue;
    }
    const haystack = collapse(body);

    // Every generated element must be anchored to words that actually appear in the law.
    for (const [index, mapping] of (draft.sourceMapping ?? []).entries()) {
      if (!mapping.sourceText || !collapse(mapping.sourceText)) {
        failures.push(`${offenseId}: sourceMapping[${index}] has no sourceText`);
        continue;
      }
      if (!haystack.includes(collapse(mapping.sourceText))) {
        failures.push(
          `${offenseId}: sourceMapping[${index}] quotes text that does not appear in ${record.citation}`
        );
      }
    }

    const elements = draft.quickElements ?? [];
    const anchored = new Set((draft.sourceMapping ?? []).map((mapping) => mapping.element));
    for (const element of elements) {
      if (!anchored.has(element)) {
        failures.push(`${offenseId}: quick element is not anchored to any statutory text: "${element}"`);
      }
    }

    const state = publishableState({
      decision: decisions.get(offenseId),
      draftText: draftRaw,
      sectionBodyText: body,
    });
    if (state.publishable) publishable += 1;
    else if (decisions.has(offenseId)) withheld.push(`${offenseId}: ${state.reason}`);
  }

  return { ok: failures.length === 0, failures, withheld, drafts: draftFiles.length, reviewed: decisions.size, publishable };
};

const isDirectInvocation = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  const result = await validateEnrichment();
  console.log(
    `Enrichment content: ${result.drafts} draft(s) · ${result.reviewed} reviewed record(s) · ${result.publishable} publishable.`
  );
  for (const note of result.withheld) console.log(`  withheld — ${note}`);
  if (!result.ok) {
    console.error(`\n${result.failures.length} problem(s):`);
    for (const failure of result.failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  } else if (result.drafts === 0) {
    console.log("No generated content exists yet, which is the expected state.");
  }
}
