import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { latestDecisions, publishableState, readLog } from "./lib/review-log.mjs";

/**
 * Build the runtime lookup index the client actually downloads.
 *
 * The frozen corpus is provenance evidence and is still published byte-identical for
 * anyone who wants to verify it, but it is not an efficient runtime payload: it carries
 * a precomputed `searchText` that duplicates fields already present, and a county table
 * nothing at runtime reads. This index drops both and joins in the statutory enrichment
 * layer, so the client gets one document containing exactly what the interface renders.
 *
 * Enrichment is optional. With no citation model or sweep results on disk, the index is
 * still produced and the interface degrades to what it showed before this layer existed.
 *
 *   node scripts/build-lookup-index.mjs
 */

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const readJsonOrNull = async (file) => {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
};

/**
 * Statuses that mean "the statute behind this record is not simply current text".
 * These drive the interface's status treatment and a search rank penalty.
 */
const FLAGGED_STATUSES = new Set([
  "unavailable",
  "repealed",
  "citation-mismatch",
  "subsection-not-found",
  "unparseable",
  // Retrieval problems rather than findings about the law, but a record whose statute
  // could not be fetched must not look identical to one that was fetched cleanly.
  "fetch-failed",
  "not-fetched",
  "not-swept",
]);

export const buildLookupIndex = async ({ root = moduleRoot } = {}) => {
  const corpus = await readJson(path.join(root, "src", "data", "offense-codes.json"));
  const enrichmentDir = path.join(root, "src", "data", "enrichment");
  const model = await readJsonOrNull(path.join(enrichmentDir, "citation-model.json"));
  const manifest = await readJsonOrNull(path.join(enrichmentDir, "manifest.json"));

  const sectionHeadings = new Map();
  const sectionBodies = new Map();
  const unreadableSections = [];
  if (manifest) {
    let files = [];
    try {
      files = await readdir(path.join(enrichmentDir, "sections"));
    } catch {
      files = [];
    }
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      // Per file: a single truncated section must not discard the other 694. Losing the
      // whole statutory layer to one bad file, silently, in a build that still succeeds,
      // is a worse outcome than shipping without that one section.
      try {
        const section = await readJson(path.join(enrichmentDir, "sections", file));
        sectionHeadings.set(section.sectionKey, {
          headingText: section.headingText ?? null,
          ilgaUrl: section.ilgaUrl,
          status: section.status,
          retrievedAt: section.retrievedAt,
          publicActs: section.publicActs ?? [],
        });
        sectionBodies.set(
          section.sectionKey,
          (section.blocks ?? []).filter((block) => block.type !== "source").map((block) => block.text).join("\n")
        );
      } catch {
        unreadableSections.push(file);
      }
    }
  }

  const offenses = corpus.offenses.map((offense) => {
    // Dropped here, all still published in the frozen corpus for verification:
    //   searchText       — src/search.js rebuilds it exactly, asserted by a test
    //   descriptionRaw   — pre-cleanup OCR text, superseded by description
    //   citationRaw      — pre-cleanup citation, superseded by code
    //   sourcePrintedPage, uniformCode, citationPlaceholder — no runtime reader
    const { searchText, descriptionRaw, citationRaw, sourcePrintedPage, uniformCode, citationPlaceholder, ...rest } =
      offense;
    const citation = model?.records?.[offense.id];
    const status = manifest?.records?.[offense.id];

    if (!citation || !citation.sectionKey) return rest;

    const section = sectionHeadings.get(citation.sectionKey);
    const statutoryStatus = status?.status ?? section?.status ?? null;
    const flagged = Boolean(statutoryStatus && FLAGGED_STATUSES.has(statutoryStatus));

    // Only anomalies are carried per record. Section headings, ILGA URLs, and retrieval
    // dates all live in the section chunk the detail view fetches on demand, and
    // repeating them here for 709 sections cost more in the initial payload than the
    // precomputed searchText this index was created to remove.
    return {
      ...rest,
      citation: citation.citation,
      fullCitation: citation.fullCitation,
      sectionKey: citation.sectionKey,
      ...(citation.subsectionPath.length ? { subsectionPath: citation.subsectionPath } : {}),
      ...(section ? { statutoryTextAvailable: true } : {}),
      ...(flagged ? { statutoryStatus, statutoryFlagged: true } : {}),
    };
  });

  // Reviewed generated content, if any exists. Nothing is published on the strength of
  // a review alone: the signed hashes must still match both the draft on disk and the
  // statutory text currently retrieved, so an edited draft or an amended statute
  // withdraws publication automatically rather than needing anyone to notice.
  const chain = await readLog(path.join(root, "content", "review-log.ndjson"));
  const decisions = chain.ok ? latestDecisions(chain.entries) : new Map();
  let humanReviewed = 0;

  for (const [offenseId, decision] of decisions) {
    const record = model?.records?.[offenseId];
    const sectionKey = record?.sectionKey;
    if (!sectionKey) continue;

    let draftText = null;
    try {
      draftText = await readFile(path.join(root, "content", "drafts", `${offenseId}.json`), "utf8");
    } catch {
      continue;
    }
    const body = sectionBodies.get(sectionKey);
    if (publishableState({ decision, draftText, sectionBodyText: body }).publishable) {
      const target = offenses.find((offense) => offense.id === offenseId);
      if (target) {
        Object.assign(target, JSON.parse(draftText), { reviewedOn: decision.reviewedAt });
        humanReviewed += 1;
      }
    }
  }

  const enriched = offenses.filter((offense) => offense.sectionKey).length;
  const flagged = offenses.filter((offense) => offense.statutoryFlagged).length;
  const ilgaConfig = await readJsonOrNull(path.join(root, "config", "enrichment-version.json"));

  return {
    schemaVersion: 1,
    meta: corpus.meta,
    // Stored once rather than per record: the client builds a section's ILGA URL from
    // its section key, which already encodes chapter, act, and section.
    ilgaUrlTemplate: ilgaConfig?.ilga?.urlTemplate ?? null,
    // Counties are published in the frozen corpus but nothing at runtime reads them.
    enrichment: {
      available: Boolean(model),
      statutoryTextAvailable: sectionHeadings.size > 0,
      sweptAt: manifest?.generatedAt ?? null,
      enrichedRecordCount: enriched,
      flaggedRecordCount: flagged,
      sectionCount: sectionHeadings.size,
      unreadableSectionCount: unreadableSections.length,
      // Counted, never asserted: this is zero until a recorded review says otherwise.
      humanReviewedRecordCount: humanReviewed,
      reviewLogIntact: chain.ok,
    },
    offenses,
  };
};

const isDirectInvocation = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  const index = await buildLookupIndex();
  const outputPath = path.join(moduleRoot, "src", "data", "lookup-index.json");
  await writeFile(outputPath, `${JSON.stringify(index)}\n`);

  const bytes = Buffer.byteLength(JSON.stringify(index));
  console.log(`Wrote src/data/lookup-index.json (${(bytes / 1024).toFixed(0)} KB)`);
  console.log(
    `  ${index.offenses.length} records · ${index.enrichment.enrichedRecordCount} with a resolved citation · ` +
      `${index.enrichment.sectionCount} statutory sections · ${index.enrichment.flaggedRecordCount} flagged`
  );
  if (index.enrichment.unreadableSectionCount) {
    console.error(`  ${index.enrichment.unreadableSectionCount} section file(s) could not be read and were skipped.`);
  }
}
