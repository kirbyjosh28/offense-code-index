import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SHARE_STATE,
  normalizeShareQuery,
  parseShareFragment,
  readLegacyShareState,
  serializeShareState,
} from "../src/share-state.js";

const options = {
  allowedFamilies: ["Vehicle Code", "Criminal Code"],
  allowedChapters: ["CHAPTER 11", "CHAPTER 12"],
};

test("serializes canonical fragments in deterministic supported-key order", () => {
  assert.equal(
    serializeShareState(
      {
        query: "  expired   registration  ",
        family: "Vehicle Code",
        chapter: "CHAPTER 11",
        mandatoryOnly: true,
      },
      options
    ),
    "#lookup?q=expired+registration&family=Vehicle+Code&chapter=CHAPTER+11&appearance=mandatory"
  );
  assert.equal(serializeShareState(DEFAULT_SHARE_STATE, options), "#lookup");
});

test("normalizes Unicode and whitespace without changing meaningful text", () => {
  assert.equal(normalizeShareQuery("  rear   plate\u00a0light  "), "rear plate light");
  assert.equal(normalizeShareQuery("e\u0301quipement"), "équipement");
  assert.equal(normalizeShareQuery("head\nlights"), null);
  assert.equal(normalizeShareQuery(`x${"y".repeat(120)}`), null);
});

test("parses canonical lookup fragments into safe application defaults", () => {
  assert.deepEqual(parseShareFragment("#lookup", options), DEFAULT_SHARE_STATE);
  assert.deepEqual(
    parseShareFragment(
      "#lookup?appearance=mandatory&chapter=CHAPTER+12&q=tail+lights&family=Vehicle+Code",
      options
    ),
    {
      query: "tail lights",
      family: "Vehicle Code",
      chapter: "CHAPTER 12",
      mandatoryOnly: true,
    }
  );
});

test("rejects malformed, duplicate, unknown, and unsupported fragment state", () => {
  const invalid = [
    "#lookup?q=%ZZ",
    "#lookup?q=headlights&q=taillights",
    "#lookup?q=headlights&extra=value",
    "#lookup?family=Unknown",
    "#lookup?chapter=CHAPTER+99",
    "#lookup?appearance=false",
    "#lookup?q=head%0Alights",
    "#lookup?q=%E0%A4%A",
    `#lookup?q=${"x".repeat(2048)}`,
    "#offense-11-501",
  ];

  invalid.forEach((fragment) => assert.equal(parseShareFragment(fragment, options), null, fragment));
});

test("refuses to serialize values outside the supplied allowlists", () => {
  assert.throws(
    () => serializeShareState({ family: "Unknown" }, options),
    /invalid share state/
  );
  assert.throws(
    () => serializeShareState({ query: "head\u202Elights" }, options),
    /invalid share state/
  );
});

test("validates legacy query parameters and returns their canonical fragment", () => {
  assert.deepEqual(
    readLegacyShareState(
      "?q=expired+registration&family=Vehicle+Code&chapter=all&appearance=mandatory&utm=test",
      options
    ),
    {
      state: {
        query: "expired registration",
        family: "Vehicle Code",
        chapter: "all",
        mandatoryOnly: true,
      },
      fragment:
        "#lookup?q=expired+registration&family=Vehicle+Code&appearance=mandatory",
    }
  );
});

test("rejects unsafe legacy values and ignores URLs without legacy lookup state", () => {
  assert.equal(readLegacyShareState("?utm=test", options), null);
  assert.equal(readLegacyShareState("?q=one&q=two", options), null);
  assert.equal(readLegacyShareState("?family=Unknown", options), null);
  assert.equal(readLegacyShareState("?q=%ZZ", options), null);
  assert.equal(readLegacyShareState("?q=%E0%A4%A", options), null);
  assert.equal(readLegacyShareState("?q=head%0Alights", options), null);
  assert.equal(readLegacyShareState(`?q=${"x".repeat(2048)}`, options), null);
});
