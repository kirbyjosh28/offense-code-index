import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import {
  buildOffensePrimarySearchDocument,
  buildOffenseSearchDocument,
  buildOffenseSearchText,
  createSearchIndex,
  querySearchIndex,
  scoreOffenseMatch,
} from "../src/search.js";

const data = JSON.parse(
  fs.readFileSync(new URL("../src/data/offense-codes.json", import.meta.url), "utf8")
);
const benchmark = JSON.parse(
  fs.readFileSync(new URL("./fixtures/officer-search-benchmark.json", import.meta.url), "utf8")
);

const offenses = data.offenses.map((offense) => ({
  ...offense,
  primarySearchDocument: buildOffensePrimarySearchDocument(offense),
  searchDocument: buildOffenseSearchDocument(offense),
}));
const searchIndex = createSearchIndex(offenses);
const benchmarkCases = benchmark.intents.flatMap((intent) =>
  intent.queries.map((query, index) => ({
    ...query,
    id: `${intent.id}:${index + 1}`,
    intent: intent.id,
    conflictSet: intent.conflictSet ?? null,
    expectedCodes: query.expectedCodes ?? intent.expectedCodes,
    tags: [...(intent.defaultTags ?? []), ...(query.tags ?? [])],
  }))
);

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
  assert.equal(matchesFor("headlights").length, 4);
  assert.match(matchesFor("headlight out")[0].offense.description, /one headlamp/i);
  assert.equal(matchesFor("taillights").length, 4);
  assert.match(matchesFor("taillights")[0].offense.description, /taillight|tail lamp/i);
  assert.match(matchesFor("tail light out")[0].offense.description, /taillight/i);
  assert.match(matchesFor("brake lights")[0].offense.description, /stop light|signal lamp/i);
  assert.match(matchesFor("broken windshield wipers")[0].offense.description, /clearing device/i);
  assert.match(matchesFor("cracked windshield")[0].offense.description, /defective windshield/i);
  assert.match(matchesFor("loud exhaust")[0].offense.description, /muffler/i);
  assert.match(matchesFor("bald tires")[0].offense.description, /unsafe tire/i);
});

