const MAX_QUERY_LENGTH = 120;
const MAX_SERIALIZED_STATE_LENGTH = 2048;
const LOOKUP_PREFIX = "#lookup";
const SUPPORTED_KEYS = Object.freeze(["q", "family", "chapter", "appearance"]);
const SUPPORTED_KEY_SET = new Set(SUPPORTED_KEYS);
const CONTROL_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9a-f]{2})/iu;

export const DEFAULT_SHARE_STATE = Object.freeze({
  query: "",
  family: "all",
  chapter: "all",
  mandatoryOnly: false,
});

const emptyState = () => ({ ...DEFAULT_SHARE_STATE });

const hasControls = (value) => CONTROL_CHARACTER_PATTERN.test(value);

const hasValidEncoding = (value) => {
  if (MALFORMED_PERCENT_PATTERN.test(value)) return false;

  try {
    value
      .split("&")
      .flatMap((pair) => pair.split("="))
      .forEach((part) => decodeURIComponent(part.replaceAll("+", " ")));
    return true;
  } catch {
    return false;
  }
};

const asAllowedSet = (values) =>
  values instanceof Set ? values : new Set(Array.isArray(values) ? values : []);

const validationContext = ({ allowedFamilies = [], allowedChapters = [] } = {}) => ({
  families: asAllowedSet(allowedFamilies),
  chapters: asAllowedSet(allowedChapters),
});

export const normalizeShareQuery = (value) => {
  if (typeof value !== "string" || hasControls(value)) return null;

  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (normalized.length > MAX_QUERY_LENGTH || hasControls(normalized)) return null;
  return normalized;
};

const readSingleValue = (params, key) => {
  const values = params.getAll(key);
  return values.length > 1 ? null : values[0];
};

const parseParams = (rawParams, options, { allowDefaults = false } = {}) => {
  if (!hasValidEncoding(rawParams)) return null;

  const params = new URLSearchParams(rawParams);
  if ([...params.keys()].some((key) => !SUPPORTED_KEY_SET.has(key))) return null;
  if (SUPPORTED_KEYS.some((key) => params.getAll(key).length > 1)) return null;

  const state = emptyState();
  const queryValue = readSingleValue(params, "q");
  if (queryValue !== undefined) {
    state.query = normalizeShareQuery(queryValue);
    if (state.query === null) return null;
  }

  const { families, chapters } = validationContext(options);
  const family = readSingleValue(params, "family");
  if (family !== undefined && family !== "") {
    if (allowDefaults && family === "all") state.family = "all";
    else if (families.has(family) && !hasControls(family)) state.family = family;
    else return null;
  }

  const chapter = readSingleValue(params, "chapter");
  if (chapter !== undefined && chapter !== "") {
    if (allowDefaults && chapter === "all") state.chapter = "all";
    else if (chapters.has(chapter) && !hasControls(chapter)) state.chapter = chapter;
    else return null;
  }

  const appearance = readSingleValue(params, "appearance");
  if (appearance !== undefined && appearance !== "") {
    if (appearance !== "mandatory") return null;
    state.mandatoryOnly = true;
  }

  return state;
};

const normalizedSerializableState = (state, options) => {
  if (!state || typeof state !== "object") return null;

  const query = normalizeShareQuery(state.query ?? "");
  if (query === null) return null;

  const family = state.family ?? "all";
  const chapter = state.chapter ?? "all";
  const mandatoryOnly = state.mandatoryOnly ?? false;
  const { families, chapters } = validationContext(options);

  if (typeof family !== "string" || (family !== "all" && !families.has(family))) return null;
  if (typeof chapter !== "string" || (chapter !== "all" && !chapters.has(chapter))) return null;
  if (typeof mandatoryOnly !== "boolean") return null;
  if (hasControls(family) || hasControls(chapter)) return null;

  return { query, family, chapter, mandatoryOnly };
};

export const serializeShareState = (state = DEFAULT_SHARE_STATE, options = {}) => {
  const normalized = normalizedSerializableState(state, options);
  if (!normalized) throw new TypeError("Cannot serialize invalid share state");

  const params = new URLSearchParams();
  if (normalized.query) params.set("q", normalized.query);
  if (normalized.family !== "all") params.set("family", normalized.family);
  if (normalized.chapter !== "all") params.set("chapter", normalized.chapter);
  if (normalized.mandatoryOnly) params.set("appearance", "mandatory");

  const serialized = params.toString();
  return serialized ? `${LOOKUP_PREFIX}?${serialized}` : LOOKUP_PREFIX;
};

export const parseShareFragment = (fragment, options = {}) => {
  if (typeof fragment !== "string") return null;
  if (fragment.length > MAX_SERIALIZED_STATE_LENGTH) return null;
  if (fragment === LOOKUP_PREFIX || fragment === `${LOOKUP_PREFIX}?`) return emptyState();
  if (!fragment.startsWith(`${LOOKUP_PREFIX}?`)) return null;

  return parseParams(fragment.slice(LOOKUP_PREFIX.length + 1), options);
};

export const readLegacyShareState = (search, options = {}) => {
  if (typeof search !== "string") return null;
  if (search.length > MAX_SERIALIZED_STATE_LENGTH) return null;
  const rawParams = search.startsWith("?") ? search.slice(1) : search;
  if (!rawParams || !hasValidEncoding(rawParams)) return null;

  const params = new URLSearchParams(rawParams);
  const supportedEntries = [...params].filter(([key]) => SUPPORTED_KEY_SET.has(key));
  if (!supportedEntries.length) return null;

  const supported = new URLSearchParams();
  supportedEntries.forEach(([key, value]) => supported.append(key, value));
  const state = parseParams(supported.toString(), options, { allowDefaults: true });
  if (!state) return null;

  return {
    state,
    fragment: serializeShareState(state, options),
  };
};
