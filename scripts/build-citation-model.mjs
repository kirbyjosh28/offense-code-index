import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDocName, formatCitation, parseCitation, sectionKeyFor, splitSubsections } from "./lib/ilga.mjs";

/**
 * Build an explicit chapter/act/section model for every record in the frozen corpus.
 *
 * The 2024 source publication prints roughly half its citations bare ("3-101") and half
 * fully qualified ("625 ILCS 40/5-7(a)(3.1)"). Downstream work needs one explicit shape,
 * so this script resolves every record once and writes the result to a build artifact.
 *
 * It never modifies src/data/offense-codes.json. Those bytes are hash-pinned provenance
 * for a specific published document and are frozen permanently.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CORPUS_PATH = path.join(root, "src", "data", "offense-codes.json");
const OVERRIDES_PATH = path.join(root, "content", "mappings", "citation-overrides.json");
const OUTPUT_PATH = path.join(root, "src", "data", "enrichment", "citation-model.json");

/** The Illinois Vehicle Code, which the source publication prints without a citation prefix. */
const VEHICLE_CODE = { chapterId: "625", actId: "5" };

/**
 * A bare code belongs to the Vehicle Code only if its chapter heading is an internal
 * Vehicle Code article heading — "CHAPTER 11 - RULES OF THE ROAD" — as opposed to a
 * heading that names its own act, such as "CHAPTER 810, ILCS 5/ - Uniform Commercial
 * Code". Deriving this from the heading rather than from the PDF page number is what
 * keeps the two Uniform Commercial Code rows and the Snowmobile Act row from being
 * silently absorbed into 625 ILCS 5.
 */
const VEHICLE_CODE_CHAPTER = /^CHAPTER\s+(\d+[a-z]?)\s*-\s*\S/i;

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const resolveRecord = (offense, overrides) => {
  const override = overrides[offense.id];

  if (override) {
    if (override.resolution === "not-applicable") {
      return { resolution: "not-applicable", rationale: override.rationale };
    }
    // Researched, but the answer is a legal determination rather than a citation
    // correction — a repealed act with no asserted successor, for instance. Recorded
    // deliberately so the research is durable and the record stays visible in the audit.
    if (override.resolution === "needs-legal-review") {
      return {
        resolution: "needs-legal-review",
        rationale: override.rationale,
        research: override.research ?? null,
      };
    }
    const { sectionId, subsectionPath, subsectionRange } = splitSubsections(override.sectionId);
    return {
      resolution: "override",
      chapterId: override.chapterId,
      actId: override.actId,
      sectionId,
      subsectionPath: override.subsectionPath ?? subsectionPath,
      subsectionRange: subsectionRange ?? null,
      rationale: override.rationale,
    };
  }

  const direct = parseCitation(offense.code ?? "");
  if (direct.resolution === "parsed") return direct;

  // Bare code. Establish that it really is Vehicle Code before supplying the default act.
  const heading = VEHICLE_CODE_CHAPTER.exec(offense.chapter ?? "");
  if (!heading || /ILCS/i.test(offense.chapter ?? "")) {
    return { resolution: "unresolved", reason: "non-vehicle-code-chapter", raw: offense.code };
  }

  const inferred = parseCitation(offense.code ?? "", {
    defaultChapterId: VEHICLE_CODE.chapterId,
    defaultActId: VEHICLE_CODE.actId,
  });
  if (inferred.resolution !== "inferred") return inferred;

  // Cross-check: a code under "CHAPTER 11" must be an 11-series section. A mismatch means
  // the heading and the code disagree, which is a data problem a human has to look at.
  const codeChapter = /^(\d+[a-z]?)/i.exec(inferred.sectionId);
  if (!codeChapter || codeChapter[1].toLowerCase() !== heading[1].toLowerCase()) {
    return {
      resolution: "unresolved",
      reason: "chapter-heading-mismatch",
      raw: offense.code,
      detail: `code "${offense.code}" under heading "${offense.chapter}"`,
    };
  }

  return inferred;
};

