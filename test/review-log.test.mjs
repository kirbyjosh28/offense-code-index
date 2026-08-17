import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createEntry,
  entryHashFor,
  latestDecisions,
  publishableState,
  sha256,
  verifyChain,
} from "../scripts/lib/review-log.mjs";
import { validateEnrichment } from "../scripts/validate-enrichment.mjs";

const review = (overrides = {}) => ({
  offenseId: "offense-0142",
  draftSha256: sha256("draft"),
  sectionSha256: sha256("statute"),
  reviewer: "A. Reviewer",
  reviewedAt: "2026-09-02",
  decision: "verified",
  ...overrides,
});

test("a review entry must identify the bytes and the person behind it", () => {
  assert.throws(() => createEntry(review({ offenseId: "" })), /must name the record/);
  assert.throws(() => createEntry(review({ decision: "looks-fine" })), /unsupported review decision/);
  assert.throws(() => createEntry(review({ draftSha256: "abc" })), /draftSha256 must be a SHA-256/);
  assert.throws(() => createEntry(review({ sectionSha256: "abc" })), /sectionSha256 must be a SHA-256/);
  assert.throws(() => createEntry(review({ reviewedAt: "Sept 2" })), /reviewedAt must be an ISO date/);
  assert.throws(() => createEntry(review({ reviewer: "   " })), /must record who performed it/);
});

test("entries chain to their predecessor and hash their own contents", () => {
  const first = createEntry(review());
  const second = createEntry(review({ offenseId: "offense-0143" }), first);

  assert.equal(first.seq, 1);
  assert.equal(first.prev, null);
  assert.equal(second.seq, 2);
  assert.equal(second.prev, first.entryHash);
  assert.equal(verifyChain([first, second]).ok, true);
});

test("editing a signed entry breaks its hash", () => {
  const first = createEntry(review());
  const second = createEntry(review({ offenseId: "offense-0143" }), first);

  // Someone quietly upgrades a rejection to an approval.
  const tampered = { ...first, decision: "verified", reviewer: "Someone Else" };
  const result = verifyChain([tampered, second]);

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => /do not match entryHash/.test(failure)));
});

test("removing an entry breaks the chain", () => {
  const first = createEntry(review());
  const second = createEntry(review({ offenseId: "offense-0143" }), first);
  const third = createEntry(review({ offenseId: "offense-0144" }), second);

  const result = verifyChain([first, third]);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => /seq is 3, expected 2/.test(failure)));
  assert.ok(result.failures.some((failure) => /does not link to the preceding entry/.test(failure)));
});

test("the latest decision for a record wins, so approval can be withdrawn", () => {
  const approved = createEntry(review());
  const withdrawn = createEntry(review({ decision: "withdrawn" }), approved);
  const decisions = latestDecisions([approved, withdrawn]);

  assert.equal(decisions.get("offense-0142").decision, "withdrawn");
  assert.equal(publishableState({
    decision: decisions.get("offense-0142"),
    draftText: "draft",
    sectionBodyText: "statute",
  }).publishable, false);
});

test("an approval does not survive a change to the draft or to the statute", () => {
  const decision = createEntry(review());

  assert.equal(
    publishableState({ decision, draftText: "draft", sectionBodyText: "statute" }).publishable,
    true
  );

  // Someone edits the approved wording.
  const editedDraft = publishableState({ decision, draftText: "draft, revised", sectionBodyText: "statute" });
  assert.equal(editedDraft.publishable, false);
  assert.match(editedDraft.reason, /draft has changed/);

  // Illinois amends the statute the wording was derived from.
  const amended = publishableState({ decision, draftText: "draft", sectionBodyText: "statute as amended" });
  assert.equal(amended.publishable, false);
  assert.match(amended.reason, /statutory text has changed/);

  // Nothing is publishable without a recorded review at all.
  assert.equal(publishableState({ decision: null, draftText: "draft", sectionBodyText: "statute" }).publishable, false);
});

test("the checked-in project has no generated content and validates cleanly", async () => {
  // This is the expected state: the machinery exists, nothing has been drafted, and
  // nothing claims review.
  const result = await validateEnrichment();

  assert.equal(result.ok, true, `enrichment validation failed: ${result.failures.join("; ")}`);
  assert.equal(result.drafts, 0);
  assert.equal(result.publishable, 0);
});

test("a quick element that misquotes the statute is rejected", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "enrichment-"));
  await mkdir(path.join(base, "content", "drafts"), { recursive: true });
  await mkdir(path.join(base, "src", "data", "enrichment", "sections"), { recursive: true });

  await writeFile(
    path.join(base, "src", "data", "enrichment", "citation-model.json"),
    JSON.stringify({ records: { "offense-0001": { sectionKey: "0625-0005-11-709", citation: "625 ILCS 5/11-709" } } })
  );
  await writeFile(
    path.join(base, "src", "data", "enrichment", "sections", "0625-0005-11-709.json"),
    JSON.stringify({
      sectionKey: "0625-0005-11-709",
      blocks: [
        { type: "heading", text: "Sec. 11-709. Driving on roadways laned for traffic." },
        { type: "subsection", label: "(a)", text: "(a) A vehicle shall be driven as nearly as practicable entirely within a single lane." },
        { type: "source", text: "(Source: P.A. 101-173, eff. 1-1-20.)" },
      ],
    })
  );

  await writeFile(
    path.join(base, "content", "drafts", "offense-0001.json"),
    JSON.stringify({
      quickElements: ["Vehicle stays within a single lane", "Driver must signal for 200 feet"],
      sourceMapping: [
        // Anchored verbatim — acceptable.
        { element: "Vehicle stays within a single lane", sourceText: "entirely within a single lane" },
        // Plausible, statutory-sounding, and not in this section at all.
        { element: "Driver must signal for 200 feet", sourceText: "signal continuously for 200 feet" },
      ],
    })
  );

  const result = await validateEnrichment({ root: base });

  assert.equal(result.ok, false);
  assert.equal(result.drafts, 1);
  assert.ok(
    result.failures.some((failure) => /quotes text that does not appear in 625 ILCS 5\/11-709/.test(failure)),
    `expected a verbatim-anchor failure, got: ${result.failures.join("; ")}`
  );
});

