import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEffectiveDate, SECTION_STATUS_DOCS } from "./lib/ilga.mjs";

/**
 * Generate docs/illinois-law-audit.md from the results of a verification sweep.
 *
 * This report states what ILGA served on the sweep date and how that compares with the
 * February 2024 source publication. It is a machine findings report. It does not
 * certify any record against current law, and it is written to say so plainly, because
 * a document titled "law audit" will be read by people who need to know its limits.
 *
 *   node scripts/report-audit.mjs
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENRICHMENT = path.join(root, "src", "data", "enrichment");
const OUTPUT_PATH = path.join(root, "docs", "illinois-law-audit.md");

/** The source publication's edition date. Public Acts effective after this postdate it. */
const SOURCE_EDITION = { year: 2024, month: 2, label: "February 2024" };

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));


const postdatesSource = (date) =>
  Boolean(date) && (date.year > SOURCE_EDITION.year || (date.year === SOURCE_EDITION.year && date.month > SOURCE_EDITION.month));

const model = await readJson(path.join(ENRICHMENT, "citation-model.json"));
const manifest = await readJson(path.join(ENRICHMENT, "manifest.json"));
const corpus = await readJson(path.join(root, "src", "data", "offense-codes.json"));

const offenseById = new Map(corpus.offenses.map((offense) => [offense.id, offense]));

const sectionFiles = (await readdir(path.join(ENRICHMENT, "sections"))).filter((file) => file.endsWith(".json"));
const sections = new Map();
for (const file of sectionFiles) {
  const section = await readJson(path.join(ENRICHMENT, "sections", file));
  sections.set(section.sectionKey, section);
}

const row = (cells) => `| ${cells.join(" | ")} |`;
const escapePipes = (value) => String(value ?? "").replace(/\|/g, "\\|");
const truncate = (value, length) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

// --- Findings -----------------------------------------------------------------

const repealed = [...sections.values()].filter((section) => section.status === "repealed");
const unavailable = [...sections.values()].filter((section) => section.status === "unavailable");
const mismatched = [...sections.values()].filter((section) => section.status === "citation-mismatch");

const amendedSinceSource = [];
for (const section of sections.values()) {
  if (section.status !== "retrieved") continue;
  const dated = section.publicActs
    .map((act) => ({ ...act, parsed: parseEffectiveDate(act.effectiveDate) }))
    .filter((act) => postdatesSource(act.parsed));
  if (dated.length) {
    const newest = dated.reduce((left, right) => (right.parsed.iso > left.parsed.iso ? right : left));
    amendedSinceSource.push({ section, acts: dated, newest });
  }
}
amendedSinceSource.sort((left, right) => right.newest.parsed.iso.localeCompare(left.newest.parsed.iso));

const subsectionMissing = Object.entries(manifest.records)
  .filter(([, entry]) => entry.status === "subsection-not-found")
  .map(([offenseId, entry]) => ({ offenseId, entry, offense: offenseById.get(offenseId) }));

const unresolvedRecords = Object.entries(model.records)
  .filter(([, entry]) => entry.resolution === "unresolved")
  .map(([offenseId, entry]) => ({ offenseId, entry }));

const notApplicable = Object.entries(model.records)
  .filter(([, entry]) => entry.resolution === "not-applicable")
  .map(([offenseId, entry]) => ({ offenseId, entry, offense: offenseById.get(offenseId) }));

const needsLegalReview = Object.entries(model.records)
  .filter(([, entry]) => entry.resolution === "needs-legal-review")
  .map(([offenseId, entry]) => ({ offenseId, entry, offense: offenseById.get(offenseId) }));

const recordsAffectedBy = (list) => new Set(list.flatMap((entry) => entry.section.offenseIds)).size;

// --- Document -----------------------------------------------------------------

const lines = [];
const push = (...values) => lines.push(...values);

push(`# Illinois law audit — statutory findings report`);
push("");
push(
  `**This is a machine-generated findings report, not a legal audit.** It records what the Illinois General Assembly's website served for each cited section on the sweep date, and how that compares with the ${SOURCE_EDITION.label} Illinois Secretary of State Police Offense Code Index this project was built from. Nothing in this document certifies that any record reflects current law. Every finding below is a prompt for human review, not a conclusion.`
);
push("");
push(
  `This project is not operated by, endorsed by, or affiliated with the Illinois General Assembly, the Illinois Secretary of State, or the Illinois State Police. Links to ILGA are references only.`
);
push("");
push(`- Sweep generated: \`${manifest.generatedAt}\``);
push(`- Sections swept: **${manifest.sweep.sectionsSwept}**${manifest.sweep.partial ? " (partial sweep)" : ""}`);
push(`- Source corpus: \`src/data/offense-codes.json\`, ${model.generatedFrom.recordCount} records, unmodified`);
push(`- Corpus SHA-256: \`${model.generatedFrom.corpusSha256}\``);
push(`- Retrieval template: \`${manifest.urlTemplate}\``);
push("");

