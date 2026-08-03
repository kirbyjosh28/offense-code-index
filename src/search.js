const phraseAliases = [
  ["one headlight is out", "improper lighting one headlamp"],
  ["one headlight out", "improper lighting one headlamp"],
  ["left headlight is out", "improper lighting one headlamp"],
  ["right headlight is out", "improper lighting one headlamp"],
  ["headlights not working", "improper lighting one headlamp"],
  ["headlight not working", "improper lighting one headlamp"],
  ["broken headlights", "improper lighting one headlamp"],
  ["broken headlight", "improper lighting one headlamp"],
  ["headlight is out", "improper lighting one headlamp"],
  ["headlight out", "improper lighting one headlamp"],
  ["tail lights not working", "no red taillight"],
  ["taillights not working", "no red taillight"],
  ["taillight not working", "no red taillight"],
  ["broken tail lights", "no red taillight"],
  ["broken taillights", "no red taillight"],
  ["broken taillight", "no red taillight"],
  ["tail light is out", "no red taillight"],
  ["taillight is out", "no red taillight"],
  ["tail light out", "no red taillight"],
  ["taillight out", "no red taillight"],
  ["brake lights not working", "no stop light signal lamp"],
  ["brake light not working", "no stop light signal lamp"],
  ["brake lights out", "no stop light signal lamp"],
  ["brake light out", "no stop light signal lamp"],
  ["broken brake lights", "no stop light signal lamp"],
  ["broken brake light", "no stop light signal lamp"],
  ["windshield wipers not working", "no windshield clearing device"],
  ["broken windshield wipers", "no windshield clearing device"],
  ["windshield wipers", "windshield clearing device"],
  ["cracked windshield", "defective windshield"],
  ["broken windshield", "defective windshield"],
  ["loud exhaust system", "muffler loud excessive noise"],
  ["loud exhaust", "muffler loud excessive noise"],
  ["no exhaust", "no muffler"],
  ["bald tires", "unsafe tire tread"],
  ["worn out tires", "unsafe tire tread"],
  ["worn tires", "unsafe tire tread"],
  ["ran through a red light", "disobeying traffic control signal"],
  ["ran through red light", "disobeying traffic control signal"],
  ["went through a red light", "disobeying traffic control signal"],
  ["went through red light", "disobeying traffic control signal"],
  ["ran a red light", "disobeying traffic control signal"],
  ["ran red light", "disobeying traffic control signal"],
  ["rolled through a stop sign", "disobeying stop sign"],
  ["rolled through stop sign", "disobeying stop sign"],
  ["did not stop at stop sign", "disobeying stop sign"],
  ["passed a stopped school bus", "passed school bus loading unloading"],
  ["passed stopped school bus", "passed school bus loading unloading"],
  ["school bus stop arm", "passed school bus loading unloading"],
  ["texting on my phone while driving", "electronic communication device"],
  ["using a phone while driving", "electronic communication device"],
  ["driving without car insurance", "operating uninsured motor vehicle"],
  ["driving without insurance", "operating uninsured motor vehicle"],
  ["leaving after a car accident", "leaving scene crash"],
  ["left after a car accident", "leaving scene crash"],
  ["ran away after an accident", "leaving scene crash"],
  ["ran away after a crash", "leaving scene crash"],
  ["driving while intoxicated", "driving under influence"],
  ["driving while impaired", "driving under influence"],
  ["driving while drunk", "driving under influence"],
  ["texting while driving", "electronic communication device"],
  ["phone while driving", "electronic communication device"],
  ["cell phone driving", "electronic communication device"],
  ["over the legal limit", "alcohol concentration blood breath 0 08"],
  ["blood alcohol level", "alcohol concentration blood breath"],
  ["blood alcohol content", "alcohol concentration blood breath"],
  ["no proof of insurance", "uninsured motor vehicle"],
  ["without insurance", "uninsured motor vehicle"],
  ["no car insurance", "uninsured motor vehicle"],
  ["no insurance", "uninsured motor vehicle"],
  ["impaired driving", "driving under influence"],
  ["driving drunk", "driving under influence"],
  ["drunk driving", "driving under influence"],
  ["hit and run", "leaving scene crash"],
  ["left the scene", "leaving scene"],
  ["fled the scene", "leaving scene"],
  ["expired license plates", "expired registration"],
  ["expired plates", "expired registration"],
  ["expired tags", "expired registration"],
  ["no license plates", "registration plate"],
  ["no valid license", "driver license invalid"],
  ["license was taken away", "driving while license suspended"],
  ["license taken away", "driving while license suspended"],
  ["suspended license", "driving license suspended"],
  ["revoked license", "driving license revoked"],
  ["not wearing a seatbelt", "seat belt"],
  ["not wearing seatbelt", "seat belt"],
  ["no seat belt", "seat belt"],
  ["no seatbelt", "seat belt"],
  ["child not in car seat", "child passenger restraint"],
  ["no car seat", "child passenger restraint"],
  ["handicap parking", "disabilities parking"],
  ["disabled parking", "disabilities parking"],
  ["fake identification", "false identification"],
  ["fake id", "false identification"],
  ["stolen car", "stolen motor vehicle"],
  ["weed possession", "cannabis possession"],
  ["headlights", "headlamp"],
  ["headlight", "headlamp"],
  ["tail lights", "taillight"],
  ["taillights", "taillight"],
  ["brake lights", "stop light"],
  ["wipers", "clearing device"],
].sort((left, right) => right[0].length - left[0].length);

