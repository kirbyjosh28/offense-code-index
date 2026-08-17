import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDocName,
  citationMatches,
  extractStatutoryText,
  formatCitation,
  hashStatutoryBody,
  parseCitation,
  parseEffectiveDate,
  parsePublicActs,
  sectionKeyFor,
  splitSubsections,
  subsectionPresent,
} from "../scripts/lib/ilga.mjs";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "ilga"
);
const loadFixture = (name) => readFile(path.join(fixtures, `${name}.html`), "utf8");

test("builds ILGA DocName tokens across chapters and acts", () => {
  assert.equal(buildDocName({ chapterId: "625", actId: "5", sectionId: "11-709" }), "062500050K11-709");
  assert.equal(buildDocName({ chapterId: "720", actId: "5", sectionId: "12-3.2" }), "072000050K12-3.2");
  assert.equal(buildDocName({ chapterId: "720", actId: "570", sectionId: "402" }), "072005700K402");
  assert.equal(buildDocName({ chapterId: "810", actId: "5", sectionId: "9-315.01" }), "081000050K9-315.01");
  assert.throws(() => buildDocName({ chapterId: "625", actId: "5" }), /requires/);
  assert.throws(() => buildDocName({ chapterId: "62A", actId: "5", sectionId: "1" }), /Non-numeric/);
});

test("derives stable section keys and canonical citations", () => {
  const identity = { chapterId: "625", actId: "5", sectionId: "11-501" };
  assert.equal(sectionKeyFor(identity), "0625-0005-11-501");
  assert.equal(formatCitation(identity), "625 ILCS 5/11-501");
});

test("splits subsections and preserves ranges verbatim", () => {
  assert.deepEqual(splitSubsections("11-501(a)(1)"), {
    sectionId: "11-501",
    subsectionPath: ["a", "1"],
    subsectionRange: null,
  });
  assert.deepEqual(splitSubsections("3-101"), {
    sectionId: "3-101",
    subsectionPath: [],
    subsectionRange: null,
  });
  // Deciding which subsections a range covers is a legal reading, not a string operation.
  assert.deepEqual(splitSubsections("24-1(A)(1)-(12)"), {
    sectionId: "24-1",
    subsectionPath: ["A", "1"],
    subsectionRange: "(A)(1)-(12)",
  });
});

test("parses fully qualified citations and refuses to guess at the rest", () => {
  assert.deepEqual(parseCitation("625 ILCS 40/5-7(a)(3.1)"), {
    resolution: "parsed",
    chapterId: "625",
    actId: "40",
    sectionId: "5-7",
    subsectionPath: ["a", "3.1"],
    subsectionRange: null,
  });

  // A stray leading separator is a source typo, not a section named "-4-1".
  assert.equal(parseCitation("625 ILCS 40/-4-1").resolution, "unresolved");
  assert.equal(parseCitation("625 ILCS 40/-4-1").reason, "malformed-section");

  // No chapter or act anywhere in the record: a human has to map this one.
  assert.equal(parseCitation("Section 9-315.01").reason, "no-chapter-or-act");
  assert.equal(parseCitation("").reason, "empty-citation");
  assert.equal(parseCitation(null).reason, "empty-citation");

  // A bare code resolves only when the caller supplies an act it has established.
  assert.equal(parseCitation("3-101").resolution, "unresolved");
  assert.deepEqual(parseCitation("3-101", { defaultChapterId: "625", defaultActId: "5" }), {
    resolution: "inferred",
    chapterId: "625",
    actId: "5",
    sectionId: "3-101",
    subsectionPath: [],
    subsectionRange: null,
  });
});

