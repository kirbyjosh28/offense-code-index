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
  ["license plate light out", "no rear registration plate light"],
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
  ["plate from another vehicle", "improper use registration title"],
  ["plates from another vehicle", "improper use registration title"],
  ["wrong license plate", "improper use registration title"],
  ["wrong license plates", "improper use registration title"],
  ["wrong plate", "improper use registration title"],
  ["wrong plates", "improper use registration title"],
  ["illegal window tint", "tinted windshield front side windows"],
  ["dark window tint", "tinted windshield front side windows"],
  ["window tint", "tinted windshield front side windows"],
  ["illegal tint", "tinted windshield front side windows"],
  ["open alcohol container", "illegal transportation possession alcoholic liquor driver"],
  ["open container of alcohol", "illegal transportation possession alcoholic liquor driver"],
  ["open container", "illegal transportation possession alcoholic liquor driver"],
  ["open beer", "illegal transportation possession alcoholic liquor driver"],
  ["open alcohol", "illegal transportation possession alcoholic liquor driver"],
  ["no license plates", "registration plate"],
  ["no valid license", "no valid driver license expired"],
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
  ["illegal disability placard", "unlawful use persons disabilities placard"],
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
  ["only rear plate displayed", "no front registration plate"],
  ["vehicle was following another car too closely", "following too closely"],
  ["ran from police in car", "fleeing police officer"],
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
  ["suspended", ["suspension"]],
  ["revoked", ["revocation"]],
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
  ["tint", ["tinted", "window", "windshield"]],
  ["container", ["transportation", "possession"]],
  ["beer", ["alcohol", "alcoholic", "liquor"]],
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

