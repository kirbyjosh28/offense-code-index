import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../src/data/offense-codes.json", import.meta.url), "utf8"));

test("the extracted index has no unresolved code records", () => {
  assert.deepEqual(data.meta.validation.unconsumedPrimaryCandidates, []);
  assert.deepEqual(data.meta.validation.orphanUniformCodes, []);
  assert.equal(data.offenses.length, 953);
  assert.equal(data.offenses.filter((record) => record.citationPlaceholder).length, 2);
});

test("every offense preserves a valid page target in the official source PDF", () => {
  assert.ok(
    data.offenses.every(
      ({ page }) => Number.isInteger(page) && page >= 1 && page <= data.meta.sourcePages
    )
  );
});

test("representative records preserve statute, uniform code, and appearance marker", () => {
  const uninsured = data.offenses.find((record) => record.code === "3-707");
  assert.equal(uninsured.uniformCode, "2461");
  assert.deepEqual(uninsured.reportingCodes, [{ value: "2461", role: null }]);
  assert.equal(uninsured.mandatoryAppearance, true);
  assert.match(uninsured.description, /uninsured motor vehicle/i);

  const dui = data.offenses.find((record) => record.code === "11-501(a)(1)");
  assert.ok(dui, "DUI section 11-501(a)(1) should be present");
  assert.equal(dui.mandatoryAppearance, true);
});

test("role-specific reporting codes remain attached to one source row", () => {
  const seatBelt = data.offenses.find(
    (record) => record.code === "12-603.1" && record.reportingCodes.length === 2
  );
  assert.deepEqual(seatBelt.reportingCodes, [
    { value: "2485", role: "Driver" },
    { value: "8447", role: "Passenger" },
  ]);
});

test("county codes include all Illinois counties and Chicago's reporting code", () => {
  assert.equal(data.counties.length, 103);
  assert.deepEqual(data.counties.at(0), { name: "ADAMS", code: "001" });
  assert.ok(data.counties.some((county) => county.name === "CITY OF CHICAGO" && county.code === "103"));
  assert.ok(data.counties.some((county) => county.name === "WOODFORD" && county.code === "102"));
});
