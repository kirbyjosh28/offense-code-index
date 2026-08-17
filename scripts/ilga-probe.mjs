import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDocName, citationMatches, extractStatutoryText } from "./lib/ilga.mjs";
import { URL_TEMPLATES, buildUrl, createPacer, fetchDocument } from "./lib/ilga-client.mjs";

/**
 * Probe ILGA's fulltext URL templates against known-good sections.
 *
 * ILGA has relocated this path before, and it answers HTTP 200 with an in-band
 * "not currently available" notice rather than a 404, so a template can look healthy
 * while returning nothing. This probe judges a template by whether the section it
 * returns actually echoes the citation we asked for.
 *
 * Run it before a verification sweep, or whenever a sweep starts failing broadly, and
 * pin the winning template into config/enrichment-version.json.
 *
 *   node scripts/ilga-probe.mjs
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Sections spanning four different chapter/act combinations, chosen so that a template
 * which only works for the Vehicle Code cannot pass.
 */
const PROBE_SECTIONS = [
  { chapterId: "625", actId: "5", sectionId: "11-709", note: "Vehicle Code — improper lane usage" },
  { chapterId: "625", actId: "5", sectionId: "11-501", note: "Vehicle Code — DUI" },
  { chapterId: "625", actId: "5", sectionId: "3-707", note: "Vehicle Code — no insurance" },
  { chapterId: "625", actId: "40", sectionId: "5-7", note: "Snowmobile Act" },
  { chapterId: "720", actId: "5", sectionId: "12-3.2", note: "Criminal Code — domestic battery" },
  { chapterId: "720", actId: "570", sectionId: "402", note: "Controlled Substances Act" },
  { chapterId: "810", actId: "5", sectionId: "9-315.01", note: "Uniform Commercial Code" },
  { chapterId: "625", actId: "5", sectionId: "99-999", note: "control: must NOT resolve" },
];

const pace = createPacer(1_500);

const probeTemplate = async (template) => {
  const results = [];

  for (const section of PROBE_SECTIONS) {
    const docName = buildDocName(section);
    const url = buildUrl(template, docName);
    await pace();
    const response = await fetchDocument(url);
    const extracted = response.html ? extractStatutoryText(response.html) : { available: false, reason: "no-body" };
    const isControl = section.sectionId === "99-999";
    const matched = extracted.available && citationMatches(extracted.canonicalCitation, section);

    results.push({
      section,
      docName,
      httpStatus: response.status,
      available: extracted.available,
      citation: extracted.canonicalCitation ?? null,
      reason: extracted.reason ?? null,
      // A control section is a pass precisely when it fails to resolve.
      pass: isControl ? !extracted.available : matched,
      isControl,
    });
  }

  return results;
};

console.log("Probing ILGA fulltext URL templates.\n");

const report = [];

for (const template of URL_TEMPLATES) {
  console.log(`Template: ${template}`);
  const results = await probeTemplate(template);

  for (const result of results) {
    const label = `${result.section.chapterId} ILCS ${result.section.actId}/${result.section.sectionId}`;
    const status = result.pass ? "ok  " : "FAIL";
    const detail = result.isControl
      ? result.available
        ? `resolved to ${result.citation} — template does not distinguish missing sections`
        : `correctly unavailable (${result.reason})`
      : result.available
        ? `${result.citation}`
        : `unavailable (${result.reason})`;
    console.log(`  ${status} HTTP ${String(result.httpStatus).padEnd(3)} ${label.padEnd(24)} ${detail}`);
  }

  const passed = results.filter((result) => result.pass).length;
  console.log(`  -> ${passed}/${results.length} checks passed\n`);
  report.push({ template, passed, total: results.length, results });
}

const winner = report.find((entry) => entry.passed === entry.total) ?? null;

if (winner) {
  console.log(`Working template: ${winner.template}`);
  console.log("Pin this as ilga.urlTemplate in config/enrichment-version.json.");
} else {
  const best = report.reduce((left, right) => (right.passed > left.passed ? right : left));
  console.error("No template passed every check.");
  console.error(`Best was ${best.template} at ${best.passed}/${best.total}.`);
  console.error("ILGA's URL scheme or page structure has probably changed; do not run a sweep until this is resolved.");
  process.exitCode = 1;
}

console.log(`\n(Probed from ${path.relative(process.cwd(), root) || "."})`);