test("a quick element with no source mapping at all is rejected", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "enrichment-"));
  await mkdir(path.join(base, "content", "drafts"), { recursive: true });
  await mkdir(path.join(base, "src", "data", "enrichment", "sections"), { recursive: true });

  await writeFile(
    path.join(base, "src", "data", "enrichment", "citation-model.json"),
    JSON.stringify({ records: { "offense-0001": { sectionKey: "0625-0005-11-709", citation: "625 ILCS 5/11-709" } } })
  );
  await writeFile(
    path.join(base, "src", "data", "enrichment", "sections", "0625-0005-11-709.json"),
    JSON.stringify({
      sectionKey: "0625-0005-11-709",
      blocks: [{ type: "subsection", label: "(a)", text: "(a) A vehicle shall be driven within a single lane." }],
    })
  );
  await writeFile(
    path.join(base, "content", "drafts", "offense-0001.json"),
    JSON.stringify({ quickElements: ["Driver was impaired"], sourceMapping: [] })
  );

  const result = await validateEnrichment({ root: base });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => /not anchored to any statutory text/.test(failure)));
});

test("entry hashes are stable and order-independent of object key order", () => {
  const entry = createEntry(review());
  const reordered = {
    entryHash: entry.entryHash,
    prev: entry.prev,
    notes: entry.notes,
    decision: entry.decision,
    reviewedAt: entry.reviewedAt,
    reviewer: entry.reviewer,
    sectionSha256: entry.sectionSha256,
    draftSha256: entry.draftSha256,
    offenseId: entry.offenseId,
    seq: entry.seq,
  };
  assert.equal(entryHashFor(reordered), entry.entryHash);
});

test("a verified draft stops being publishable once its statute is amended", async () => {
  // The end-to-end path the review design exists for: the approval stays on file, the
  // content stops shipping, and the reason is reported rather than silently dropped.
  const base = await mkdtemp(path.join(os.tmpdir(), "enrichment-"));
  await mkdir(path.join(base, "content", "drafts"), { recursive: true });
  await mkdir(path.join(base, "src", "data", "enrichment", "sections"), { recursive: true });

  const sectionBody = [
    "Sec. 11-709. Driving on roadways laned for traffic.",
    "(a) A vehicle shall be driven as nearly as practicable entirely within a single lane.",
  ].join("\n");

  const writeSection = (body) =>
    writeFile(
      path.join(base, "src", "data", "enrichment", "sections", "0625-0005-11-709.json"),
      JSON.stringify({
        sectionKey: "0625-0005-11-709",
        blocks: [
          ...body.split("\n").map((text, index) => ({ type: index ? "subsection" : "heading", text })),
          { type: "source", text: "(Source: P.A. 101-173, eff. 1-1-20.)" },
        ],
      })
    );

  await writeFile(
    path.join(base, "src", "data", "enrichment", "citation-model.json"),
    JSON.stringify({ records: { "offense-0001": { sectionKey: "0625-0005-11-709", citation: "625 ILCS 5/11-709" } } })
  );
  await writeSection(sectionBody);

  const draft = JSON.stringify({
    quickElements: ["Vehicle stays within a single lane"],
    sourceMapping: [{ element: "Vehicle stays within a single lane", sourceText: "entirely within a single lane" }],
  });
  await writeFile(path.join(base, "content", "drafts", "offense-0001.json"), draft);

  const entry = createEntry({
    offenseId: "offense-0001",
    draftSha256: sha256(draft),
    sectionSha256: sha256(sectionBody),
    reviewer: "A. Reviewer",
    reviewedAt: "2026-09-02",
    decision: "verified",
  });
  await writeFile(path.join(base, "content", "review-log.ndjson"), `${JSON.stringify(entry)}\n`);

  const approved = await validateEnrichment({ root: base });
  assert.equal(approved.ok, true, approved.failures.join("; "));
  assert.equal(approved.publishable, 1);
  assert.deepEqual(approved.withheld, []);

  // Illinois amends the section the approved wording was derived from.
  await writeSection(sectionBody.replace("as nearly as practicable ", ""));
  const amended = await validateEnrichment({ root: base });

  assert.equal(amended.publishable, 0, "an amended statute must withdraw publication");
  assert.equal(amended.withheld.length, 1);
  assert.match(amended.withheld[0], /statutory text has changed since the review/);
});
