import assert from "node:assert/strict";
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../src/data/offense-codes.json", import.meta.url), "utf8"));

assert.equal(data.meta.offenseEntries, data.offenses.length, "offense count metadata must match");
assert.equal(data.meta.countyCodes, data.counties.length, "county count metadata must match");
assert.equal(data.meta.validation.unconsumedPrimaryCandidates.length, 0, "all primary codes must be consumed");
assert.equal(data.meta.validation.orphanUniformCodes.length, 0, "all uniform codes must belong to a record");
assert.equal(data.counties.length, 103, "102 counties plus City of Chicago are expected");
assert.equal(data.offenses.length, 953, "every visual offense row must be present");
assert.equal(data.meta.citedEntries, 951, "951 rows have statutory citations");
assert.equal(data.meta.placeholderEntries, 2, "two BAIID guidance rows use citation placeholders");
assert.equal(data.meta.mandatoryEntries, 199, "199 cited rows are starred");
assert.equal(data.meta.reportingCodeTokens, 406, "all reporting code tokens must be retained");
assert.equal(data.meta.reportingCodeRows, 405, "reporting codes occur on 405 rows");
assert.equal(data.meta.uniqueReportingCodes, 397, "reporting code uniqueness must match source audit");

const expectedPageCounts = new Map([
  [8, 15], [9, 22], [10, 13], [12, 11], [13, 12], [14, 14], [15, 19],
  [16, 17], [17, 20], [18, 19], [19, 14], [20, 21], [21, 23], [22, 21],
  [23, 24], [24, 18], [25, 28], [26, 23], [27, 26], [28, 14], [29, 21],
  [30, 7], [31, 22], [32, 17], [33, 17], [34, 23], [35, 22], [36, 13],
  [37, 22], [38, 31], [39, 40], [40, 44], [41, 31], [42, 29], [43, 31],
  [44, 34], [45, 32], [46, 30], [47, 35], [48, 32], [49, 28], [50, 17],
  [51, 1],
]);
const actualPageCounts = new Map();
for (const offense of data.offenses) {
  actualPageCounts.set(offense.page, (actualPageCounts.get(offense.page) ?? 0) + 1);
}
assert.deepEqual(actualPageCounts, expectedPageCounts, "the source page row ledger must match");

const ids = new Set();
for (const offense of data.offenses) {
  assert.ok(offense.id, "every record needs an id");
  assert.ok(!ids.has(offense.id), `duplicate id: ${offense.id}`);
  ids.add(offense.id);
  if (offense.citationPlaceholder) {
    assert.equal(offense.code, null, `${offense.id} placeholder citation should be null`);
  } else {
    assert.ok(offense.code.trim(), `${offense.id} needs a primary code`);
  }
  assert.ok(offense.description.trim(), `${offense.id} needs a description`);
  assert.ok(offense.chapter.trim(), `${offense.id} needs a chapter`);
  assert.ok(offense.section.trim(), `${offense.id} needs a section`);
  assert.ok(Number.isInteger(offense.page) && offense.page >= 8 && offense.page <= 51, `${offense.id} has an invalid page`);
  for (const reportingCode of offense.reportingCodes) {
    assert.match(reportingCode.value, /^\d{4}$/, `${offense.id} has an invalid uniform code`);
  }
}

const countyCodes = new Set(data.counties.map((county) => county.code));
assert.equal(countyCodes.size, data.counties.length, "county reporting codes must be unique");
assert.ok(data.counties.some((county) => county.name === "CITY OF CHICAGO" && county.code === "103"));

console.log(`Validated ${data.offenses.length} offenses and ${data.counties.length} county codes.`);
