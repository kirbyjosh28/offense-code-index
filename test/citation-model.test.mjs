import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDocName, formatCitation, sectionKeyFor } from "../scripts/lib/ilga.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (...segments) => JSON.parse(await readFile(path.join(root, ...segments), "utf8"));

const model = await readJson("src", "data", "enrichment", "citation-model.json");
const corpus = await readJson("src", "data", "offense-codes.json");
const overrides = await readJson("content", "mappings", "citation-overrides.json");
const sourceVersion = await readJson("config", "source-version.json");

test("the frozen corpus is untouched by the enrichment layer", async () => {
  // The corpus is hash-pinned provenance for a specific published document. If the
  // enrichment work ever edits it, the source publication can no longer be evidenced.
  const bytes = await readFile(path.join(root, "src", "data", "offense-codes.json"));
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  assert.equal(sha256, sourceVersion.corpus.sha256);
  assert.equal(sha256, model.generatedFrom.corpusSha256);
  assert.equal(corpus.offenses.length, 953);
});

test("the citation model covers every corpus record and invents none", () => {
  const corpusIds = new Set(corpus.offenses.map((offense) => offense.id));
  const modelIds = Object.keys(model.records);

  assert.equal(modelIds.length, corpus.offenses.length);
  for (const id of modelIds) {
    assert.ok(corpusIds.has(id), `citation model references unknown record ${id}`);
  }
  for (const id of corpusIds) {
    assert.ok(model.records[id], `citation model is missing record ${id}`);
  }
});

test("every record is resolved or explicitly recorded as having no section", () => {
  assert.equal(model.counts.unresolved, 0, "unresolved records need a reviewed override");

  for (const [id, entry] of Object.entries(model.records)) {
    assert.ok(
      ["parsed", "inferred", "override", "not-applicable", "needs-legal-review"].includes(entry.resolution),
      `${id} has unexpected resolution ${entry.resolution}`
    );
    if (entry.resolution === "not-applicable" || entry.resolution === "needs-legal-review") {
      // Deliberately unresolved. The rationale is the whole point: it stops the next
      // person re-doing the research and re-reaching the same dead end.
      assert.ok(entry.rationale, `${id} is ${entry.resolution} but records no rationale`);
      assert.equal(entry.sectionKey, undefined);
    } else {
      assert.match(entry.sectionKey, /^\d{4}-\d{4}-\S+$/);
      assert.match(entry.citation, /^\d+ ILCS \d+\/\S+$/);
    }
  }
});

test("derived identifiers agree with the shared citation helpers", () => {
  for (const [id, entry] of Object.entries(model.records)) {
    if (!entry.sectionKey) continue;
    const identity = { chapterId: entry.chapterId, actId: entry.actId, sectionId: entry.sectionId };
    assert.equal(entry.sectionKey, sectionKeyFor(identity), `${id} sectionKey drifted`);
    assert.equal(entry.citation, formatCitation(identity), `${id} citation drifted`);
  }
});

test("record citations preserve the subsection the source publication cited", () => {
  // Collapsing "11-501(a)(1)" to "11-501" would silently break exact-code search.
  for (const [id, entry] of Object.entries(model.records)) {
    if (!entry.fullCitation) continue;
    assert.ok(entry.fullCitation.startsWith(entry.citation), `${id} fullCitation lost its section`);

    if (entry.subsectionRange) {
      assert.equal(entry.fullCitation, `${entry.citation}${entry.subsectionRange}`);
    } else if (entry.subsectionPath.length) {
      const suffix = entry.subsectionPath.map((part) => `(${part})`).join("");
      assert.equal(entry.fullCitation, `${entry.citation}${suffix}`, `${id} lost subsections`);
    } else {
      assert.equal(entry.fullCitation, entry.citation);
    }
  }
});

test("sections index back to the records that cite them", () => {
  const sectionKeys = new Set(Object.keys(model.sections));

  for (const [key, section] of Object.entries(model.sections)) {
    assert.equal(section.sectionKey, key);
    assert.equal(section.docName, buildDocName(section));
    assert.ok(section.offenseIds.length > 0, `${key} has no citing records`);
    for (const id of section.offenseIds) {
      assert.equal(model.records[id].sectionKey, key, `${id} disagrees with section ${key}`);
    }
  }

  for (const [id, entry] of Object.entries(model.records)) {
    if (!entry.sectionKey) continue;
    assert.ok(sectionKeys.has(entry.sectionKey), `${id} points at unknown section ${entry.sectionKey}`);
  }

  assert.equal(Object.keys(model.sections).length, model.counts.distinctSections);
});

test("bare Vehicle Code codes are inferred only under Vehicle Code chapter headings", () => {
  // The page-position heuristic this replaced treats anything printed in the Vehicle
  // Code page range as 625 ILCS 5, which is wrong for acts printed inside that range.
  const offenseById = new Map(corpus.offenses.map((offense) => [offense.id, offense]));

  for (const [id, entry] of Object.entries(model.records)) {
    if (entry.resolution !== "inferred") continue;
    const offense = offenseById.get(id);

    assert.equal(entry.chapterId, "625");
    assert.equal(entry.actId, "5");
    assert.doesNotMatch(offense.chapter, /ILCS/i, `${id} inferred Vehicle Code under an act-naming heading`);

    const headingChapter = /^CHAPTER\s+(\d+[a-z]?)\s*-/i.exec(offense.chapter);
    assert.ok(headingChapter, `${id} inferred from an unrecognized chapter heading`);
    assert.ok(
      entry.sectionId.toLowerCase().startsWith(headingChapter[1].toLowerCase()),
      `${id}: code ${entry.sectionId} does not match heading ${offense.chapter}`
    );
  }
});

test("every manual override records the evidence that justified it", () => {
  // An override without evidence is a guess, and a guess about which statute an officer
  // is looking at is exactly what this project exists to eliminate.
  for (const [id, override] of Object.entries(overrides.overrides)) {
    assert.ok(model.records[id], `override targets unknown record ${id}`);
    assert.ok(override.rationale && override.rationale.length > 40, `${id} override lacks a rationale`);

    if (override.resolution === "not-applicable") continue;

    // Researched but deliberately unresolved: it must show its work without asserting
    // a mapping the evidence does not support.
    if (override.resolution === "needs-legal-review") {
      assert.ok(override.research, `${id} claims legal review is needed but records no research`);
      assert.match(override.research.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(model.records[id].sectionKey, undefined, `${id} must not resolve to a section`);
      continue;
    }

    assert.equal(override.resolution, "override");
    assert.ok(override.evidence, `${id} override records no evidence`);
    assert.match(override.evidence.canonicalCitation, /^\d+ ILCS \d+\/\S+$/);
    assert.match(override.evidence.retrievedFrom, /^https:\/\/www\.ilga\.gov\//);
    assert.match(override.evidence.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(override.evidence.headingText, `${id} override records no heading text`);

    // The evidence must describe the section the model actually resolved to.
    assert.equal(model.records[id].citation, override.evidence.canonicalCitation);
  }
});

test("resolution counts match the records they summarize", () => {
  const tally = {};
  for (const entry of Object.values(model.records)) {
    tally[entry.resolution] = (tally[entry.resolution] ?? 0) + 1;
  }

  for (const [resolution, count] of Object.entries(tally)) {
    assert.equal(model.counts[resolution], count, `counts.${resolution} disagrees with the records`);
  }
  assert.equal(
    model.counts.parsed +
      model.counts.inferred +
      model.counts.override +
      model.counts["not-applicable"] +
      model.counts["needs-legal-review"],
    corpus.offenses.length
  );
});