const corpus = await readJson(CORPUS_PATH);
const { overrides } = await readJson(OVERRIDES_PATH);
const corpusSha256 = createHash("sha256")
  .update(await readFile(CORPUS_PATH))
  .digest("hex");

const records = {};
const sections = new Map();
const counts = { parsed: 0, inferred: 0, override: 0, "not-applicable": 0, "needs-legal-review": 0, unresolved: 0 };
const problems = [];

for (const offense of corpus.offenses) {
  const resolved = resolveRecord(offense, overrides);
  counts[resolved.resolution] = (counts[resolved.resolution] ?? 0) + 1;

  if (resolved.resolution === "unresolved") {
    problems.push({ id: offense.id, code: offense.code, ...resolved });
    records[offense.id] = { resolution: "unresolved", reason: resolved.reason, code: offense.code ?? null };
    continue;
  }

  if (resolved.resolution === "not-applicable" || resolved.resolution === "needs-legal-review") {
    records[offense.id] = {
      resolution: resolved.resolution,
      code: offense.code ?? null,
      rationale: resolved.rationale ?? null,
      ...(resolved.research ? { research: resolved.research } : {}),
    };
    continue;
  }

  const identity = {
    chapterId: resolved.chapterId,
    actId: resolved.actId,
    sectionId: resolved.sectionId,
  };
  const sectionKey = sectionKeyFor(identity);
  const citation = formatCitation(identity);
  const docName = buildDocName(identity);

  const subsectionPath = resolved.subsectionPath ?? [];
  const subsectionRange = resolved.subsectionRange ?? null;
  // Section-level `citation` addresses the statute on ILGA. Record-level `fullCitation`
  // keeps the cited subsection, which exact-code search depends on: a record for
  // "11-501(a)(1)" must stay findable by that string, not collapse to "11-501".
  const subsectionSuffix = subsectionRange ?? subsectionPath.map((part) => `(${part})`).join("");

  records[offense.id] = {
    resolution: resolved.resolution,
    code: offense.code ?? null,
    ...identity,
    subsectionPath,
    subsectionRange,
    sectionKey,
    citation,
    fullCitation: `${citation}${subsectionSuffix}`,
  };

  if (!sections.has(sectionKey)) {
    sections.set(sectionKey, { ...identity, sectionKey, citation, docName, offenseIds: [] });
  }
  sections.get(sectionKey).offenseIds.push(offense.id);
}

const orderedSections = Object.fromEntries(
  [...sections.entries()].sort(([left], [right]) => left.localeCompare(right))
);

const model = {
  schemaVersion: 1,
  generatedFrom: {
    corpus: "src/data/offense-codes.json",
    corpusSha256,
    recordCount: corpus.offenses.length,
  },
  counts: {
    ...counts,
    distinctSections: sections.size,
  },
  sections: orderedSections,
  records,
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(model, null, 2)}\n`);

const resolvedTotal = counts.parsed + counts.inferred + counts.override;
console.log(`Citation model written for ${corpus.offenses.length} records.`);
console.log(
  `  parsed ${counts.parsed} · inferred ${counts.inferred} · override ${counts.override} · ` +
    `not-applicable ${counts["not-applicable"]} · needs-legal-review ${counts["needs-legal-review"]} · ` +
    `unresolved ${counts.unresolved}`
);
console.log(`  ${resolvedTotal} records resolve to ${sections.size} distinct statutory sections.`);

if (problems.length) {
  console.error(`\n${problems.length} record(s) could not be resolved and need a reviewed override:`);
  for (const problem of problems) {
    console.error(`  ${problem.id}  ${JSON.stringify(problem.code)}  ${problem.reason}${problem.detail ? ` — ${problem.detail}` : ""}`);
  }
  console.error("\nAdd entries to content/mappings/citation-overrides.json with evidence, then re-run.");
  process.exitCode = 1;
}
