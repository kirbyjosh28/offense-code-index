import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clausesOf, elementsFor, emphasize, isException, operativeBlock } from "../src/elements.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (...parts) => JSON.parse(await readFile(path.join(root, ...parts), "utf8"));

const model = await readJson("src", "data", "enrichment", "citation-model.json");
const sections = new Map();
for (const file of await readdir(path.join(root, "src", "data", "enrichment", "sections"))) {
  if (!file.endsWith(".json")) continue;
  const section = await readJson("src", "data", "enrichment", "sections", file);
  sections.set(section.sectionKey, section);
}

/** Every record the interface will actually render a panel for. */
const rendered = [];
for (const [offenseId, record] of Object.entries(model.records)) {
  if (!record.sectionKey) continue;
  const section = sections.get(record.sectionKey);
  if (!section) continue;
  const result = elementsFor({
    blocks: section.blocks,
    subsectionPath: record.subsectionPath ?? [],
    citation: record.citation,
  });
  if (result) rendered.push({ offenseId, record, section, result });
}

const flatten = (section) => section.blocks.map((block) => block.text).join(" ").replace(/\s+/g, " ");

test("the corpus renders elements for the expected number of records", () => {
  assert.ok(rendered.length > 800, `expected 800+ rendering records, got ${rendered.length}`);
});

test("every element and exception is verbatim statutory text", () => {
  // The whole product rests on this: officers review the statute, not a paraphrase of
  // it. A single non-verbatim clause would make that claim false everywhere.
  for (const { record, section, result } of rendered) {
    const haystack = flatten(section);
    for (const clause of [...result.elements, ...result.exceptions]) {
      assert.ok(
        haystack.includes(clause.replace(/\s+/g, " ")),
        `${record.fullCitation}: clause is not verbatim — "${clause.slice(0, 80)}"`
      );
    }
  }
});

test("sourceMapping anchors every displayed clause to its statute", () => {
  for (const { record, section, result } of rendered) {
    const haystack = flatten(section);
    const displayed = [...result.elements, ...result.exceptions];
    assert.equal(result.sourceMapping.length, displayed.length);
    for (const mapping of result.sourceMapping) {
      assert.equal(mapping.statuteSource, record.citation);
      assert.ok(haystack.includes(mapping.sourceText.replace(/\s+/g, " ")));
    }
  }
});

test("no clause is a dangling cross-reference fragment", () => {
  // Splitting at every "(4)" once produced "(4) of subsection (a) shall constitute a
  // failure to keep records", which reads as though it were the offence itself.
  for (const { record, result } of rendered) {
    for (const clause of [...result.elements, ...result.exceptions]) {
      assert.doesNotMatch(
        clause,
        /^\(\d+\)\s+of\s+(subsection|paragraph|section)/i,
        `${record.fullCitation}: fragment — "${clause.slice(0, 80)}"`
      );
    }
  }
});

test("a panel is never empty", () => {
  // Some provisions are wholly about when they do not apply. Classifying every clause as
  // an exception would leave the elements list blank.
  for (const { record, result } of rendered) {
    assert.ok(result.elements.length > 0, `${record.fullCitation}: no elements`);
  }
});

test("a leading cross-reference stays with the duty it qualifies", () => {
  // ILCS opens operative sentences with "Except as provided in Section X, ...". Treating
  // that as an exception moved 3-101's actual duty out of the elements entirely.
  const duty =
    "Except as provided in Section 3-102, every owner of a vehicle which is in this State and for which no Illinois certificate of title has been issued by the Secretary of State shall make application to the Secretary of State for an Illinois certificate of title of the vehicle.";
  assert.equal(isException(duty), false);

  assert.equal(isException("This Section does not apply to authorized emergency vehicles."), true);
  assert.equal(isException("Nothing in this Section shall be construed to limit..."), true);
  assert.equal(isException("Unless otherwise expressly authorized by this Code, all other lighting..."), true);
});

test("emphasis never alters a character of the statute", () => {
  for (const { record, result } of rendered) {
    for (const clause of [...result.elements, ...result.exceptions]) {
      const rebuilt = emphasize(clause).map((segment) => segment.text).join("");
      assert.equal(rebuilt, clause, `${record.fullCitation}: emphasis changed the text`);
    }
  }
});

test("emphasis marks the qualifiers an officer has to satisfy", () => {
  const segments = emphasize("No person shall knowingly drive more than 25 miles per hour without a licence");
  const marked = segments.filter((segment) => segment.emphasis).map((segment) => segment.text.toLowerCase());
  assert.deepEqual(marked, ["no person", "knowingly", "more than", "without"]);
});

test("a record only claims to show the cited provision when it found it", () => {
  // Falling back to the section's opening provision and labelling it as the cited one
  // claims a precision the data does not have.
  for (const { record, result } of rendered) {
    if (!record.subsectionPath?.length) {
      assert.equal(result.exact, false, `${record.fullCitation}: claimed exact without a cited subsection`);
      assert.equal(result.citedSubsection, null);
    }
  }
  const withSubsection = rendered.filter(({ result }) => result.exact);
  assert.ok(withSubsection.length > 100, `expected many exact matches, got ${withSubsection.length}`);
});

test("omitted clauses are counted rather than dropped silently", () => {
  for (const { result } of rendered) {
    assert.ok(Number.isInteger(result.truncated) && result.truncated >= 0);
  }
  assert.ok(rendered.some(({ result }) => result.truncated > 0), "expected some records to omit clauses");
});

test("splitting only cuts at statutory punctuation", () => {
  assert.deepEqual(clausesOf("(a) One duty; a second duty."), ["One duty;", "a second duty."]);
  // A cross-reference is not a list.
  assert.deepEqual(
    clausesOf("(b) A person who violates paragraph (3) or (4) of subsection (a) is guilty."),
    ["A person who violates paragraph (3) or (4) of subsection (a) is guilty."]
  );
});

test("operativeBlock reports how deep it actually matched", () => {
  const blocks = [
    { type: "subsection", label: "(a)", text: "(a) First." },
    { type: "subsection", label: "(b)", text: "(b) Second:" },
    { type: "subsection", label: "(1)", text: "(1) Nested." },
  ];
  assert.equal(operativeBlock(blocks, ["b", "1"]).matchedDepth, 2);
  // (b)(9) is not served separately, so only the parent was reached.
  assert.equal(operativeBlock(blocks, ["b", "9"]).matchedDepth, 1);
  assert.equal(operativeBlock(blocks, []).requestedDepth, 0);
});