const synonyms = new Map([
  ["drunk", ["intoxicated", "influence", "alcohol", "dui", "impaired"]],
  ["dui", ["influence", "intoxicated", "alcohol", "impaired"]],
  ["dwi", ["influence", "intoxicated", "alcohol", "impaired"]],
  ["impaired", ["influence", "intoxicated", "alcohol", "dui"]],
  ["driving", ["operating", "driver", "drive"]],
  ["drive", ["operating", "driver", "driving"]],
  ["car", ["vehicle", "motor"]],
  ["auto", ["vehicle", "motor"]],
  ["no", ["without", "uninsured", "failure"]],
  ["without", ["no", "uninsured", "failure"]],
  ["insurance", ["insured", "uninsured"]],
  ["insured", ["insurance", "uninsured"]],
  ["plates", ["plate", "registration", "tags"]],
  ["plate", ["plates", "registration", "tag"]],
  ["tags", ["tag", "plate", "registration"]],
  ["speeding", ["speed", "fast"]],
  ["fast", ["speed", "speeding"]],
  ["phone", ["telephone", "electronic", "communication", "device", "cellular"]],
  ["cell", ["cellular", "telephone", "electronic", "device"]],
  ["texting", ["text", "electronic", "communication", "device"]],
  ["weed", ["cannabis", "marijuana"]],
  ["pot", ["cannabis", "marijuana"]],
  ["marijuana", ["cannabis"]],
  ["crash", ["accident", "collision", "wreck"]],
  ["accident", ["crash", "collision", "wreck"]],
  ["wreck", ["crash", "accident", "collision"]],
  ["suspended", ["suspension", "revoked"]],
  ["revoked", ["revocation", "suspended"]],
  ["license", ["licence", "driver"]],
  ["child", ["minor", "juvenile", "kid"]],
  ["kid", ["child", "minor", "juvenile"]],
  ["gun", ["firearm", "weapon"]],
  ["stolen", ["theft", "steal"]],
  ["seatbelt", ["seat", "belt", "restraint"]],
  ["fake", ["false", "fraudulent"]],
  ["broken", ["defective", "failure", "improper", "unsafe", "no"]],
  ["defective", ["broken", "failure", "improper", "unsafe", "no"]],
  ["out", ["no", "without", "defective", "failure", "improper", "insufficient"]],
  ["headlamp", ["headlight", "headlights"]],
  ["headlight", ["headlamp", "headlights"]],
  ["taillight", ["taillights"]],
  ["brake", ["stop", "signal"]],
  ["wiper", ["wipers", "clearing", "device"]],
  ["exhaust", ["muffler", "noise"]],
  ["bald", ["unsafe", "worn", "tread"]],
  ["tires", ["tire", "tread"]],
  ["tire", ["tires", "tread"]],
  ["red", ["traffic", "signal"]],
]);

const stopWords = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "be",
  "caught",
  "charge",
  "charged",
  "code",
  "doesn",
  "dont",
  "find",
  "for",
  "got",
  "had",
  "has",
  "have",
  "i",
  "is",
  "law",
  "me",
  "my",
  "of",
  "offense",
  "or",
  "person",
  "please",
  "show",
  "someone",
  "t",
  "the",
  "their",
  "ticket",
  "ticketed",
  "to",
  "violation",
  "was",
  "what",
  "whats",
  "when",
  "with",
  "would",
]);

export const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const applyPhraseAliases = (value) => {
  let expanded = ` ${normalizeText(value)} `;
  phraseAliases.forEach(([phrase, replacement]) => {
    expanded = expanded.replaceAll(` ${phrase} `, ` ${replacement} `);
  });
  return expanded.trim().replace(/\s+/g, " ");
};

const tokensFor = (value) =>
  applyPhraseAliases(value)
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