push(`## How to read the statuses`);
push("");
push(`Section status describes what was retrieved, never whether it is legally correct. The word "verified" is deliberately absent: it is reserved for a recorded human review.`);
push("");
push(row(["Status", "Meaning"]));
push(row(["---", "---"]));
for (const [status, meaning] of Object.entries(SECTION_STATUS_DOCS)) {
  push(row([`\`${status}\``, escapePipes(meaning)]));
}
push("");

push(`## Totals`);
push("");
push(row(["Measure", "Count"]));
push(row(["---", "---:"]));
push(row(["Records in frozen corpus", model.generatedFrom.recordCount]));
push(row(["Records resolved to a statutory section", model.counts.parsed + model.counts.inferred + model.counts.override]));
push(row(["— from a fully qualified citation", model.counts.parsed]));
push(row(["— inferred as Vehicle Code from a bare code", model.counts.inferred]));
push(row(["— mapped by a reviewed manual override", model.counts.override]));
push(row(["Records with no statutory section (guidance rows)", model.counts["not-applicable"]]));
push(row(["Records still unresolved", model.counts.unresolved]));
push(row(["Distinct statutory sections", model.counts.distinctSections]));
push("");
push(row(["Section outcome", "Sections", "Records affected"]));
push(row(["---", "---:", "---:"]));
const recordsByStatus = manifest.recordStatusCounts ?? {};
for (const [status, count] of Object.entries(manifest.sectionStatusCounts).sort((left, right) => right[1] - left[1])) {
  // Counted from the manifest, not from files on disk: a status whose sections were
  // never written (fetch-failed) would otherwise read as affecting no records at all.
  const affected = recordsByStatus[status] ?? 0;
  push(row([`\`${status}\``, count, affected]));
}
push("");

push(`## Findings requiring review`);
push("");

const section = (title, body) => {
  push(`### ${title}`);
  push("");
  body();
  push("");
};

section(`Sections ILGA no longer serves (${unavailable.length})`, () => {
  if (!unavailable.length) {
    push(`None. Every cited section was retrievable.`);
    return;
  }
  push(
    `These sections were cited by the ${SOURCE_EDITION.label} publication but return ILGA's "not currently available" notice. Each affects the records listed and needs a human to determine whether the section was renumbered, repealed, or never existed as cited.`
  );
  push("");
  push(row(["Citation", "Records affected", "2024 description of first record", "ILGA"]));
  push(row(["---", "---:", "---", "---"]));
  for (const entry of unavailable) {
    const first = offenseById.get(entry.offenseIds[0]);
    push(row([`\`${entry.citation}\``, entry.offenseIds.length, escapePipes(truncate(first?.description, 70)), `[open](${entry.ilgaUrl})`]));
  }
});

section(`Sections marked repealed (${repealed.length})`, () => {
  if (!repealed.length) {
    push(`None of the retrieved sections carry repeal language.`);
    return;
  }
  push(row(["Citation", "Records affected", "Heading", "ILGA"]));
  push(row(["---", "---:", "---", "---"]));
  for (const entry of repealed) {
    push(row([`\`${entry.citation}\``, entry.offenseIds.length, escapePipes(truncate(entry.headingText, 70)), `[open](${entry.ilgaUrl})`]));
  }
});

section(`Citation mismatches (${mismatched.length})`, () => {
  if (!mismatched.length) {
    push(`None. Every retrieved section echoed the citation requested.`);
    return;
  }
  push(row(["Requested", "ILGA returned", "Records affected"]));
  push(row(["---", "---", "---:"]));
  for (const entry of mismatched) {
    push(row([`\`${entry.citation}\``, `\`${entry.canonicalCitation ?? "—"}\``, entry.offenseIds.length]));
  }
});

section(`Cited subsections no longer present (${subsectionMissing.length})`, () => {
  if (!subsectionMissing.length) {
    push(`None. Every cited subsection was found in its retrieved section.`);
    return;
  }
  push(
    `The section was retrieved, but the subsection the 2024 record cites does not appear in the current text. This is the most common way a record goes stale without the citation breaking, and it is detected structurally rather than by reading.`
  );
  push("");
  push(row(["Record", "2024 citation", "Section", "Description"]));
  push(row(["---", "---", "---", "---"]));
  for (const entry of subsectionMissing.slice(0, 60)) {
    push(
      row([
        `\`${entry.offenseId}\``,
        `\`${escapePipes(entry.offense?.code ?? "—")}\``,
        `\`${escapePipes(model.records[entry.offenseId]?.citation ?? "—")}\``,
        escapePipes(truncate(entry.offense?.description, 60)),
      ])
    );
  }
  if (subsectionMissing.length > 60) push(`\n_${subsectionMissing.length - 60} further records omitted from this table; the full list is in \`src/data/enrichment/manifest.json\`._`);
});