export const applyPhraseAliases = (value) => {
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

/**
 * The fully qualified ILCS citation for a record.
 *
 * Prefers the explicit citation model built by scripts/build-citation-model.mjs, which
 * resolves each record's chapter and act from its citation and chapter heading. Falls
 * back to the original page-position heuristic for records the model has not reached,
 * so behaviour is unchanged wherever the model is absent.
 *
 * The heuristic reads "printed on a page of the Vehicle Code portion of the source
 * publication" as "is Vehicle Code". That is true for the great majority of bare codes
 * but not all of them: the Illinois Identification Card Act and the Child Passenger
 * Protection Act are both printed inside that page range and are neither 625 ILCS 5.
 */
const canonicalCodeFor = (offense) =>
  offense.fullCitation ??
  (offense.code && offense.page <= 34 && !/ILCS|Section/i.test(offense.code)
    ? `625 ILCS 5/${offense.code}`
    : offense.code ?? "");

const intentRules = [
  {
    id: "wrong-plates",
    phrases: [
      "wrong plates",
      "wrong plate",
      "wrong license plates",
      "wrong license plate",
      "plates from another vehicle",
      "plate from another vehicle",
      "plates do not belong",
    ],
    codes: ["3-703"],
    reason: "Matched wrong-plate wording",
  },
  {
    id: "window-tint",
    phrases: ["illegal tint", "window tint", "dark tint", "tinted windows", "illegal window tint"],
    codes: ["12-503(a)"],
    reason: "Matched window-tint wording",
  },
  {
    id: "open-container",
    phrases: [
      "open alcohol",
      "open beer",
      "open container",
      "alcohol in the car",
      "liquor in the car",
    ],
    codes: ["11-502(a)", "11-502(b)"],
    reason: "Matched open-container wording",
  },
  {
    id: "no-valid-license",
    phrases: [
      "no valid license",
      "without a valid license",
      "does not have a license",
      "unlicensed driver",
      "expired driver license",
      "no dl",
      "no d l",
      "no drivers license",
      "no driver license",
      "no license",
    ],
    codes: ["6-101"],
    reason: "Matched invalid-license wording",
  },
  {
    // Scott's Law. Named for Lieutenant Scott Gillen, killed in 2000 while working a
    // crash on the Dan Ryan. Officers ask for it by name far more often than by section,
    // and by name it previously returned nothing at all.
    id: "scotts-law",
    phrases: [
      "scotts law",
      "scott law",
      "scott s law",
      "move over",
      "move over law",
      "failure to move over",
      "emergency vehicle lane",
      "approaching emergency vehicle",
      "slow down move over",
    ],
    codes: ["11-907(c)", "11-907(a)(1)", "11-907.5"],
    reason: "Matched Scott's Law wording",
  },
  {
    id: "center-line",
    phrases: [
      "crossed center line",
      "crossed the center line",
      "center line",
      "centerline",
      "over the center line",
      "wrong side of the road",
      "wrong side of road",
      "drove into oncoming traffic",
      "oncoming lane",
    ],
    codes: ["11-708", "11-701"],
    reason: "Matched wrong-side-of-road wording",
  },
  {
    // "dui" alone previously ranked 6-304.1 (permitting another person to drive under
    // the influence) above the offence itself.
    id: "dui",
    // Only the bare abbreviations. Fuller phrasings ("impaired driving", "drunk
    // driving") already expand to "driving under influence" and are handled downstream
    // by the established 11-501 rule, whose wording the benchmark pins.
    phrases: ["dui", "d u i", "dwi"],
    codes: ["11-501(a)(1)", "11-501(a)(2)", "11-501(a)(4)"],
    reason: "Matched driving-under-the-influence wording",
  },
  {
    // The general offence outranks the commercial-vehicle-specific one, which only won
    // because its description contains the literal word "texting".
    id: "texting",
    phrases: ["texting", "texting while driving", "text while driving", "on the phone", "cell phone", "cellphone"],
    codes: ["12-610.2"],
    reason: "Matched electronic-device wording",
  },
  {
    id: "revoked-license",
    phrases: ["revoked license", "license revoked", "driving while revoked"],
    codes: ["6-303"],
    reason: "Matched revoked-license wording",
  },
  {
    id: "suspended-license",
    phrases: ["suspended license", "license suspended", "driving while suspended"],
    codes: ["6-303"],
    reason: "Matched suspended-license wording",
  },
];

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

/**
 * Rebuild a record's broad search text from the fields it is derived from.
 *
 * The source corpus ships a precomputed `searchText` for every record, which is pure
 * duplication of fields already present. The build strips it and the client rebuilds it
 * here, which is why the reconstruction has to be exact rather than merely equivalent:
 * `test/search.test.mjs` asserts it reproduces all 953 stored values byte for byte.
 */
export const buildOffenseSearchText = (offense) => {
  const reportingCodes = (offense.reportingCodes ?? []).flatMap(({ value, role }) =>
    role ? [value, role] : [value]
  );

  return [offense.code, ...reportingCodes, offense.description, offense.chapter, offense.section]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

export const buildOffenseSearchDocument = (offense) =>
  normalizeText(
    [
      offense.primarySearchDocument ?? buildOffensePrimarySearchDocument(offense),
      offense.searchText ?? buildOffenseSearchText(offense),
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
  let usedTypoFallback = false;
  for (const queryToken of queryTokens) {
    const tokenScore = matchToken(queryToken, documentTokens);
    if (!Number.isFinite(tokenScore)) {
      return { score: Number.POSITIVE_INFINITY, usedTypoFallback: false };
    }
    if (tokenScore === 2) usedTypoFallback = true;
    score += tokenScore;
  }
  return { score, usedTypoFallback };
};

const compactCode = (value) => normalizeText(value).replaceAll(" ", "");

const intentRulesFor = (normalizedQuery) =>
  intentRules.filter(({ phrases }) =>
    phrases.some((phrase) => normalizedQuery.includes(normalizeText(phrase)))
  );

const speedingCodeFor = (normalizedQuery) => {
  if (!/\b(?:speed|speeding|fast)\b/.test(normalizedQuery)) return null;
  const match = normalizedQuery.match(
    /\b(\d{1,3})\s*(?:mph\s*)?(?:over|above)\b|\b(?:over|above)\s*(\d{1,3})\b/
  );
  const amount = Number(match?.[1] ?? match?.[2]);
  if (!Number.isFinite(amount) || amount < 1) return null;
  if (amount <= 25) return { amount, code: "11-601(b)" };
  if (amount < 35) return { amount, code: "11-601.5(a)" };
  return { amount, code: "11-601.5(b)" };
};

const parseSearchQuery = (query) => {
  const normalized = normalizeText(query);
  const expanded = applyPhraseAliases(normalized);
  const codeLetters = normalized
    .replace(/\b(?:ilcs|section)\b/g, "")
    .replace(/[0-9\s]/g, "");
  return {
    normalized,
    expanded,
    tokens: tokensFor(expanded),
    compactCode: compactCode(normalized),
    looksLikeCode:
      /\d/.test(normalized) && codeLetters.length <= 4 && !/[a-z]{2,}/.test(codeLetters),
    intents: intentRulesFor(normalized),
    speeding: speedingCodeFor(normalized),
  };
};

const prepareOffense = (offense, index) => {
  const primaryDocument =
    offense.primarySearchDocument ?? buildOffensePrimarySearchDocument(offense);
  const searchDocument = offense.searchDocument ?? buildOffenseSearchDocument(offense);
  return {
    offense,
    index,
    code: normalizeText(offense.code),
    canonicalCode: normalizeText(canonicalCodeFor(offense)),
    compactCodes: [offense.code, canonicalCodeFor(offense)].filter(Boolean).map(compactCode),
    reportingCodes: offense.reportingCodes.map(({ value }) => normalizeText(value)),
    compactReportingCodes: offense.reportingCodes.map(({ value }) => compactCode(value)),
    description: normalizeText(offense.description),
    primaryDocument,
    primaryTokens: primaryDocument.split(" "),
    searchDocument,
    searchTokens: searchDocument.split(" "),
  };
};

const conflictPenaltyFor = (entry, parsed) => {
  const query = parsed.normalized;
  const description = entry.description;
  let penalty = 0;

  if (query.includes("revoked") && description.includes("suspended") && !description.includes("revoked")) {
    penalty += 60;
  }
  if (query.includes("suspended") && description.includes("revoked") && !description.includes("suspended")) {
    penalty += 60;
  }
  if (query.includes("front") && description.includes("rear") && !description.includes("front")) {
    penalty += 30;
  }
  if (query.includes("rear") && description.includes("front") && !description.includes("rear")) {
    penalty += 30;
  }
  if (/\bhead(?:light|lamp)/.test(query) && /\b(?:tail|rear)\s*(?:light|lamp)/.test(description)) {
    penalty += 30;
  }
  if (/\btail\s*light|\btaillight/.test(query) && /\bheadlamp|\bheadlight/.test(description)) {
    penalty += 30;
  }
  if (query.includes("wrong") && query.includes("plate") && description.includes("expired")) {
    penalty += 60;
  }
  if (query.includes("expired") && description.includes("improper use")) penalty += 60;

  return penalty;
};

const matchedRangesFor = (entry, parsed) => {
  if (!parsed.normalized) return [];
  const ranges = [];
  const sourceFields = [
    ["code", String(entry.offense.code ?? "")],
    ["description", String(entry.offense.description ?? "")],
  ];
  const terms = [...new Set(parsed.normalized.split(" ").filter((term) => term.length >= 3))];

  sourceFields.forEach(([field, value]) => {
    const lowered = value.toLowerCase();
    terms.forEach((term) => {
      const start = lowered.indexOf(term);
      if (start >= 0) ranges.push({ field, start, end: start + term.length });
    });
  });
  return ranges;
};

const rankPreparedOffense = (entry, parsed) => {
  if (!parsed.normalized) {
    return { score: 0, reason: "Complete index", matchedFields: [] };
  }

  let best = {
    score: Number.POSITIVE_INFINITY,
    reason: "",
    matchedFields: [],
  };
  const consider = (score, reason, matchedFields) => {
    if (score < best.score) best = { score, reason, matchedFields };
  };

  if (parsed.normalized === entry.code || parsed.normalized === entry.canonicalCode) {
    consider(0, "Exact ILCS code", ["code"]);
  }
  if (entry.reportingCodes.includes(parsed.normalized)) {
    consider(0, "Exact SOS reporting code", ["reportingCode"]);
  }
  if (parsed.looksLikeCode && parsed.compactCode.length >= 3) {
    const codeMatch = entry.compactCodes.find((code) => code.includes(parsed.compactCode));
    const reportingMatch = entry.compactReportingCodes.find((code) =>
      code.startsWith(parsed.compactCode)
    );
    if (codeMatch) {
      consider(0.2 + Math.max(0, codeMatch.length - parsed.compactCode.length) / 100, "Partial ILCS code", ["code"]);
    }
    if (reportingMatch) {
      consider(0.3, "Partial SOS reporting code", ["reportingCode"]);
    }
  }

  if (parsed.speeding?.code === entry.offense.code) {
    consider(
      0.4,
      `Matched ${parsed.speeding.amount} mph over range`,
      ["numericQualifier", "description"]
    );
  }

  parsed.intents.forEach((intent) => {
    const targetIndex = intent.codes.indexOf(entry.offense.code);
    if (targetIndex >= 0) {
      consider(0.5 + targetIndex / 20, intent.reason, ["concept", "description"]);
    }
  });

  if (parsed.expanded.includes("driving under influence") && /^11-501/i.test(entry.offense.code ?? "")) {
    consider(0.6, "Matched impaired-driving wording", ["concept", "description"]);
  }
  if (parsed.expanded.includes("uninsured motor vehicle") && entry.offense.code === "3-707") {
    consider(0.6, "Matched uninsured-vehicle wording", ["concept", "description"]);
  }
  if (entry.description.includes(parsed.expanded)) {
    consider(0.75, "Exact description phrase", ["description"]);
  }
  if (entry.primaryDocument.includes(parsed.expanded)) {
    consider(1, "Matched common officer wording", ["description", "concept"]);
  }

  if (parsed.tokens.length) {
    const primary = scoreTokens(parsed.tokens, entry.primaryTokens, 2);
    if (Number.isFinite(primary.score)) {
      consider(
        primary.score,
        primary.usedTypoFallback ? "Matched with a minor spelling difference" : "Matched all key terms",
        ["description", "concept"]
      );
    }
    if (entry.searchDocument.includes(parsed.expanded)) {
      consider(20, "Matched index wording", ["description", "context"]);
    }
    const broad = scoreTokens(parsed.tokens, entry.searchTokens, 21);
    if (Number.isFinite(broad.score)) {
      consider(
        broad.score,
        broad.usedTypoFallback ? "Related wording with a spelling difference" : "Matched related index terms",
        ["context"]
      );
    }
  }

  if (!Number.isFinite(best.score)) return best;
  if (best.score > 0) best.score += conflictPenaltyFor(entry, parsed);
  return best;
};

export const createSearchIndex = (offenses) => ({
  entries: offenses.map((offense, index) => prepareOffense(offense, index)),
});

export const querySearchIndex = (
  searchIndex,
  { text = "", filters = {}, limit = 8 } = {}
) => {
  const parsed = parseSearchQuery(text);
  const ranked = searchIndex.entries
    .map((entry) => ({ entry, match: rankPreparedOffense(entry, parsed) }))
    .filter(({ match }) => Number.isFinite(match.score))
    .sort(
      (left, right) => left.match.score - right.match.score || left.entry.index - right.entry.index
    );

  const filtered = ranked.filter(({ entry }) => {
    const offense = entry.offense;
    if (filters.family && filters.family !== "all" && offense.family !== filters.family) return false;
    if (filters.chapter && filters.chapter !== "all" && offense.chapter !== filters.chapter) return false;
    if (filters.mandatoryOnly && !offense.mandatoryAppearance) return false;
    return true;
  });
  const toCandidate = ({ entry, match }) => ({
    offense: entry.offense,
    offenseId: entry.offense.id,
    score: match.score,
    reason: match.reason,
    matchedFields: match.matchedFields,
    matchedRanges: matchedRangesFor(entry, parsed),
  });
  const matches = filtered.map(toCandidate);

  return {
    total: matches.length,
    hiddenByFilters: Math.max(0, ranked.length - filtered.length),
    candidates: parsed.normalized ? matches.slice(0, Math.max(0, limit)) : [],
    matches,
  };
};

export const scoreOffenseMatch = (offense, query) => {
  const parsed = parseSearchQuery(query);
  return rankPreparedOffense(prepareOffense(offense, 0), parsed).score;
};