export const buildOffensePrimarySearchDocument = (offense) => {
  const description = normalizeText(offense.description);
  const aliases = [];

  if (description.includes("under the influence")) {
    aliases.push("dui dwi drunk driving impaired driving");
  }
  if (description.includes("alcohol concentration")) {
    aliases.push("bac blood alcohol over legal limit drunk driving");
  }
  if (description.includes("uninsured")) {
    aliases.push("no insurance without insurance no proof insurance");
  }
  if (description.includes("leaving the scene") || description.includes("leaving scene")) {
    aliases.push("hit and run left scene fled scene accident crash");
  }
  if (description.includes("expired registration")) aliases.push("expired plates expired tags");
  if (description.includes("electronic communication")) {
    aliases.push("texting phone cell phone while driving");
  }
  if (description.includes("seat belt")) aliases.push("seatbelt no seatbelt restraint");
  if (description.includes("child") && description.includes("restraint")) {
    aliases.push("car seat booster child passenger restraint");
  }
  if (description.includes("disabilities parking") || description.includes("placard")) {
    aliases.push("handicap parking disabled parking");
  }
  if (description.includes("cannabis")) aliases.push("weed marijuana pot");
  if (description.includes("firearm") || description.includes("weapon")) aliases.push("gun");

  if (
    description.includes("headlamp") ||
    description.includes("headlight") ||
    description.includes("driving without lights when required")
  ) {
    aliases.push("headlight headlights head lamp headlamp headlamps front light front lights");
  }
  if (description.includes("taillight") || description.includes("tail lamp")) {
    aliases.push("taillight taillights tail light tail lights rear light rear lights");
  }
  if (description.includes("driving without lights when required")) {
    aliases.push("taillight taillights tail light tail lights rear light rear lights");
  }
  if (description.includes("stop light") || description.includes("signal lamp")) {
    aliases.push("brake light brake lights stop lamp stop lamps");
  }
  if (description.includes("back-up lights")) aliases.push("backup light backup lights reverse lights");
  if (description.includes("windshield clearing device")) {
    aliases.push("windshield wiper windshield wipers wiper blades broken wipers");
  }
  if (description.includes("defective windshield")) {
    aliases.push("cracked windshield broken windshield damaged windshield");
  }
  if (description.includes("muffler")) aliases.push("exhaust loud exhaust exhaust system");
  if (description.includes("unsafe tire") || description.includes("tread groove depth")) {
    aliases.push("bald tire bald tires worn tire worn tires tire tread");
  }
  if (description.includes("disobeying traffic control signal")) {
    aliases.push("ran red light run red light went through red light traffic light violation");
  }
  if (description.includes("disobeying stop sign")) {
    aliases.push("rolled stop sign ran stop sign did not stop stop sign violation");
  }
  if (description.includes("passed school bus") && description.includes("loading or unloading")) {
    aliases.push("school bus stop arm stopped school bus flashing bus lights");
  }
  if (description.includes("left-side mirrors") || description === "mirrors") {
    aliases.push("rearview mirror side mirror broken mirror no mirror");
  }

  return normalizeText(
    [
      offense.description,
      offense.code,
      canonicalCodeFor(offense),
      offense.reportingCodes.map(({ value, role }) => `${value} ${role ?? ""}`).join(" "),
      aliases.join(" "),
    ].join(" ")
  );
};

export const buildOffenseSearchDocument = (offense) =>
  normalizeText(
    [
      offense.primarySearchDocument ?? buildOffensePrimarySearchDocument(offense),
      offense.searchText,
    ].join(" ")
  );

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

const scoreTokens = (queryTokens, documentTokens, baseScore) => {
  let score = baseScore;
  for (const queryToken of queryTokens) {
    const tokenScore = matchToken(queryToken, documentTokens);
    if (!Number.isFinite(tokenScore)) return Number.POSITIVE_INFINITY;
    score += tokenScore;
  }
  return score;
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

  const expandedQuery = applyPhraseAliases(normalizedQuery);
  if (expandedQuery.includes("driving under influence") && /^11-501/i.test(offense.code ?? "")) {
    return 0.5;
  }
  if (expandedQuery.includes("uninsured motor vehicle") && offense.code === "3-707") {
    return 0.5;
  }

  const description = normalizeText(offense.description);
  if (description.includes(expandedQuery)) return 0.75;

  const searchDocument = offense.searchDocument ?? buildOffenseSearchDocument(offense);
  const queryTokens = tokensFor(expandedQuery);
  if (!queryTokens.length) return Number.POSITIVE_INFINITY;

  const primaryDocument =
    offense.primarySearchDocument ?? buildOffensePrimarySearchDocument(offense);
  if (primaryDocument.includes(expandedQuery)) return 1;

  const primaryScore = scoreTokens(queryTokens, primaryDocument.split(" "), 2);
  if (Number.isFinite(primaryScore)) return primaryScore;

  if (searchDocument.includes(expandedQuery)) return 20;

  return scoreTokens(queryTokens, searchDocument.split(" "), 21);
};