section(`Sections amended since ${SOURCE_EDITION.label} (${amendedSinceSource.length})`, () => {
  if (!amendedSinceSource.length) {
    push(`No retrieved section carries a Public Act effective after ${SOURCE_EDITION.label}.`);
    return;
  }
  push(
    `Each of these sections carries a Public Act with an effective date after the source publication, so its text has changed since the 2024 index was compiled. This does not mean the record's description is wrong — many amendments do not touch the elements a description summarises — but each one is a candidate for review, newest first.`
  );
  push("");
  push(row(["Effective", "Public Act", "Citation", "Records", "Heading"]));
  push(row(["---", "---", "---", "---:", "---"]));
  for (const entry of amendedSinceSource) {
    push(
      row([
        entry.newest.parsed.iso,
        `\`${entry.newest.publicAct}\``,
        `[\`${entry.section.citation}\`](${entry.section.ilgaUrl})`,
        entry.section.offenseIds.length,
        escapePipes(truncate(entry.section.headingText, 60)),
      ])
    );
  }
});

section(`Records with no statutory section (${notApplicable.length})`, () => {
  if (!notApplicable.length) {
    push(`None.`);
    return;
  }
  push(`These rows carry no citation in the source publication and are guidance text rather than distinct charging sections. They are left unmapped deliberately.`);
  push("");
  push(row(["Record", "Description", "Rationale"]));
  push(row(["---", "---", "---"]));
  for (const entry of notApplicable) {
    push(row([`\`${entry.offenseId}\``, escapePipes(truncate(entry.offense?.description, 60)), escapePipes(truncate(entry.entry.rationale, 110))]));
  }
});

section(`Researched, awaiting legal review (${needsLegalReview.length})`, () => {
  if (!needsLegalReview.length) {
    push(`None.`);
    return;
  }
  push(
    `These citations were researched and deliberately left unresolved. Each one turns on a legal question — whether a repealed provision has a successor, and which — rather than a citation-format correction, so no mapping is asserted here. The research is recorded so it does not have to be repeated.`
  );
  push("");
  for (const entry of needsLegalReview) {
    push(`**\`${escapePipes(entry.entry.code ?? "—")}\`** · ${escapePipes(truncate(entry.offense?.description, 90))} (\`${entry.offenseId}\`)`);
    push("");
    push(`${escapePipes(entry.entry.rationale)}`);
    if (entry.entry.research) {
      const research = Object.entries(entry.entry.research)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" · ");
      push("");
      push(`_${escapePipes(research)}_`);
    }
    push("");
  }
});

section(`Unresolved citations (${unresolvedRecords.length})`, () => {
  if (!unresolvedRecords.length) {
    push(`None. Every record either resolves to a section or is recorded as having none.`);
    return;
  }
  push(row(["Record", "Citation in source", "Reason"]));
  push(row(["---", "---", "---"]));
  for (const entry of unresolvedRecords) {
    push(row([`\`${entry.offenseId}\``, `\`${escapePipes(entry.entry.code ?? "—")}\``, `\`${entry.entry.reason}\``]));
  }
});

push(`## What this report does not establish`);
push("");
push(`- It does not confirm that a record's description matches the section it cites. Comparing a 2024 one-line description against current statutory language is a reading task, not a string comparison.`);
push(`- It does not confirm classification, penalty, or court-appearance consequences. Those were not retrieved.`);
push(`- It does not detect an amendment that changed a section's meaning without changing its Public Act line, nor one whose effective date precedes ${SOURCE_EDITION.label}.`);
push(`- A section marked \`retrieved\` is not thereby correct, current for your purposes, or applicable to any particular set of facts.`);
push("");
push(`Verify against the official source before relying on any record. Each finding links to ILGA directly.`);
push("");

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${lines.join("\n")}\n`);

console.log(`Wrote ${path.relative(root, OUTPUT_PATH)}`);
console.log(`  ${unavailable.length} unavailable · ${repealed.length} repealed · ${mismatched.length} citation-mismatch`);
console.log(`  ${subsectionMissing.length} records cite a subsection no longer present`);
console.log(`  ${amendedSinceSource.length} sections amended since ${SOURCE_EDITION.label} (${recordsAffectedBy(amendedSinceSource)} records affected)`);
console.log(`  ${unresolvedRecords.length} unresolved · ${notApplicable.length} not applicable · ${needsLegalReview.length} awaiting legal review`);
