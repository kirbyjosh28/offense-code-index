import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/parse-pdf-lines.mjs lines.json output.json");
  process.exit(64);
}

const positionedLines = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const normalizeSpaces = (value) =>
  value
    .replaceAll("\u00a0", " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDash = (value) => value.replace(/[–—]/g, "-");

const cleanDescription = (parts) => {
  let result = parts.map(normalizeSpaces).filter(Boolean).join(" ");
  result = result
    .replace(/([A-Za-z])\s+-\s+([a-z])/g, "$1$2")
    .replace(/([A-Za-z])-(?:\s+)([a-z])/g, "$1$2")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .replace(/\bregistrat(?:i\s+on|\s+ion)\b/gi, "registration")
    .replace(/\bsus pended\b/gi, "suspended")
    .replace(/\bc ompound\b/gi, "compound")
    .replace(/\bprope rly\b/gi, "properly")
    .replace(/\bstatu\s*-\s*tory\b/gi, "statutory")
    .replace(/\bspeedmotorized\b/gi, "speed - motorized")
    .replace(/\s+/g, " ")
    .trim();
  return result;
};

const primaryPatterns = [
  /^(\*?\s*\d+\s+ILCS\s+[0-9A-Za-z./-]+(?:\([^)]+\)|-\([^)]+\)|\+\([^)]+\))*)\s*(.*)$/,
  /^(\*?\s*Section\s+[0-9A-Za-z.-]+(?:\([^)]+\))*)\s*(.*)$/i,
  /^(\*?\s*\d{1,3}[A-Za-z]?-[0-9A-Za-z.]+(?:\([^)]+\)|-\([^)]+\))*)\s*(.*)$/,
];

const parsePrimaryCode = (value) => {
  const text = normalizeSpaces(value);
  for (const pattern of primaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        code: normalizeDash(match[1].replace(/^\*\s*/, "")),
        mandatoryAppearance: match[1].startsWith("*"),
        remainder: match[2] ?? "",
      };
    }
  }
  return null;
};

const parseUniformCode = (value) => {
  const match = normalizeSpaces(value).match(/^\((\d{4})(?:-([^)]+))?\)\s*(.*)$/);
  return match ? { code: match[1], role: match[2] ?? null, remainder: match[3] } : null;
};

const uppercaseRatio = (value) => {
  const letters = value.match(/[A-Za-z]/g) ?? [];
  if (!letters.length) return 0;
  const uppercase = letters.filter((letter) => letter === letter.toUpperCase()).length;
  return uppercase / letters.length;
};

const isHeading = (value) => {
  const text = normalizeSpaces(value);
  if (!text || parsePrimaryCode(text) || parseUniformCode(text)) return false;
  if (/^(CHAPTER|TITLE|ARTICLE|SUB-CHAPTER|SUBCHAPTER|SUBDIVISION|PART|OFFENSES|ILLINOIS VEHICLE CODE|OFFENSE CODE INDEX)/i.test(text)) {
    return true;
  }
  return text.length >= 8 && uppercaseRatio(text) >= 0.92 && !/^\d/.test(text);
};

const shouldMergeHeadings = (previous, next) => {
  const cleanPrevious = normalizeSpaces(previous);
  const cleanNext = normalizeSpaces(next);
  const nextStartsNewStructure = /^(CHAPTER|TITLE|ARTICLE|SUB-CHAPTER|SUBCHAPTER|SUBDIVISION|PART|OFFENSE CODE INDEX|ILLINOIS VEHICLE CODE)/i.test(
    cleanNext
  );
  if (nextStartsNewStructure) return false;
  return (
    /(?:\bAND|\bOF|\bTHE|[,/-])$/i.test(cleanPrevious) ||
    /^(CHAPTER|TITLE|ARTICLE|SUB-CHAPTER|SUBCHAPTER|SUBDIVISION|PART)/i.test(
      cleanPrevious
    )
  );
};

const groupByPageAndBaseline = (source) => {
  const pages = new Map();
  for (const line of source) {
    if (!pages.has(line.page)) pages.set(line.page, []);
    pages.get(line.page).push({ ...line, text: normalizeSpaces(line.text) });
  }

  const baselines = [];
  for (const [page, pageLines] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = pageLines.sort((a, b) => b.y - a.y || a.x - b.x);
    const pageBaselines = [];
    for (const line of sorted) {
      const existing = pageBaselines.find((candidate) => Math.abs(candidate.y - line.y) < 0.55);
      if (existing) {
        existing.fragments.push(line);
      } else {
        pageBaselines.push({ page, y: line.y, fragments: [line] });
      }
    }
    pageBaselines.sort((a, b) => b.y - a.y);
    for (const baseline of pageBaselines) {
      baseline.fragments.sort((a, b) => a.x - b.x);
      baselines.push(baseline);
    }
  }
  return baselines;
};

