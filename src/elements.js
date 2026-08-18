/**
 * Locate the operative statutory text for a record and present it as scannable clauses.
 *
 * Nothing here writes law. Every clause returned is a verbatim substring of what ILGA
 * served, so what an officer reads is the statute itself rather than a paraphrase of it.
 * That is a deliberate trade: a summary would read better, but a summary is someone's
 * reading of the law, and this product has no reviewer standing behind one.
 *
 * The 2024 index cites an exact subsection for most records ("12-503(a)",
 * "11-501(a)(1)"), which is what makes this targeted rather than a dump of the whole
 * section — 625 ILCS 5/12-503 runs to 25 blocks, nearly all penalties and administration.
 */

const STRUCTURAL = new Set(["citation", "historical-reference", "source", "heading", "version-note"]);

/** ILGA labels subsections both as "(a) ..." and, in older acts, as "A. ...". */
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
 * forward for "(5)" before the next top-level label. Returning the parent for a nested
 * citation would show a lead-in like "in any of the following situations:" and call it
 * the offence, which is worse than showing nothing.
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
      // A new top-level label means the nested item was not served separately.
      if (label && /^\([a-z]\)$/.test(label)) break;
    }
    // ILGA merges some nested items into their parent block, so the item simply is not
    // available separately. Report the depth reached rather than passing a lead-in off
    // as the element it introduces.
    if (next === -1) return { block: found, matchedDepth, requestedDepth: subsectionPath.length };
    start = next;
    found = body[next];
    matchedDepth += 1;
  }
  return { block: found, matchedDepth, requestedDepth: subsectionPath.length };
};

/**
 * Split one subsection into clauses on statutory punctuation only.
 *
 * Splitting never rewrites: each clause is returned exactly as it appears, so
 * qualifiers such as "knowingly", "more than", and "unless" survive by construction.
 */
export const clausesOf = (text, { maxClauses = 6 } = {}) => {
  const stripped = String(text ?? "").replace(/^\(?[A-Za-z0-9][\w.\-]*[).]\s*/, "").trim();
  if (!stripped) return [];

  const parts = stripped
    .split(/(?<=[;:])\s+/)
    .flatMap((part) => (part.length > 320 ? part.split(/(?<=\.)\s+(?=\(\d)/) : [part]))
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  return (parts.length ? parts : [stripped]).slice(0, maxClauses);
};

/**
 * Build the display payload for one record.
 *
 * `sourceText` on every clause is verbatim, which is what
 * scripts/validate-enrichment.mjs asserts against the retrieved section.
 */
export const elementsFor = ({ blocks, subsectionPath, citation }) => {
  const located = operativeBlock(blocks, subsectionPath);
  if (!located?.block) return null;
  const { block, matchedDepth, requestedDepth } = located;

  const clauses = clausesOf(block.text);
  if (!clauses.length) return null;

  const label = block.label ?? labelFor(block);
  return {
    subsection: label ? label.replace(/^\(|\)$/g, "") : null,
    // True when this really is the cited provision. False means we reached only an
    // enclosing subsection, and the interface must say so rather than imply precision.
    exact: matchedDepth === requestedDepth,
    citedSubsection: requestedDepth ? `(${(subsectionPath ?? []).join(")(")})` : null,
    clauses,
    sourceMapping: clauses.map((clause) => ({
      element: clause,
      statuteSource: citation,
      subsection: label ?? null,
      sourceText: clause,
    })),
  };
};
