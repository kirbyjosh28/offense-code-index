/**
 * Locate the operative statutory text for a record and present it as its elements.
 *
 * Nothing here writes law. Every element and exception returned is a verbatim substring
 * of what ILGA served — cuts land only on punctuation that already separates provisions,
 * so qualifiers such as "knowingly", "more than", and "unless" survive by construction.
 *
 * There is a ceiling to that, and it is deliberate. Roughly two thirds of offences are a
 * single statutory sentence whose elements only exist if someone rewrites them. Splitting
 * harder produced fragments like "(5) of subsection (b) of this Section is guilty of…",
 * which is worse than not splitting. Granularity therefore comes from emphasising the
 * qualifiers inside verbatim text, not from cutting it into smaller pieces.
 */

const STRUCTURAL = new Set(["citation", "historical-reference", "source", "heading", "version-note"]);

/** ILGA labels subsections both as "(a) …" and, in older acts, as "A. …". */
const labelFor = (block) => {
  if (block.label) return block.label.toLowerCase();
  const parenthesized = /^\(([A-Za-z0-9][\w.\-]*)\)/.exec(block.text);
  if (parenthesized) return `(${parenthesized[1]})`.toLowerCase();
  const lettered = /^([A-Za-z0-9][\w.\-]*)\.\s/.exec(block.text);
  return lettered ? `(${lettered[1]})`.toLowerCase() : null;
};

export const bodyBlocks = (blocks) => (blocks ?? []).filter((block) => !STRUCTURAL.has(block.type));

/**
 * Walk the cited subsection path through the flattened block list.
 *
 * ILGA serves nested items as sibling blocks, so "(b)(5)" means: find "(b)", then scan
 * forward for "(5)" before the next top-level label. Some nested provisions are merged
 * into their parent and simply are not available separately, so the depth reached is
 * reported rather than passing a lead-in off as the element it introduces.
 */
export const operativeBlock = (blocks, subsectionPath = []) => {
  const body = bodyBlocks(blocks);
  if (!body.length) return null;
  if (!subsectionPath?.length) return { block: body[0], matchedDepth: 0, requestedDepth: 0 };

  let start = body.findIndex((block) => labelFor(block) === `(${subsectionPath[0]})`.toLowerCase());
  if (start === -1) return { block: body[0], matchedDepth: 0, requestedDepth: subsectionPath.length };
  let found = body[start];
  let matchedDepth = 1;

  for (const part of subsectionPath.slice(1)) {
    const wanted = `(${part})`.toLowerCase();
    let next = -1;
    for (let index = start + 1; index < body.length; index += 1) {
      const label = labelFor(body[index]);
      if (label === wanted) { next = index; break; }
      if (label && /^\([a-z]\)$/.test(label)) break;
    }
    if (next === -1) return { block: found, matchedDepth, requestedDepth: subsectionPath.length };
    start = next;
    found = body[next];
    matchedDepth += 1;
  }
  return { block: found, matchedDepth, requestedDepth: subsectionPath.length };
};

/**
 * Words that introduce an enumerated cross-reference rather than a new provision.
 *
 * "…who violates paragraph (5) of subsection (b)…" must not be cut at "(5)". Splitting
 * there produced "(5) of subsection (b) of this Section is guilty of…", a fragment that
 * reads as though it were the offence.
 */
const CROSS_REFERENCE = /(paragraph|subparagraph|subsection|subdivision|section|clause|item)\s*(\([^)]*\)\s*)*(,|;|\bor\b|\band\b)?\s*$/i;

/**
 * A marker only starts a new element when the text before it has actually finished.
 *
 * Requiring the preceding chunk to end at `;` or `:` — or to be empty — is what stops
 * cuts inside a reference like "paragraph (3) or (4) of subsection (a)". Splitting there
 * produced "(4) of subsection (a) shall constitute a failure to keep records", which
 * reads as though it were the offence.
 */
const splitEnumerated = (text) => {
  const parts = [];
  let cursor = 0;
  const pattern = /\s+(?=\((?:\d+|[ivx]+)\)\s)/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const preceding = text.slice(cursor, match.index);
    const trimmed = preceding.trim();
    if (trimmed && !/[;:]$/.test(trimmed)) continue;
    if (CROSS_REFERENCE.test(preceding)) continue;
    parts.push(preceding);
    cursor = match.index + match[0].length;
  }
  parts.push(text.slice(cursor));
  return parts.filter((part) => part.trim().length > 0);
};

/**
 * A clause is an exception only when it is *about* not applying.
 *
 * ILCS routinely opens an operative sentence with "Except as provided in Section X, …".
 * That is a cross-reference qualifier on the duty, not an exception to it — filing it
 * under exceptions moved 3-101's actual duty ("every owner … shall make application")
 * out of the elements entirely.
 */