const baselines = groupByPageAndBaseline(positionedLines);
const entries = [];
const consumedPrimaryKeys = new Set();
const orphanUniformCodes = [];

let currentEntry = null;
let chapter = "Illinois Vehicle Code";
let section = "General";
let pendingHeading = null;

const finishEntry = () => {
  if (!currentEntry) return;
  currentEntry.descriptionRaw = currentEntry.descriptionParts
    .map(normalizeSpaces)
    .filter(Boolean)
    .join(" ");
  currentEntry.description = cleanDescription(currentEntry.descriptionParts);
  delete currentEntry.descriptionParts;
  delete currentEntry.incompleteCodePrefix;
  currentEntry.uniformCode = currentEntry.reportingCodes[0]?.value ?? null;
  currentEntry.citationRaw = currentEntry.code;
  currentEntry.sourcePrintedPage = currentEntry.page - 1;
  currentEntry.searchText = normalizeSpaces(
    [
      currentEntry.code,
      ...currentEntry.reportingCodes.flatMap(({ value, role }) => [value, role]),
      currentEntry.description,
      currentEntry.chapter,
      currentEntry.section,
    ]
      .filter(Boolean)
      .join(" ")
  ).toLowerCase();
  currentEntry.id = `offense-${String(entries.length + 1).padStart(4, "0")}`;
  entries.push(currentEntry);
  currentEntry = null;
};

const commitHeading = (text) => {
  const clean = normalizeDash(normalizeSpaces(text));
  if (/^CHAPTER\s+\S+\s+VIOLATIONS\s+ARE/i.test(clean)) {
    section = clean;
  } else if (/^CHAPTER/i.test(clean) || clean === "ILLINOIS VEHICLE CODE") {
    chapter = clean;
    section = "General";
  } else {
    section = clean;
  }
};

for (const baseline of baselines) {
  if (baseline.page < 8 || baseline.page > 51) continue;
  if (baseline.page === 11) {
    finishEntry();
    continue;
  }

  const fragments = baseline.fragments.filter((fragment) => {
    const text = normalizeSpaces(fragment.text);
    return !(fragment.x > 240 && /^\d{1,2}$/.test(text));
  });
  if (!fragments.length) continue;

  const joined = fragments.map((fragment) => fragment.text).join(" ");
  if (baseline.y < 26 && /^\d{1,2}$/.test(joined)) {
    continue;
  }
  const placeholderFragment = fragments.find(
    (fragment) => fragment.x < 92 && /^-{5,}$/.test(fragment.text)
  );
  const firstPrimaryFragment = fragments.find(
    (fragment) => fragment.x < 92 && parsePrimaryCode(fragment.text)
  );

  if (placeholderFragment) {
    if (pendingHeading) {
      finishEntry();
      commitHeading(pendingHeading);
      pendingHeading = null;
    }
    finishEntry();
    currentEntry = {
      code: null,
      citationPlaceholder: true,
      reportingCodes: [],
      mandatoryAppearance: false,
      chapter,
      section,
      page: baseline.page,
      descriptionParts: fragments
        .filter((fragment) => fragment !== placeholderFragment)
        .map((fragment) => fragment.text),
    };
    continue;
  }

  if (firstPrimaryFragment) {
    if (pendingHeading) {
      finishEntry();
      commitHeading(pendingHeading);
      pendingHeading = null;
    }
    const parsed = parsePrimaryCode(firstPrimaryFragment.text);
    const primaryKey = `${baseline.page}:${baseline.y.toFixed(2)}:${parsed.code}`;
    consumedPrimaryKeys.add(primaryKey);
    const remainingFragments = [];
    if (parsed.remainder) remainingFragments.push(parsed.remainder);
    for (const fragment of fragments) {
      if (fragment === firstPrimaryFragment) continue;
      const uniform = parseUniformCode(fragment.text);
      if (uniform) continue;
      remainingFragments.push(fragment.text);
    }
    const sameLineUniform = fragments
      .map((fragment) => parseUniformCode(fragment.text))
      .find(Boolean);

    if (currentEntry?.incompleteCodePrefix) {
      currentEntry.code = `${currentEntry.code}${parsed.code}`;
      currentEntry.mandatoryAppearance ||= parsed.mandatoryAppearance;
      currentEntry.incompleteCodePrefix = false;
      if (sameLineUniform) {
        currentEntry.reportingCodes.push({
          value: sameLineUniform.code,
          role: sameLineUniform.role,
        });
      }
      currentEntry.descriptionParts.push(
        ...[sameLineUniform?.remainder, ...remainingFragments].filter(Boolean)
      );
      continue;
    }

    finishEntry();
    currentEntry = {
      code: parsed.code,
      citationPlaceholder: false,
      reportingCodes: sameLineUniform
        ? [{ value: sameLineUniform.code, role: sameLineUniform.role }]
        : [],
      mandatoryAppearance: parsed.mandatoryAppearance,
      chapter,
      section,
      page: baseline.page,
      incompleteCodePrefix: parsed.code.endsWith("/") && !parsed.remainder,
      descriptionParts: [sameLineUniform?.remainder, ...remainingFragments].filter(Boolean),
    };
    continue;
  }

  const uniformFragment = fragments.find((fragment) => parseUniformCode(fragment.text));
  if (uniformFragment) {
    const uniform = parseUniformCode(uniformFragment.text);
    if (currentEntry) {
      currentEntry.reportingCodes.push({ value: uniform.code, role: uniform.role });
      if (uniform.remainder) currentEntry.descriptionParts.push(uniform.remainder);
      for (const fragment of fragments) {
        if (fragment !== uniformFragment) currentEntry.descriptionParts.push(fragment.text);
      }
    } else {
      orphanUniformCodes.push({ page: baseline.page, code: uniform.code, text: joined });
    }
    continue;
  }

  if (isHeading(joined)) {
    finishEntry();
    if (pendingHeading && shouldMergeHeadings(pendingHeading, joined)) {
      pendingHeading = `${pendingHeading} ${joined}`;
      continue;
    }
    if (pendingHeading) commitHeading(pendingHeading);
    pendingHeading = joined;
    continue;
  }

  if (pendingHeading) {
    commitHeading(pendingHeading);
    pendingHeading = null;
  }

  if (currentEntry) {
    currentEntry.descriptionParts.push(...fragments.map((fragment) => fragment.text));
  }
}