test("extracts structured blocks rather than markup", async () => {
  const result = extractStatutoryText(await loadFixture("vehicle-11-709"));

  assert.equal(result.available, true);
  assert.equal(result.canonicalCitation, "625 ILCS 5/11-709");
  assert.match(result.headingText, /^Sec\. 11-709\. Driving on roadways laned for traffic\./);
  assert.equal(result.repealed, false);

  // No block may carry markup or raw entities across the boundary: the client renders
  // these with createElement/textContent under a Trusted Types CSP.
  for (const block of result.blocks) {
    assert.doesNotMatch(block.text, /<[^>]+>/, `block leaked markup: ${block.text.slice(0, 60)}`);
    assert.doesNotMatch(block.text, /&(#x?[0-9a-f]+|[a-z]+);/i, `block leaked an entity: ${block.text.slice(0, 60)}`);
  }

  const labels = result.blocks.filter((block) => block.type === "subsection").map((block) => block.label);
  assert.deepEqual(labels, ["(a)", "(b)", "(c)", "(d)", "(e)"]);
  assert.equal(result.blocks.filter((block) => block.type === "source").length, 1);
});

test("separates Public Acts from the statutory body", async () => {
  const result = extractStatutoryText(await loadFixture("vehicle-11-709"));

  assert.deepEqual(result.publicActs, [{ publicAct: "101-173", effectiveDate: "1-1-20" }]);
  // The Source line is provenance about the body, not part of it.
  assert.doesNotMatch(result.bodyText, /\(Source:/);
  assert.match(result.sourceLine, /^\(Source: P\.A\. 101-173/);
});

test("reads every Public Act from a semicolon-separated Source line", async () => {
  const result = extractStatutoryText(await loadFixture("criminal-12-3.2-multi-act"));

  assert.equal(result.canonicalCitation, "720 ILCS 5/12-3.2");
  assert.deepEqual(result.publicActs, [
    { publicAct: "97-1109", effectiveDate: "1-1-13" },
    { publicAct: "98-187", effectiveDate: "1-1-14" },
    { publicAct: "98-994", effectiveDate: "1-1-15" },
  ]);

  // An effective date such as "1-1-14" must never be mistaken for an act number.
  assert.deepEqual(parsePublicActs("(Source: P.A. 103-605, eff. 7-1-24; revised 8-1-24.)"), [
    { publicAct: "103-605", effectiveDate: "7-1-24" },
  ]);
  assert.deepEqual(parsePublicActs(null), []);
});

test("treats ILGA's in-band unavailable notice as a failure despite HTTP 200", async () => {
  // ILGA answers 200 for sections that do not exist. The status line is not a validity
  // signal; if this ever regresses, nonexistent sections would be stored as verified.
  const result = extractStatutoryText(await loadFixture("unavailable"));

  assert.equal(result.available, false);
  assert.equal(result.reason, "not-available");
  assert.deepEqual(result.blocks, []);
  assert.equal(result.bodyText, "");
});

test("rejects empty and structurally unrecognized responses", () => {
  assert.equal(extractStatutoryText("").reason, "empty-response");
  assert.equal(extractStatutoryText(null).reason, "empty-response");
  assert.equal(extractStatutoryText("<html><body>unrelated</body></html>").reason, "no-statute-container");
});

test("confirms ILGA returned the section that was requested", async () => {
  const result = extractStatutoryText(await loadFixture("snowmobile-5-7"));

  assert.equal(citationMatches(result.canonicalCitation, { chapterId: "625", actId: "40", sectionId: "5-7" }), true);
  assert.equal(citationMatches(result.canonicalCitation, { chapterId: "625", actId: "5", sectionId: "5-7" }), false);
  assert.equal(citationMatches(null, { chapterId: "625", actId: "40", sectionId: "5-7" }), false);
});

test("detects whether a cited subsection still exists in the fetched section", async () => {
  const result = extractStatutoryText(await loadFixture("vehicle-11-709"));

  assert.equal(subsectionPresent(result.blocks, ["a"]), true);
  assert.equal(subsectionPresent(result.blocks, ["e"]), true);
  // 11-709 has no subsection (z); a record citing one would need review.
  assert.equal(subsectionPresent(result.blocks, ["z"]), false);
  assert.equal(subsectionPresent(result.blocks, []), null);
});

test("hashes the statutory body stably and independently of the Source line", async () => {
  const result = extractStatutoryText(await loadFixture("vehicle-11-709"));
  const hash = hashStatutoryBody(result.bodyText);

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashStatutoryBody(result.bodyText));
  // Whitespace reflow on ILGA's side must not read as an amendment.
  assert.equal(hash, hashStatutoryBody(`  ${result.bodyText.replace(/\n/g, "\n  ")}  `));
  // A genuine wording change must.
  assert.notEqual(hash, hashStatutoryBody(result.bodyText.replace("shall", "may")));
});

test("subsection detection handles both ILCS labelling conventions", () => {
  // "(a) ..." and "A. ..." both occur in ILCS, sometimes within one act. Recognising
  // only the parenthesized form reported nine live snowmobile subsections as repealed.
  const lettered = [
    { type: "heading", text: "Sec. 5-1. Operation Generally. It is unlawful to operate a snowmobile in the following ways:" },
    { type: "paragraph", text: "A. At a rate of speed too fast for conditions." },
    { type: "paragraph", text: "B. In a careless, reckless, or negligent manner." },
    { type: "paragraph", text: "C. (Blank)" },
  ];
  assert.equal(subsectionPresent(lettered, ["A"]), true);
  assert.equal(subsectionPresent(lettered, ["b"]), true);
  assert.equal(subsectionPresent(lettered, ["Z"]), false);

  // Parenthesized labels are matched anywhere, because ILGA runs subsections together.
  const runTogether = [{ type: "paragraph", text: "(a) One thing. (b) Another thing." }];
  assert.equal(subsectionPresent(runTogether, ["b"]), true);
  assert.equal(subsectionPresent(runTogether, ["c"]), false);
});

test("two-digit effective dates resolve to the right century", () => {
  // Reading every two-digit year as 20xx put "8-13-99" in 2099 and filled the audit's
  // "amended since February 2024" table with 1990s amendments, sorted to the top.
  assert.equal(parseEffectiveDate("1-1-25").iso, "2025-01-01");
  assert.equal(parseEffectiveDate("7-1-24").iso, "2024-07-01");
  assert.equal(parseEffectiveDate("8-13-99").iso, "1999-08-13");
  assert.equal(parseEffectiveDate("1-24-95").iso, "1995-01-24");
  assert.equal(parseEffectiveDate("1-1-72").iso, "1972-01-01");
  // Four-digit years are taken as written.
  assert.equal(parseEffectiveDate("6-1-2024").iso, "2024-06-01");

  assert.equal(parseEffectiveDate(null), null);
  assert.equal(parseEffectiveDate("not a date"), null);
});

test("no swept Public Act claims an effective date in the future", async () => {
  // A regression here means the audit is reporting amendments that have not happened.
  const dir = path.join(fixtures, "..", "..", "..", "src", "data", "enrichment", "sections");
  const { readdir } = await import("node:fs/promises");
  let files = [];
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
  } catch {
    return; // No sweep results on disk; nothing to check.
  }

  const horizon = new Date().getFullYear() + 2;
  for (const file of files) {
    const section = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    for (const act of section.publicActs ?? []) {
      const parsed = parseEffectiveDate(act.effectiveDate);
      if (!parsed) continue;
      assert.ok(
        parsed.year <= horizon,
        `${section.citation} P.A. ${act.publicAct} parsed "${act.effectiveDate}" as ${parsed.iso}`
      );
    }
  }
});