const EXCEPTION = new RegExp(
  [
    "^nothing\\s+in\\s+this\\b",
    "^unless\\b",
    "^(this|that)\\s+(section|subsection|paragraph|code)\\b[^.]{0,80}\\b(does\\s+not|shall\\s+not)\\s+apply",
    "^subsections?\\s+\\([^)]+\\)[^.]{0,80}\\b(does\\s+not|shall\\s+not)\\s+apply",
    "^the\\s+provisions\\s+of\\s+this\\b[^.]{0,80}\\b(does\\s+not|shall\\s+not)\\s+apply",
    "^except\\s+that\\b",
  ].join("|"),
  "i"
);

export const isException = (clause) => EXCEPTION.test(String(clause ?? "").trim());

/**
 * Split one subsection into clauses on statutory punctuation only.
 *
 * Never rewrites: each clause is returned exactly as it appears in the retrieved text.
 */
export const clausesOf = (text) => {
  const stripped = String(text ?? "").replace(/^\(?[A-Za-z0-9][\w.\-]*[).]\s*/, "").trim();
  if (!stripped) return [];

  const parts = stripped
    .split(/(?<=[;:])\s+/)
    .flatMap((part) => part.split(/(?<=\.)\s+(?=[A-Z(])/))
    .flatMap(splitEnumerated)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  return parts.length ? parts : [stripped];
};

/** How many clauses to show before the interface says the rest were omitted. */
const MAX_SHOWN = 8;

/**
 * Build the display payload for one record.
 *
 * `elements` and `exceptions` are both verbatim. `exact` is true only when the block
 * shown really is the provision the record cites — a record with no cited subsection
 * gets the section's opening provision, which the interface must label as such.
 */
export const elementsFor = ({ blocks, subsectionPath = [], citation }) => {
  const located = operativeBlock(blocks, subsectionPath);
  if (!located?.block) return null;
  const { block, matchedDepth, requestedDepth } = located;

  const clauses = clausesOf(block.text);
  if (!clauses.length) return null;

  const flagged = clauses.filter(isException);
  // Some provisions are wholly about when they do not apply — 625 ILCS 5/12-611 is one
  // sentence saying so. Filing every clause under exceptions would leave a panel with
  // nothing in it, so in that case the clauses are the provision.
  const splitApplies = flagged.length < clauses.length;
  const exceptions = splitApplies ? flagged : [];
  const allElements = splitApplies ? clauses.filter((clause) => !isException(clause)) : clauses;
  const elements = allElements.slice(0, MAX_SHOWN);

  const label = block.label ?? labelFor(block);
  return {
    subsection: label ? label.replace(/^\(|\)$/g, "") : null,
    // False means this is the section's opening provision rather than the cited one.
    exact: requestedDepth > 0 && matchedDepth === requestedDepth,
    citedSubsection: requestedDepth ? `(${subsectionPath.join(")(")})` : null,
    elements,
    exceptions,
    // Stated on screen: silently dropping statutory text would be the worst failure here.
    truncated: allElements.length - elements.length,
    sourceMapping: [...elements, ...exceptions].map((clause) => ({
      element: clause,
      statuteSource: citation,
      subsection: label ?? null,
      sourceText: clause,
    })),
  };
};

/**
 * Qualifiers an officer has to satisfy, emphasised in place.
 *
 * Emphasis is presentation only — the rendered text is byte-identical to the statute.
 */
export const QUALIFIERS = [
  "knowingly", "intentionally", "recklessly", "wilfully", "willfully",
  "not less than", "not more than", "more than", "less than", "greater than", "at least",
  "shall not", "may not", "no person", "fails to", "without", "unless", "except",
];

const QUALIFIER_PATTERN = new RegExp(`\\b(${QUALIFIERS.join("|")})\\b`, "gi");

/**
 * Split a clause into plain and emphasised segments.
 *
 * Returns `[{ text, emphasis }]`. Concatenating every `text` reproduces the input
 * exactly, which `test/elements.test.mjs` asserts for every clause in the corpus.
 */
export const emphasize = (clause) => {
  const source = String(clause ?? "");
  const segments = [];
  let cursor = 0;

  for (const match of source.matchAll(QUALIFIER_PATTERN)) {
    if (match.index > cursor) segments.push({ text: source.slice(cursor, match.index), emphasis: false });
    segments.push({ text: match[0], emphasis: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), emphasis: false });

  return segments.length ? segments : [{ text: source, emphasis: false }];
};