finishEntry();

const counties = positionedLines
  .filter((line) => line.page === 53)
  .map((line) => normalizeSpaces(line.text).match(/^(.+?)\s+(\d{3})$/))
  .filter(Boolean)
  .map((match) => ({ name: match[1], code: match[2] }))
  .sort((a, b) => a.code.localeCompare(b.code));

const primaryCandidates = baselines.flatMap((baseline) => {
  if (baseline.page < 8 || baseline.page > 51) return [];
  return baseline.fragments
    .filter((fragment) => fragment.x < 92)
    .map((fragment) => {
      const parsed = parsePrimaryCode(fragment.text);
      if (!parsed) return null;
      return `${baseline.page}:${baseline.y.toFixed(2)}:${parsed.code}`;
    })
    .filter(Boolean);
});

const unconsumedPrimaryCandidates = primaryCandidates.filter(
  (candidate) => !consumedPrimaryKeys.has(candidate)
);
const reportingCodeValues = entries.flatMap((entry) =>
  entry.reportingCodes.map((reportingCode) => reportingCode.value)
);

const output = {
  meta: {
    title: "2024 Illinois Offense Code Index",
    publisher: "Illinois Secretary of State Police",
    edition: "February 2024",
    sourcePages: 57,
    offenseEntries: entries.length,
    citedEntries: entries.filter((entry) => !entry.citationPlaceholder).length,
    placeholderEntries: entries.filter((entry) => entry.citationPlaceholder).length,
    mandatoryEntries: entries.filter((entry) => entry.mandatoryAppearance).length,
    reportingCodeTokens: reportingCodeValues.length,
    reportingCodeRows: entries.filter((entry) => entry.reportingCodes.length > 0).length,
    uniqueReportingCodes: new Set(reportingCodeValues).size,
    countyCodes: counties.length,
    generatedAt: new Date().toISOString(),
    validation: {
      primaryCandidates: primaryCandidates.length,
      unconsumedPrimaryCandidates,
      orphanUniformCodes,
    },
  },
  offenses: entries,
  counties,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(
  `Wrote ${entries.length} offense entries and ${counties.length} county codes to ${outputPath}`
);
console.log(
  `Validation: ${unconsumedPrimaryCandidates.length} unconsumed primary candidates, ${orphanUniformCodes.length} orphan uniform codes`
);
