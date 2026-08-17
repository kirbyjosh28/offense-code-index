import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILIES, familyFor, familyFromCitation, familyFromPagePosition } from "../src/family.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (...segments) => JSON.parse(await readFile(path.join(root, ...segments), "utf8"));

const corpus = await readJson("src", "data", "offense-codes.json");
const model = await readJson("src", "data", "enrichment", "citation-model.json");

test("facets come from the record's actual act once a citation is known", () => {
  assert.equal(familyFromCitation("720 ILCS 5/12-3.2"), "Criminal Code");
  assert.equal(familyFromCitation("720 ILCS 570/402"), "Drugs & public health");
  assert.equal(familyFromCitation("625 ILCS 40/5-7"), "Recreation vehicles");
  assert.equal(familyFromCitation("625 ILCS 5/11-501"), "Vehicle Code");
  assert.equal(familyFromCitation("810 ILCS 5/9-315.01"), "Other Illinois statutes");
  assert.equal(familyFromCitation("15 ILCS 335/14"), "Other Illinois statutes");
});

test("the citation model corrects exactly the records the page heuristic mislabels", () => {
  // The heuristic reads "printed in the Vehicle Code page range" as "is Vehicle Code".
  // Two acts are printed inside that range and are neither 625 ILCS 5.
  const reclassified = [];
  for (const offense of corpus.offenses) {
    const citation = model.records[offense.id]?.citation;
    const before = familyFromPagePosition(offense);
    const after = citation ? familyFromCitation(citation, offense.chapter) : before;
    if (before !== after) reclassified.push({ id: offense.id, citation, before, after });
  }

  assert.deepEqual(
    reclassified.map((entry) => entry.id),
    [
      "offense-0170", // 15 ILCS 335/14   Illinois Identification Card Act
      "offense-0171", // 15 ILCS 335/14A
      "offense-0172", // 15 ILCS 335/14B
      "offense-0173", // 15 ILCS 335/14C
      "offense-0479", // 625 ILCS 25/4    Child Passenger Protection Act
      "offense-0480", // 625 ILCS 25/4a
      "offense-0481", // 625 ILCS 25/4b
    ]
  );
  for (const entry of reclassified) {
    assert.equal(entry.before, "Vehicle Code");
    assert.equal(entry.after, "Other Illinois statutes");
    assert.doesNotMatch(entry.citation, /^625 ILCS 5\//, `${entry.id} is not actually Vehicle Code`);
  }
});

test("every record lands in a facet the filter offers", () => {
  const allowed = new Set(FAMILIES);
  for (const offense of corpus.offenses) {
    const citation = model.records[offense.id]?.citation;
    const family = familyFor({ ...offense, citation });
    assert.ok(allowed.has(family), `${offense.id} produced an unknown facet: ${family}`);
  }
});

test("records with no citation keep their original facet exactly", () => {
  for (const offense of corpus.offenses) {
    assert.equal(familyFor(offense), familyFromPagePosition(offense), `${offense.id} drifted without a citation`);
  }
});
