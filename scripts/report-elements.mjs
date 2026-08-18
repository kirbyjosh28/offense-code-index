import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { elementsFor, emphasize } from "../src/elements.js";

/**
 * Report what the elements panel actually shows across the corpus.
 *
 * Read-only. Exists so a change to the splitter is measured rather than assumed — the
 * first version of this panel showed a single undivided block for 89% of records, which
 * looked fine on the three examples that were checked by hand.
 *
 *   node scripts/report-elements.mjs
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (...parts) => JSON.parse(await readFile(path.join(root, ...parts), "utf8"));

const model = await readJson("src", "data", "enrichment", "citation-model.json");
const sections = new Map();
for (const file of await readdir(path.join(root, "src", "data", "enrichment", "sections"))) {
  if (!file.endsWith(".json")) continue;
  const section = await readJson("src", "data", "enrichment", "sections", file);
  sections.set(section.sectionKey, section);
}

const distribution = {};
let total = 0, single = 0, withExceptions = 0, truncated = 0, exact = 0;
let verbatimFailures = 0, fragments = 0, emphasisDrift = 0;

for (const record of Object.values(model.records)) {
  if (!record.sectionKey) continue;
  const section = sections.get(record.sectionKey);
  if (!section) continue;
  const result = elementsFor({
    blocks: section.blocks,
    subsectionPath: record.subsectionPath ?? [],
    citation: record.citation,
  });
  if (!result) continue;

  total += 1;
  if (result.elements.length === 1) single += 1;
  if (result.exceptions.length) withExceptions += 1;
  if (result.truncated > 0) truncated += 1;
  if (result.exact) exact += 1;
  const bucket = Math.min(result.elements.length, 5);
  distribution[bucket] = (distribution[bucket] ?? 0) + 1;

  const haystack = section.blocks.map((block) => block.text).join(" ").replace(/\s+/g, " ");
  for (const clause of [...result.elements, ...result.exceptions]) {
    if (!haystack.includes(clause.replace(/\s+/g, " "))) verbatimFailures += 1;
    if (/^\(\d+\)\s+of\s+(subsection|paragraph|section)/i.test(clause)) fragments += 1;
    if (emphasize(clause).map((segment) => segment.text).join("") !== clause) emphasisDrift += 1;
  }
}

console.log(`Records rendering an elements panel: ${total}\n`);
console.log("Elements per record (5 = five or more):");
for (const key of Object.keys(distribution).sort()) {
  const count = distribution[key];
  console.log(`  ${key}: ${String(count).padStart(4)}  ${"█".repeat(Math.round((count / total) * 40))}`);
}
console.log(`\nSingle undivided provision : ${single} (${((100 * single) / total).toFixed(0)}%)`);
console.log(`Separated exceptions       : ${withExceptions}`);
console.log(`Clauses omitted (counted)  : ${truncated}`);
console.log(`Showing the cited provision: ${exact}`);
console.log(`\nVerbatim failures : ${verbatimFailures}  (must be 0)`);
console.log(`Fragments         : ${fragments}  (must be 0)`);
console.log(`Emphasis drift    : ${emphasisDrift}  (must be 0)`);

if (verbatimFailures || fragments || emphasisDrift) process.exitCode = 1;
