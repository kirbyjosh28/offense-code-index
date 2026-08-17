import { createHash } from "node:crypto";

/**
 * Illinois General Assembly (ILGA) citation resolution and statutory text extraction.
 *
 * This module is deliberately free of network calls so it can be unit tested against
 * saved fixtures. `scripts/verify-ilga.mjs` owns fetching; this module owns the pure
 * transforms: citation string -> DocName token, and ILGA HTML -> structured blocks.
 *
 * Two properties matter more than anything else here:
 *
 * 1. ILGA answers HTTP 200 for sections that do not exist. The status line is not a
 *    validity signal. Validity is established by the citation echoed in the embedded
 *    document title and by the absence of the "not currently available" sentinel.
 * 2. Extraction returns structured blocks, never HTML. The client renders with
 *    createElement/textContent under a Trusted Types CSP, so markup must not survive
 *    this boundary.
 */

/**
 * Every status a sweep can record for a section, and what it means.
 *
 * Single source of truth: `verify-ilga.mjs` emits these and `report-audit.mjs` documents
 * them from this map, so the audit's status table cannot drift from reality. The word
 * "verified" is deliberately absent — it is reserved for a recorded human review.
 */
export const SECTION_STATUS_DOCS = {
  retrieved: "ILGA served this section and the citation it returned matched the one requested.",
  repealed: "ILGA served the section and its text is marked repealed.",
  unavailable:
    'ILGA served its "not currently available" notice. The section was cited in 2024 and cannot be retrieved now — most often renumbered or repealed outright.',
  "citation-mismatch":
    "ILGA served a section whose citation differs from the one requested. Treat as unresolved.",
  "subsection-not-found":
    "The section was retrieved, but the specific subsection the 2024 record cites no longer appears in it.",
  unparseable:
    "A page was served but no statutory text could be read from it. Usually an ILGA layout change; not a finding about the law.",
  "fetch-failed": "Transport failure. Not a finding about the law; re-run the sweep.",
  "not-fetched": "No cached copy was available and the sweep ran offline. Re-run with network access.",
  "not-swept": "This section was outside a partial sweep's limit and was not checked on this run.",
};

/** Container for the embedded statute document on an ILGA fulltext page. */
const BILLTEXT_ANCHOR = "billtext-host";

/** ILGA's in-band "no such document" message. Served with HTTP 200. */
const UNAVAILABLE_PATTERN = /Document:\s*\S+\s*is not currently available/i;

const NAMED_ENTITIES = new Map([
  ["nbsp", " "],
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["ldquo", "“"],
  ["rdquo", "”"],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["ndash", "–"],
  ["mdash", "—"],
  ["hellip", "…"],
  ["sect", "§"],
  ["frac12", "½"],
  ["frac14", "¼"],
  ["frac34", "¾"],
  ["deg", "°"],
]);

const decodeEntities = (value) =>
  value.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (match, entity) => {
    if (entity.startsWith("#")) {
      const codePoint = entity[1] === "x" || entity[1] === "X"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return NAMED_ENTITIES.get(entity.toLowerCase()) ?? match;
  });

const stripTags = (value) => value.replace(/<[^>]*>/g, "");

/** Collapse runs of whitespace (including the non-breaking spaces ILGA indents with). */
const collapseWhitespace = (value) => value.replace(/[\s ]+/g, " ").trim();

const padSegment = (value, width) => String(value).padStart(width, "0");

/**
 * Build the ILGA `DocName` token for a section.
 *
 * The token is chapter(4) + act(4) + "0" + "K" + section, verified live against
 * 625 ILCS 5, 625 ILCS 40, 720 ILCS 5, and 720 ILCS 570.
 *
 *   625 ILCS 5/11-709   -> 062500050K11-709
 *   720 ILCS 570/402    -> 072005700K402
 */
