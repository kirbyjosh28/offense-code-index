import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildOffensePrimarySearchDocument,
  buildOffenseSearchDocument,
  scoreOffenseMatch,
} from "../src/search.js";

const data = JSON.parse(
  fs.readFileSync(new URL("../src/data/offense-codes.json", import.meta.url), "utf8")
);

const offenses = data.offenses.map((offense) => ({
  ...offense,
  primarySearchDocument: buildOffensePrimarySearchDocument(offense),
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

test("plain-language questions ignore filler words and resolve common intent", () => {
  assert.match(
    matchesFor("I was caught driving without insurance")[0].offense.description,
    /uninsured/i
  );
  assert.match(
    matchesFor("what is the code for leaving after a car accident")[0].offense.description,
    /leaving scene/i
  );
  assert.match(
    matchesFor("texting on my phone while driving")[0].offense.description,
    /electronic communication device/i
  );
  assert.match(matchesFor("my tags are expired")[0].offense.description, /expired registration/i);
});

test("colloquial safety and licensing searches resolve related records", () => {
  assert.match(matchesFor("license was taken away")[0].offense.description, /license suspended/i);
  assert.match(matchesFor("no car seat for a child")[0].offense.description, /child.*restraint/i);
  assert.match(matchesFor("handicap parking")[0].offense.description, /disabilities/i);
  assert.match(matchesFor("over the legal limit")[0].offense.description, /0\.08|alcohol concentration/i);
});

test("vehicle-equipment searches understand everyday names and broken-part language", () => {
  assert.ok(matchesFor("headlights").length >= 2);
  assert.match(matchesFor("headlight out")[0].offense.description, /one headlamp/i);
  assert.match(matchesFor("taillights")[0].offense.description, /taillight|tail lamp/i);
  assert.match(matchesFor("tail light out")[0].offense.description, /taillight/i);
  assert.match(matchesFor("brake lights")[0].offense.description, /stop light|signal lamp/i);
  assert.match(matchesFor("broken windshield wipers")[0].offense.description, /clearing device/i);
  assert.match(matchesFor("cracked windshield")[0].offense.description, /defective windshield/i);
  assert.match(matchesFor("loud exhaust")[0].offense.description, /muffler/i);
  assert.match(matchesFor("bald tires")[0].offense.description, /unsafe tire/i);
});

test("plain-language driving behavior outranks incidental chapter wording", () => {
  assert.match(matchesFor("reckless driving")[0].offense.description, /^reckless driving/i);
  assert.match(matchesFor("ran a red light")[0].offense.description, /traffic control signal/i);
  assert.match(matchesFor("rolled through stop sign")[0].offense.description, /stop sign/i);
  assert.match(matchesFor("school bus stop arm")[0].offense.description, /passed school bus/i);
});

test("minor spelling mistakes remain useful without matching every record", () => {
  const matches = matchesFor("intoxicatd");
  assert.ok(matches.length > 0);
  assert.ok(matches.length < offenses.length);
  assert.match(matches[0].offense.description, /intoxicat/i);
});
