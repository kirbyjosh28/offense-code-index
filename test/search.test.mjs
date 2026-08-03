import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildOffenseSearchDocument, scoreOffenseMatch } from "../src/search.js";

const data = JSON.parse(
  fs.readFileSync(new URL("../src/data/offense-codes.json", import.meta.url), "utf8")
);

const offenses = data.offenses.map((offense) => ({
  ...offense,
  searchDocument: buildOffenseSearchDocument(offense),
}));

const matchesFor = (query) =>
  offenses
    .map((offense, index) => ({ offense, index, score: scoreOffenseMatch(offense, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.index - right.index);

test("exact ILCS and reporting-code searches rank first", () => {
  assert.equal(matchesFor("11-501(a)(1)")[0].offense.code, "11-501(a)(1)");
  assert.equal(matchesFor("625 ILCS 5/11-501(a)(1)")[0].offense.code, "11-501(a)(1)");
  assert.equal(matchesFor("2410")[0].score, 0);
});

test("common phrases find the intended offenses without exact wording", () => {
  assert.match(matchesFor("driving drunk")[0].offense.code, /^11-501/);
  assert.match(matchesFor("no insurance")[0].offense.description, /uninsured/i);
  assert.match(matchesFor("hit and run")[0].offense.description, /leaving scene/i);
});

test("minor spelling mistakes remain useful without matching every record", () => {
  const matches = matchesFor("intoxicatd");
  assert.ok(matches.length > 0);
  assert.ok(matches.length < offenses.length);
  assert.match(matches[0].offense.description, /intoxicat/i);
});