export const buildDocName = ({ chapterId, actId, sectionId }) => {
  if (!chapterId || !actId || !sectionId) {
    throw new Error("buildDocName requires chapterId, actId, and sectionId.");
  }
  if (!/^\d+$/.test(String(chapterId)) || !/^\d+$/.test(String(actId))) {
    throw new Error(`Non-numeric ILCS chapter or act: ${chapterId} ILCS ${actId}`);
  }
  return `${padSegment(chapterId, 4)}${padSegment(actId, 4)}0K${sectionId}`;
};

/** Stable identity for a statutory section; the join key between records and text. */
export const sectionKeyFor = ({ chapterId, actId, sectionId }) =>
  `${padSegment(chapterId, 4)}-${padSegment(actId, 4)}-${sectionId}`;

export const formatCitation = ({ chapterId, actId, sectionId }) =>
  `${Number(chapterId)} ILCS ${Number(actId)}/${sectionId}`;

/**
 * Split a section identifier from its trailing subsection path.
 *
 *   "11-501(a)(1)"      -> { sectionId: "11-501", subsectionPath: ["a", "1"] }
 *   "24-1(A)(1)-(12)"   -> { sectionId: "24-1", subsectionPath: ["A", "1"], subsectionRange: "(A)(1)-(12)" }
 *
 * Ranges are recorded verbatim and never sliced: deciding which subsections a range
 * covers is a legal reading, not a string operation.
 */
export const splitSubsections = (rawSection) => {
  const trimmed = String(rawSection).trim();
  const boundary = trimmed.search(/\(/);
  if (boundary === -1) return { sectionId: trimmed, subsectionPath: [], subsectionRange: null };

  const sectionId = trimmed.slice(0, boundary).trim();
  const remainder = trimmed.slice(boundary).trim();
  const isRange = /-\s*\(/.test(remainder);
  const subsectionPath = [...remainder.matchAll(/\(([^()]+)\)/g)].map((match) => match[1]);

  return {
    sectionId,
    subsectionPath: isRange ? subsectionPath.slice(0, 2) : subsectionPath,
    subsectionRange: isRange ? remainder : null,
  };
};

/**
 * Parse a citation string into an explicit chapter/act/section model.
 *
 * `defaultChapterId`/`defaultActId` supply the act for bare Vehicle Code codes such as
 * "3-101", which the 2024 source publication prints without a chapter. Callers must
 * establish that a bare code really is Vehicle Code before supplying a default; this
 * function does not guess.
 */
export const parseCitation = (code, { defaultChapterId = null, defaultActId = null } = {}) => {
  if (typeof code !== "string" || !code.trim()) {
    return { resolution: "unresolved", reason: "empty-citation" };
  }

  const cleaned = code.trim().replace(/\s+/g, " ");
  const full = /^(\d+)\s+ILCS\s+([\d.]+)\s*\/\s*(.+)$/i.exec(cleaned);
  if (full) {
    const [, chapterId, actId, rawSection] = full;
    // "625 ILCS 40/-4-1" and friends: a stray leading separator is a source typo,
    // not a section named "-4-1". Flag rather than silently normalizing.
    if (/^[-/.]/.test(rawSection.trim())) {
      return { resolution: "unresolved", reason: "malformed-section", raw: cleaned };
    }
    const { sectionId, subsectionPath, subsectionRange } = splitSubsections(rawSection);
    if (!sectionId) return { resolution: "unresolved", reason: "malformed-section", raw: cleaned };
    return {
      resolution: "parsed",
      chapterId: String(Number(chapterId)),
      actId: String(Number(actId)),
      sectionId,
      subsectionPath,
      subsectionRange,
    };
  }

  // "Section 9-315.01" — a section with no chapter or act anywhere in the record.
  if (/^section\b/i.test(cleaned)) {
    return { resolution: "unresolved", reason: "no-chapter-or-act", raw: cleaned };
  }

  if (defaultChapterId && defaultActId) {
    const { sectionId, subsectionPath, subsectionRange } = splitSubsections(cleaned);
    if (sectionId && /^\d/.test(sectionId)) {
      return {
        resolution: "inferred",
        chapterId: String(defaultChapterId),
        actId: String(defaultActId),
        sectionId,
        subsectionPath,
        subsectionRange,
      };
    }
  }

  return { resolution: "unresolved", reason: "unrecognized-format", raw: cleaned };
};

/**
 * Parse the Public Acts out of a "(Source: ...)" line.
 *
 * A single section can carry several amending acts, semicolon separated, with only the
 * first prefixed "P.A.":
 *
 *   (Source: P.A. 97-1109, eff. 1-1-13; 98-187, eff. 1-1-14; 98-994, eff. 1-1-15.)
 *
 * Segments are split first so that an effective date such as "1-1-14" can never be
 * mistaken for an act number such as "98-187".
 */
export const parsePublicActs = (sourceLine) => {
  if (!sourceLine) return [];
  const body = sourceLine.replace(/^\(\s*Source:\s*/i, "").replace(/\)\s*$/, "");
  const acts = [];

  for (const segment of body.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed || /^revised\b/i.test(trimmed)) continue;
    const match = /^(?:P\.A\.\s*)?(\d{2,3}-\d{1,4})(?:\s*,\s*eff\.\s*([^.;)]+))?/i.exec(trimmed);
    if (!match) continue;
    acts.push({
      publicAct: match[1],
      effectiveDate: match[2] ? match[2].trim().replace(/\.$/, "") : null,
    });
  }

  return acts;
};