test("common traffic-stop shortcuts rank the intended records first", () => {
  const shortcuts = [
    ["no rear registration light", 2, /rear registration plate light/i],
    ["expired registration", 3, /expired registration/i],
    ["speeding over limit", 3, /^speeding/i],
    ["headlights", 4, /one headlamp/i],
    ["taillights", 4, /taillight|tail lamp/i],
    ["no insurance", 1, /uninsured/i],
  ];

  shortcuts.forEach(([query, expectedCount, firstDescription]) => {
    const matches = matchesFor(query);
    assert.equal(matches.length, expectedCount, `${query} should return ${expectedCount} useful matches`);
    assert.match(matches[0].offense.description, firstDescription);
  });
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

test("the officer-style benchmark covers critical query shapes and conflict sets", () => {
  assert.match(benchmark.description, /synthetic, deidentified/i);
  assert.equal(benchmark.threshold.top3Percent, 95);
  assert.ok(benchmarkCases.length >= 120, "benchmark must contain at least 120 queries");
  assert.ok(new Set(benchmarkCases.map(({ intent }) => intent)).size >= 24);

  const countTagged = (tag) => benchmarkCases.filter(({ tags }) => tags.includes(tag)).length;
  assert.ok(countTagged("exact-code") >= 6);
  assert.ok(countTagged("partial-code") >= 6);
  assert.ok(countTagged("reporting-code") >= 4);
  assert.ok(countTagged("typo") >= 10);
  assert.ok(countTagged("numeric-speed") >= 12);

  const conflicts = new Map();
  benchmarkCases.forEach((query) => {
    if (!query.conflictSet) return;
    const grouped = conflicts.get(query.conflictSet) ?? [];
    grouped.push(query);
    conflicts.set(query.conflictSet, grouped);
  });
  assert.ok(conflicts.size >= 6);
  conflicts.forEach((queries, conflictSet) => {
    assert.ok(
      new Set(queries.map(({ intent }) => intent)).size >= 2,
      `${conflictSet} must compare at least two intents`
    );
  });
});

test("named critical officer searches return the required top result and reason", () => {
  const criticalCases = benchmarkCases.filter(({ critical }) => critical);
  assert.ok(criticalCases.length >= 20);

  criticalCases.forEach(({ critical, text }) => {
    const result = querySearchIndex(searchIndex, { text, limit: 3 });
    const first = result.candidates[0];
    assert.ok(first, `${critical.name} should return a candidate`);
    assert.equal(first.offense.code, critical.top1Code, critical.name);
    if (critical.reason) assert.equal(first.reason, critical.reason, critical.name);
  });
});

test("officer-style benchmark keeps at least 95 percent of intended results in the top three", () => {
  const misses = [];

  benchmarkCases.forEach(({ expectedCodes, id, text }) => {
    assert.ok(expectedCodes?.length, `${id} must declare at least one expected code`);
    const result = querySearchIndex(searchIndex, { text, limit: 3 });
    const returnedCodes = result.candidates.map(({ offense }) => offense.code);
    if (!expectedCodes.some((code) => returnedCodes.includes(code))) {
      misses.push(`${id} “${text}” -> ${returnedCodes.join(", ") || "no results"}`);
    }
  });

  const requiredTop3Percent = 95;
  const top3Percent = ((benchmarkCases.length - misses.length) / benchmarkCases.length) * 100;
  assert.ok(
    top3Percent >= requiredTop3Percent,
    `top-3 accuracy ${top3Percent.toFixed(2)}% is below ${requiredTop3Percent}%:\n${misses.join("\n")}`
  );
});

test("indexed search returns deterministic scores, reasons, fields, and ranges", () => {
  const secondIndex = createSearchIndex(offenses);
  const project = ({ offenseId, score, reason, matchedFields, matchedRanges }) => ({
    offenseId,
    score,
    reason,
    matchedFields,
    matchedRanges,
  });

  benchmarkCases.forEach(({ id, text }) => {
    const first = querySearchIndex(searchIndex, { text, limit: 3 }).candidates.map(project);
    const second = querySearchIndex(secondIndex, { text, limit: 3 }).candidates.map(project);
    first.forEach(({ reason }) => assert.ok(reason, `${id} must explain every candidate`));
    assert.deepEqual(second, first, `${id} should rank and explain deterministically`);
  });
});

test("filters report exactly how many ranked matches they hide", () => {
  const filterIndex = createSearchIndex([
    {
      id: "filter-a",
      code: "TEST-1",
      page: 1,
      description: "Expired registration test record one",
      searchText: "expired registration",
      reportingCodes: [],
      family: "Vehicle Code",
      chapter: "Chapter A",
      mandatoryAppearance: false,
    },
    {
      id: "filter-b",
      code: "TEST-2",
      page: 1,
      description: "Expired registration test record two",
      searchText: "expired registration",
      reportingCodes: [],
      family: "Vehicle Code",
      chapter: "Chapter A",
      mandatoryAppearance: true,
    },
    {
      id: "filter-c",
      code: "TEST-3",
      page: 40,
      description: "Expired registration test record three",
      searchText: "expired registration",
      reportingCodes: [],
      family: "Other Illinois statutes",
      chapter: "Chapter B",
      mandatoryAppearance: false,
    },
  ]);
  const search = (filters = {}) =>
    querySearchIndex(filterIndex, { text: "expired registration", filters, limit: 10 });
  const countsFor = (filters = {}) => {
    const result = search(filters);
    return { total: result.total, hidden: result.hiddenByFilters };
  };

  assert.deepEqual(countsFor(), { total: 3, hidden: 0 });
  assert.deepEqual(countsFor({ family: "Vehicle Code" }), { total: 2, hidden: 1 });
  assert.deepEqual(countsFor({ chapter: "Chapter A" }), { total: 2, hidden: 1 });
  assert.deepEqual(countsFor({ mandatoryOnly: true }), { total: 1, hidden: 2 });
  assert.deepEqual(countsFor({ chapter: "Chapter B", mandatoryOnly: true }), {
    total: 0,
    hidden: 3,
  });
});

test("local indexed scoring stays within an interactive performance budget", () => {
  const indexStarted = performance.now();
  const performanceIndex = createSearchIndex(offenses);
  const indexDuration = performance.now() - indexStarted;
  assert.ok(indexDuration < 500, `index creation took ${indexDuration.toFixed(2)}ms`);

  const rounds = 3;
  let candidateChecksum = 0;
  const queryStarted = performance.now();
  for (let round = 0; round < rounds; round += 1) {
    benchmarkCases.forEach(({ text }) => {
      candidateChecksum += querySearchIndex(performanceIndex, { text, limit: 3 }).candidates.length;
    });
  }
  const queryDuration = performance.now() - queryStarted;
  const averageQueryDuration = queryDuration / (benchmarkCases.length * rounds);

  assert.ok(candidateChecksum > 0);
  assert.ok(
    averageQueryDuration < 20,
    `average local query took ${averageQueryDuration.toFixed(2)}ms`
  );
});

test("rebuilt search text reproduces every stored value byte for byte", () => {
  // The build strips the corpus's precomputed searchText and the client rebuilds it.
  // Any drift here silently changes broad-tier matching for the affected records.
  for (const offense of offenses) {
    assert.equal(
      buildOffenseSearchText(offense),
      offense.searchText,
      `${offense.id} would lose search text on rebuild`
    );
  }
});
