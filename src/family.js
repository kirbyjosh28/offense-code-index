/**
 * Browse facets for offense records.
 *
 * This is a navigation aid, not a legal classification.
 *
 * The original heuristic inferred "Vehicle Code" from a record's page in the February
 * 2024 source publication, which is right for the great majority of bare codes and wrong
 * for the acts printed inside that page range — the Illinois Identification Card Act and
 * the Child Passenger Protection Act are neither 625 ILCS 5. When the build has joined
 * in the explicit citation model, the facet comes from the record's actual chapter and
 * act instead; the heuristic remains as a fallback so behaviour is unchanged wherever
 * the model is absent.
 */

export const FAMILIES = [
  "Vehicle Code",
  "Criminal Code",
  "Drugs & public health",
  "Recreation vehicles",
  "Other Illinois statutes",
];

const DRUG_AND_HEALTH_ACTS = /^720 ILCS (?:550|570|600|635|648|670|675|685|690)\//i;
const RECREATION_CHAPTERS = /SNOWMOBILE|BOAT REGISTRATION/i;

export const familyFromCitation = (citation, chapter) => {
  if (/^720 ILCS 5\//i.test(citation)) return "Criminal Code";
  if (DRUG_AND_HEALTH_ACTS.test(citation)) return "Drugs & public health";
  if (/^625 ILCS (?:40|45)\//i.test(citation)) return "Recreation vehicles";
  if (RECREATION_CHAPTERS.test(chapter ?? "")) return "Recreation vehicles";
  if (/^625 ILCS 5\//i.test(citation)) return "Vehicle Code";
  return "Other Illinois statutes";
};

/** The pre-citation-model heuristic, kept so records without a citation behave as before. */
export const familyFromPagePosition = (offense) => {
  const code = offense.code ?? "";
  if (/^720 ILCS 5\//i.test(code)) return "Criminal Code";
  if (DRUG_AND_HEALTH_ACTS.test(code)) return "Drugs & public health";
  if (RECREATION_CHAPTERS.test(offense.chapter ?? "")) return "Recreation vehicles";
  if (!/ILCS|Section/i.test(code) || offense.page <= 34) return "Vehicle Code";
  return "Other Illinois statutes";
};

export const familyFor = (offense) =>
  offense.citation
    ? familyFromCitation(offense.citation, offense.chapter)
    : familyFromPagePosition(offense);