/**
 * Parse an ILGA effective date such as "1-1-25" or "8-13-99" into a comparable value.
 *
 * Two-digit years span both centuries. The swept corpus contains 684 of them, 38 from
 * the 1990s, and reading every one as 20xx put "8-13-99" in 2099 — which filled the
 * audit's "amended since February 2024" table with amendments predating it by a quarter
 * century, sorted to the top. ILCS Public Acts begin in 1971, so 70 is a safe pivot.
 */
const TWO_DIGIT_YEAR_PIVOT = 70;

export const parseEffectiveDate = (value) => {
  if (!value) return null;
  const match = /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/.exec(String(value).trim());
  if (!match) return null;

  const [, month, day, rawYear] = match;
  const shortYear = Number(rawYear);
  const year =
    rawYear.length === 4
      ? shortYear
      : shortYear >= TWO_DIGIT_YEAR_PIVOT
        ? 1900 + shortYear
        : 2000 + shortYear;

  return {
    year,
    month: Number(month),
    day: Number(day),
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
};

const classifyBlock = (text) => {
  if (/^\(\s*\d+\s+ILCS\b/i.test(text)) return { type: "citation" };
  if (/^\(from\s+Ch\./i.test(text)) return { type: "historical-reference" };
  if (/^\(Source:/i.test(text)) return { type: "source" };
  if (/^\(Text of Section/i.test(text)) return { type: "version-note" };
  if (/^Sec\.\s/i.test(text)) return { type: "heading" };

  const labelled = /^\(([A-Za-z0-9]{1,4}(?:\.\d+)?)\)\s+/.exec(text);
  if (labelled) return { type: "subsection", label: `(${labelled[1]})` };

  return { type: "paragraph" };
};

/**
 * Extract structured statutory text from an ILGA fulltext page.
 *
 * Returns `{ available, canonicalCitation, headingText, blocks, sourceLine, publicActs,
 * repealed, bodyText }`. `available: false` means ILGA served its in-band
 * "not currently available" notice, or the page carried no statute container at all.
 */
export const extractStatutoryText = (html) => {
  const empty = {
    available: false,
    canonicalCitation: null,
    headingText: null,
    blocks: [],
    sourceLine: null,
    publicActs: [],
    repealed: false,
    bodyText: "",
  };

  if (typeof html !== "string" || !html) return { ...empty, reason: "empty-response" };

  const anchor = html.indexOf(BILLTEXT_ANCHOR);
  if (anchor === -1) return { ...empty, reason: "no-statute-container" };

  const bodyOpen = html.indexOf("<body", anchor);
  const bodyEnd = html.indexOf("</body>", bodyOpen === -1 ? anchor : bodyOpen);

  // The unavailable notice replaces the whole embedded document, so it has no <body>.
  // Check for it before concluding the container was malformed.
  if (bodyOpen === -1 || bodyEnd === -1) {
    const region = decodeEntities(stripTags(html.slice(anchor, anchor + 4000)));
    return { ...empty, reason: UNAVAILABLE_PATTERN.test(region) ? "not-available" : "no-statute-container" };
  }

  const contentStart = html.indexOf(">", bodyOpen);
  const inner = html.slice(contentStart + 1, bodyEnd);

  if (UNAVAILABLE_PATTERN.test(decodeEntities(stripTags(inner)))) {
    return { ...empty, reason: "not-available" };
  }

  // The embedded document titles itself with the canonical citation. This is the only
  // trustworthy confirmation that we received the section we asked for.
  const titleMatch = /<title>([^<]*)<\/title>/i.exec(html.slice(anchor, contentStart));
  const rawTitle = titleMatch ? collapseWhitespace(decodeEntities(titleMatch[1])) : "";
  const canonicalCitation = /^\d+\s+ILCS\b/i.test(rawTitle) ? rawTitle : null;

  const blocks = inner
    .split(/<br\s*\/?>/i)
    .map((fragment) => collapseWhitespace(decodeEntities(stripTags(fragment))))
    .filter(Boolean)
    .map((text) => ({ ...classifyBlock(text), text }));

  if (!blocks.length) return { ...empty, canonicalCitation, reason: "no-statute-text" };

  const sourceBlock = blocks.find((block) => block.type === "source");
  const headingBlock = blocks.find((block) => block.type === "heading");
  const sourceLine = sourceBlock ? sourceBlock.text : null;

  const publicActs = parsePublicActs(sourceLine);

  const bodyBlocks = blocks.filter((block) => block.type !== "source");

  return {
    available: true,
    canonicalCitation,
    headingText: headingBlock ? headingBlock.text : null,
    blocks,
    sourceLine,
    publicActs,
    repealed: bodyBlocks.some((block) => /\(\s*Repealed\s*\)/i.test(block.text)),
    bodyText: bodyBlocks.map((block) => block.text).join("\n"),
  };
};

/**
 * Content fingerprint for change detection.
 *
 * Hashes the normalized statutory body only. Page chrome is already gone, and the
 * "(Source: P.A. ...)" line is excluded so that an amendment shows up as a body diff
 * and a Public Act update, which are reported separately rather than as one opaque
 * hash mismatch.
 */
export const hashStatutoryBody = (bodyText) =>
  createHash("sha256").update(collapseWhitespace(bodyText), "utf8").digest("hex");

/** Confirm ILGA returned the section we asked for, not a neighbour or a redirect. */
export const citationMatches = (canonicalCitation, expected) => {
  if (!canonicalCitation) return false;
  const normalize = (value) => value.replace(/\s+/g, "").toLowerCase();
  return normalize(canonicalCitation) === normalize(formatCitation(expected));
};

/**
 * Does the fetched section still contain the cited subsection?
 *
 * A section can survive an amendment while the specific subsection a 2024 record cites
 * is renumbered or removed. Returns null when there is nothing to check.
 */
export const subsectionPresent = (blocks, subsectionPath) => {
  if (!Array.isArray(subsectionPath) || !subsectionPath.length) return null;
  const [first] = subsectionPath;
  const label = String(first).toLowerCase();
  const parenthesized = `(${label})`;

  // ILCS uses both conventions, sometimes within the same act: "(a) A person commits..."
  // and "A. At a rate of speed...". Checking only the first would report a subsection as
  // missing whenever an act happens to use the other one.
  return blocks.some((block) => {
    if (block.label && block.label.toLowerCase() === parenthesized) return true;
    const text = block.text.toLowerCase();
    // Parenthesized labels are matched anywhere in the block because ILGA frequently
    // runs several subsections together into one line; the lettered form is matched
    // only at the start, where it is unambiguous.
    return text.includes(`${parenthesized} `) || text.startsWith(`${label}. `);
  });
};
