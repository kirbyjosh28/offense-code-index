const phraseAliases = new Map([
  ["driving drunk", "driving under the influence"],
  ["drunk driving", "driving under the influence"],
  ["no insurance", "uninsured motor vehicle"],
  ["hit and run", "leaving the scene"],
  ["expired plates", "expired registration"],
  ["fake id", "false identification"],
  ["phone while driving", "electronic communication device"],
  ["texting while driving", "electronic communication device"],
]);

const synonyms = new Map([
  ["drunk", ["intoxicated", "influence", "alcohol", "dui"]],
  ["dui", ["influence", "intoxicated", "alcohol"]],
  ["driving", ["operating", "driver", "vehicle"]],
  ["drive", ["operating", "driver", "vehicle"]],
  ["no", ["without", "uninsured", "failure"]],
  ["insurance", ["insured", "uninsured"]],
  ["plates", ["plate", "registration"]],
  ["plate", ["plates", "registration"]],
  ["speeding", ["speed", "fast"]],
  ["phone", ["telephone", "electronic", "communication", "device"]],
  ["texting", ["electronic", "communication", "device"]],
  ["weed", ["cannabis", "marijuana"]],
  ["pot", ["cannabis", "marijuana"]],
  ["crash", ["accident", "collision"]],
  ["accident", ["crash", "collision"]],
  ["suspended", ["suspension", "revoked"]],
  ["license", ["licence", "driver"]],
  ["child", ["minor", "juvenile"]],
  ["gun", ["firearm", "weapon"]],
]);

const stopWords = new Set(["a", "an", "and", "for", "of", "or", "the", "to", "with"]);

export const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const tokensFor = (value) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token && !stopWords.has(token));

const withinOneEdit = (left, right) => {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;

  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  return edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
};

const canonicalCodeFor = (offense) =>
  offense.code && offense.page <= 34 && !/ILCS|Section/i.test(offense.code)
    ? `625 ILCS 5/${offense.code}`
    : offense.code ?? "";

export const buildOffenseSearchDocument = (offense) => {
  const aliases = [];
  const description = normalizeText(offense.description);
  if (description.includes("driving under the influence")) aliases.push("dui drunk driving");
  if (description.includes("uninsured")) aliases.push("no insurance");
  if (description.includes("leaving the scene")) aliases.push("hit and run");
  if (description.includes("expired registration")) aliases.push("expired plates");

  return normalizeText(
    [
      offense.searchText,
      canonicalCodeFor(offense),
      offense.reportingCodes.map(({ value, role }) => `${value} ${role ?? ""}`).join(" "),
      aliases.join(" "),
    ].join(" ")
  );
};

const matchToken = (queryToken, documentTokens) => {
  const candidates = [queryToken, ...(synonyms.get(queryToken) ?? [])];
  let best = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    for (const documentToken of documentTokens) {
      if (candidate === documentToken) best = Math.min(best, 0);
      else if (
        candidate.length >= 3 &&
        documentToken.length >= 3 &&
        (documentToken.startsWith(candidate) || candidate.startsWith(documentToken))
      ) {
        best = Math.min(best, 1);
      } else if (
        candidate.length >= 5 &&
        documentToken.length >= 5 &&
        withinOneEdit(candidate, documentToken)
      ) {
        best = Math.min(best, 2);
      }
    }
  }

  return best;
};

export const scoreOffenseMatch = (offense, query) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const code = normalizeText(offense.code);
  const canonicalCode = normalizeText(canonicalCodeFor(offense));
  const reportingCodes = offense.reportingCodes.map(({ value }) => normalizeText(value));

  if (
    normalizedQuery === code ||
    normalizedQuery === canonicalCode ||
    reportingCodes.includes(normalizedQuery)
  ) {
    return 0;
  }

  const aliasedQuery = phraseAliases.get(normalizedQuery) ?? normalizedQuery;
  const searchDocument = offense.searchDocument ?? buildOffenseSearchDocument(offense);
  if (searchDocument.includes(normalizeText(aliasedQuery))) return 1;

  const queryTokens = tokensFor(aliasedQuery);
  const documentTokens = searchDocument.split(" ");
  if (!queryTokens.length) return Number.POSITIVE_INFINITY;

  let score = 2;
  for (const queryToken of queryTokens) {
    const tokenScore = matchToken(queryToken, documentTokens);
    if (!Number.isFinite(tokenScore)) return Number.POSITIVE_INFINITY;
    score += tokenScore;
  }

  return score;
};
