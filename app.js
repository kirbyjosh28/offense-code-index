import {
  buildOffensePrimarySearchDocument,
  buildOffenseSearchDocument,
  createSearchIndex,
  normalizeText,
  querySearchIndex,
} from "./src/search.js";
import {
  createFreshnessMonitor,
  fetchBuildVersion,
  isBuildId,
} from "./src/freshness.js";
import {
  parseShareFragment,
  readLegacyShareState,
  serializeShareState,
} from "./src/share-state.js";
import { FAMILIES, familyFor } from "./src/family.js";
import { elementsFor, emphasize } from "./src/elements.js";

document.documentElement.classList.add("js");

const DATA_URL = "./src/data/lookup-index.json";
const SECTION_URL_PREFIX = "./src/data/enrichment/sections/";
const SOURCE_VERSION_URL = "./config/source-version.json";
const CONTENT_STATUS_URL = "./config/content-status.json";
const SOURCE_PDF = "https://www.ilsos.gov/content/dam/departments/police/offense_code24.pdf";
const ISSUE_URL = "https://github.com/kirbyjosh28/offense-code-index/issues/new";
const MAX_QUERY_LENGTH = 120;
const MAX_HASH_LENGTH = 220;
const THEME_STORAGE_KEY = "offense-index-theme";
const SHORTCUT_STORAGE_KEY = "offense-index-slash-shortcut";
const UPDATE_SUPPRESSION_KEY = "offense-index-dismissed-build";
const RECENT_SELECTIONS_KEY = "offense-index-recent-selections";
const MAX_RECENT_SELECTIONS = 5;

const guides = [
  {
    id: "guide-index-scope",
    title: "Index Scope & Reporting Codes",
    pages: "PDF page 2",
    pdfPage: 2,
    description: "Publication limits, the current-law warning, and how Secretary of State Police uses four-digit reporting codes.",
  },
  {
    id: "guide-pretrial-fairness",
    title: "Pretrial Fairness Act",
    pages: "PDF pages 2–3",
    pdfPage: 2,
    description: "Proceedings after arrest, release by citation, pretrial release, and referenced implementation flowcharts.",
  },
  {
    id: "guide-notice-to-appear",
    title: "Notice to Appear",
    pages: "PDF page 3",
    pdfPage: 3,
    description: "The Notice to Appear summary and explanation of the mandatory-court-appearance marker.",
  },
  {
    id: "guide-supreme-court-rules",
    title: "Illinois Supreme Court Rules",
    pages: "PDF pages 3–7",
    pdfPage: 3,
    description: "Rules 504, 529, 530, 531, 551, 552, 553, 554, and the Rule 501(g) definition.",
  },
  {
    id: "guide-required-appearance",
    title: "Required Appearance Under Rule 551",
    pages: "PDF pages 5–6",
    pdfPage: 5,
    description: "Allegations and circumstances that require an in-person or remote court appearance.",
  },
  {
    id: "guide-traffic-release",
    title: "Traffic Enforcement & Pretrial Release",
    pages: "PDF pages 6–7",
    pdfPage: 6,
    description: "625 ILCS 5/6-308 and jurisdictions not yet in the Nonresident Violator Compact.",
  },
  {
    id: "guide-under-21",
    title: "Drivers Under Age 21",
    pages: "PDF page 7",
    pdfPage: 7,
    description: "Alcohol, graduated-driver, zero-tolerance, and phone-related provisions for drivers under 21.",
  },
  {
    id: "guide-plate-weights",
    title: "License Plate Weight Chart",
    pages: "PDF page 11",
    pdfPage: 11,
    description: "Flat-weight, mileage, farm-truck, and farm-trailer designations and maximum gross weights.",
  },
  {
    id: "guide-placards-contacts",
    title: "Disability Placards & Publication Contacts",
    pages: "PDF pages 54–56",
    pdfPage: 54,
    description: "Placard identification, publication ordering, report-form contacts, and corrections information.",
  },
];

const state = {
  data: null,
  sourceVersion: null,
  contentStatus: null,
  searchIndex: null,
  searchResult: null,
  query: "",
  family: "all",
  chapter: "all",
  mandatoryOnly: false,
  slashShortcutEnabled: true,
  resultCount: 0,
  activeCandidateIndex: -1,
  recentOffenseIds: [],
  filtersOpen: false,
  searchOpen: false,
  sharedLookupActive: false,
};

const elements = {
  siteHeader: document.querySelector(".site-header"),
  searchExperience: document.querySelector("#search-experience"),
  search: document.querySelector("#search"),
  searchShell: document.querySelector(".search-shell"),
  searchDock: document.querySelector(".search-dock"),
  searchTools: document.querySelector("#search-tools"),
  searchStartView: document.querySelector("#search-start-view"),
  searchResultsView: document.querySelector("#search-results-view"),
  searchAssist: document.querySelector("#search-assist"),
  searchMatchCount: document.querySelector("#search-match-count"),
  sourceReviewStatus: document.querySelector("#source-review-status"),
  commandResults: document.querySelector("#command-results"),
  commandResultTotal: document.querySelector("#command-result-total"),
  commandEmpty: document.querySelector("#command-empty"),
  hiddenFilterNote: document.querySelector("#hidden-filter-note"),
  recentSearches: document.querySelector("#recent-searches"),
  recentResults: document.querySelector("#recent-results"),
  clearRecents: document.querySelector("#clear-recents"),
  clearSearch: document.querySelector("#clear-search"),
  results: document.querySelector("#results"),
  resultSummary: document.querySelector("#result-summary"),
  offensesSection: document.querySelector("#offenses"),
  emptyState: document.querySelector("#empty-state"),
  emptyReset: document.querySelector("#empty-reset"),
  recordKey: document.querySelector(".record-key"),
  contentStatusPanel: document.querySelector("#content-status-panel"),
  contentStatusHeading: document.querySelector("#content-status-heading"),
  contentStatusMessage: document.querySelector("#content-status-message"),
  familyFilter: document.querySelector("#family-filter"),
  chapterFilter: document.querySelector("#chapter-filter"),
  mandatoryFilter: document.querySelector("#mandatory-filter"),
  quickFamilyFilters: document.querySelectorAll("[data-family-filter]"),
  quickMandatory: document.querySelector("#quick-mandatory"),
  shortcutToggle: document.querySelector("#shortcut-toggle"),
  moreFilters: document.querySelector("#more-filters"),
  browseFilterToggle: document.querySelector("#browse-filter-toggle"),
  activeFilterCount: document.querySelector("#active-filter-count"),
  filterBar: document.querySelector("#filter-bar"),
  resetFilters: document.querySelector("#reset-filters"),
  guideList: document.querySelector("#guide-list"),
  searchPrompts: document.querySelectorAll("[data-search-query]"),
  copyLink: document.querySelector("#copy-link"),
  clearLocalData: document.querySelector("#clear-local-data"),
  themeToggle: document.querySelector("#theme-toggle"),
  toast: document.querySelector("#toast"),
  updatePrompt: document.querySelector("#update-prompt"),
  updateAnnouncement: document.querySelector("#update-announcement"),
  updateLater: document.querySelector("#update-later"),
  updateRefresh: document.querySelector("#update-refresh"),
  statuteSheet: document.querySelector("#statute-sheet"),
  statuteSheetTitle: document.querySelector("#statute-sheet-title"),
  statuteSheetBody: document.querySelector("#statute-sheet-body"),
  statuteSheetClose: document.querySelector("#statute-sheet-close"),
};

const decodeHash = (value) => {
  if (!value) return null;
  if (value.length > MAX_HASH_LENGTH) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * "#offense/<id>" scrolls to a record and opens its statutory detail.
 *
 * This is a third fragment shape alongside "#lookup?..." and a bare "#<id>". The bare
 * form keeps its original behaviour of scrolling only, so links shared before this
 * existed still resolve exactly as they did.
 */
const OFFENSE_HASH_PREFIX = "#offense/";

const readOffenseHash = (hash) =>
  hash.startsWith(OFFENSE_HASH_PREFIX) ? decodeHash(hash.slice(OFFENSE_HASH_PREFIX.length)) : null;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlight = (value, query) => {
  const text = String(value ?? "");
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || !text.toLowerCase().includes(normalizedQuery.toLowerCase())) {
    return document.createTextNode(text);
  }

  const fragment = document.createDocumentFragment();
  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig");
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    fragment.append(document.createTextNode(text.slice(cursor, match.index)));
    const mark = document.createElement("mark");
    mark.textContent = match[0];
    fragment.append(mark);
    cursor = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(text.slice(cursor)));
  return fragment;
};

const setToast = (message) => {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(setToast.timeout);
  setToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2200);
};

const writeClipboard = async (text, successMessage) => {
  try {
    await navigator.clipboard.writeText(text);
    setToast(successMessage);
  } catch {
    setToast("Copy failed. Select and copy the text manually.");
  }
};

const readThemePreference = () => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeThemePreference = (theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Intentionally ignore storage failures in restricted/private contexts.
  }
};

const readShortcutPreference = () => {
  try {
    return localStorage.getItem(SHORTCUT_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
};

const writeShortcutPreference = (enabled) => {
  try {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Intentionally ignore storage failures in restricted/private contexts.
  }
};

const readSuppressedBuild = () => {
  try {
    return sessionStorage.getItem(UPDATE_SUPPRESSION_KEY);
  } catch {
    return null;
  }
};

const writeSuppressedBuild = (build) => {
  try {
    sessionStorage.setItem(UPDATE_SUPPRESSION_KEY, build);
  } catch {
    // Intentionally ignore storage failures in restricted/private contexts.
  }
};

const readRecentSelections = () => {
  try {
    const value = JSON.parse(sessionStorage.getItem(RECENT_SELECTIONS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((id) => typeof id === "string").slice(0, MAX_RECENT_SELECTIONS);
  } catch {
    return [];
  }
};

const writeRecentSelections = () => {
  try {
    sessionStorage.setItem(RECENT_SELECTIONS_KEY, JSON.stringify(state.recentOffenseIds));
  } catch {
    // Search remains fully available when session storage is unavailable.
  }
};

const rememberOffense = (offenseId) => {
  state.recentOffenseIds = [
    offenseId,
    ...state.recentOffenseIds.filter((id) => id !== offenseId),
  ].slice(0, MAX_RECENT_SELECTIONS);
  writeRecentSelections();
};

const applyShortcutPreference = (enabled, persist = false) => {
  state.slashShortcutEnabled = enabled;
  elements.shortcutToggle.setAttribute("aria-pressed", String(enabled));
  elements.shortcutToggle.textContent = enabled ? "Shortcut on" : "Shortcut off";
  elements.searchAssist.textContent = enabled
    ? "Results update as you type. Press slash from anywhere to focus search."
    : "Results update as you type. The slash shortcut is off.";
  if (enabled) elements.search.setAttribute("aria-keyshortcuts", "/");
  else elements.search.removeAttribute("aria-keyshortcuts");
  if (persist) writeShortcutPreference(enabled);
};

const createOffenseRow = (offense) => {
  const displayCode = offense.code ?? "No direct citation";
  // The statute is the authority; the 2024 reporting code is provenance for the record
  // existing at all. Lead with the resolved ILCS citation where one was established.
  const headlineCitation = offense.fullCitation ?? displayCode;
  const row = document.createElement("article");
  row.className = "offense-row";
  row.id = offense.id;
  row.setAttribute("role", "listitem");
  row.tabIndex = -1;

  const codeColumn = document.createElement("div");
  codeColumn.className = "code-column";

  const codeLabel = document.createElement("span");
  codeLabel.className = "micro-label";
  codeLabel.textContent = offense.fullCitation ? "ILCS Section" : "Source Code";
  const primaryCode = document.createElement("h3");
  primaryCode.className = "primary-code";
  primaryCode.id = `${offense.id}-code`;
  primaryCode.append(highlight(headlineCitation, state.query));
  codeColumn.append(codeLabel, primaryCode);

  if (offense.statutoryFlagged) {
    const flag = document.createElement("span");
    flag.className = "statutory-flag";
    // No aria-label here: on a non-interactive element it would replace the visible
    // wording for screen readers. The full explanation is stated in the panel itself.
    flag.textContent =
      offense.statutoryStatus === "subsection-not-found" ? "Subsection not found" : "Check current statute";
    codeColumn.append(flag);
  }

  if (offense.reportingCodes.length) {
    const reportingCodes = document.createElement("div");
    reportingCodes.className = "reporting-codes";
    offense.reportingCodes.forEach(({ value, role }) => {
      const code = document.createElement("span");
      code.textContent = `SOS ${value}${role ? ` · ${role}` : ""}`;
      code.setAttribute(
        "aria-label",
        `Secretary of State Police reporting code ${value}${role ? `, ${role}` : ""}`
      );
      reportingCodes.append(code);
    });
    codeColumn.append(reportingCodes);
  }

  if (offense.mandatoryAppearance) {
    const badge = document.createElement("span");
    badge.className = "mandatory-badge";
    badge.textContent = "Court appearance required";
    codeColumn.append(badge);
  }

  const descriptionColumn = document.createElement("div");
  descriptionColumn.className = "description-column";
  const descriptionLabel = document.createElement("span");
  descriptionLabel.className = "sr-only";
  descriptionLabel.textContent = "February 2024 index label: ";

  const description = document.createElement("p");
  description.className = "offense-description";
  description.append(descriptionLabel);
  description.append(highlight(offense.description, state.query));
  const context = document.createElement("p");
  context.className = "offense-context";
  context.textContent = `${offense.chapter} · ${offense.section}`;

  const officialHeading = offense.statutoryHeading ? document.createElement("p") : null;
  if (officialHeading) {
    officialHeading.className = "official-heading";
    officialHeading.textContent = offense.statutoryHeading;
    officialHeading.setAttribute(
      "aria-label",
      `Official Illinois General Assembly section title for ${offense.citation}`
    );
  }

  const sourceLink = document.createElement("a");
  sourceLink.className = "source-proof";
  sourceLink.href = `${SOURCE_PDF}#page=${offense.page}`;
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.setAttribute(
    "aria-label",
    `Open the February 2024 Illinois Secretary of State Police source publication to PDF page ${offense.page} for ILCS section ${displayCode} in a new tab`
  );

  const sourceDetail = document.createElement("span");
  sourceDetail.className = "source-proof-detail";
  sourceDetail.textContent = `2024 index · PDF page ${offense.page}`;
  const sourceAction = document.createElement("span");
  sourceAction.className = "source-proof-action";
  sourceAction.textContent = "↗";
  sourceLink.append(sourceDetail, sourceAction);

  const advisory = document.createElement("p");
  advisory.className = "record-advisory";
  const sourceReview = state.sourceVersion?.review;
  const corpusStatus = state.contentStatus?.corpus?.status;
  const reviewStatus = corpusStatus === "superseded"
    ? "corpus superseded"
    : sourceReview?.status === "active" && corpusStatus === "active"
      ? "review active"
      : "review due";
  const reviewDates = sourceReview?.lastReviewedDate && sourceReview?.nextReviewDate
    ? `reviewed ${sourceReview.lastReviewedDate}; next review ${sourceReview.nextReviewDate}`
    : "review dates pending approval";
  advisory.textContent = `Possible source match · Independent reference · ${reviewStatus}; ${reviewDates} · Verify current ILCS and agency policy.`;
  const correctionLink = document.createElement("a");
  correctionLink.href = "/trust/corrections.html";
  correctionLink.textContent = "Report a correction";
  correctionLink.setAttribute("aria-label", `Report a correction for ILCS section ${displayCode}`);
  advisory.append(document.createTextNode(" "), correctionLink);

  descriptionColumn.append(description);
  if (officialHeading) descriptionColumn.append(officialHeading);
  descriptionColumn.append(context, sourceLink, advisory);

  const actions = document.createElement("div");
  actions.className = "offense-actions";
  const copyButton = document.createElement("button");
  copyButton.className = "row-action";
  copyButton.type = "button";
  copyButton.textContent = "Copy";
  copyButton.setAttribute("aria-label", `Copy full record for ILCS section ${displayCode}`);
  copyButton.addEventListener("click", () => {
    const reporting = offense.reportingCodes.length
      ? ` (${offense.reportingCodes
          .map(({ value, role }) => (role ? `${value}-${role}` : value))
          .join(", ")})`
      : "";
    writeClipboard(
      `${offense.mandatoryAppearance ? "*" : ""}${headlineCitation}${reporting}: ${offense.description}\nPossible match from the February 2024 source publication. Verify current ILCS and agency policy.`,
      `${displayCode} copied`
    );
  });

  const linkButton = document.createElement("button");
  linkButton.className = "row-action";
  linkButton.type = "button";
  linkButton.textContent = "Link";
  linkButton.setAttribute("aria-label", `Copy direct link to ILCS section ${displayCode}`);
  linkButton.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = encodeURIComponent(offense.id);
    writeClipboard(url.toString(), `Link to ${displayCode} copied`);
  });
  actions.append(copyButton, linkButton);

  // Records with no resolved statutory section get no detail affordance rather than an
  // affordance that opens an empty panel.
  // Records with no resolved statutory section get no affordance rather than one that
  // opens an empty sheet.
  if (offense.sectionKey) {
    const statuteButton = document.createElement("button");
    statuteButton.className = "row-action";
    statuteButton.type = "button";
    statuteButton.id = `${offense.id}-statute`;
    statuteButton.textContent = "Statute";
    statuteButton.setAttribute("aria-haspopup", "dialog");
    statuteButton.setAttribute("aria-label", `Show current statutory text for ${offense.citation}`);
    statuteButton.addEventListener("click", () => {
      openStatuteSheet(offense, { returnFocusTo: statuteButton });
    });
    actions.append(statuteButton);
  }

  row.append(codeColumn, descriptionColumn, actions);
  return row;
};

const createGuideRow = (guide, index) => {
  const row = document.createElement("article");
  row.className = "guide-row";
  row.id = guide.id;
  row.setAttribute("role", "listitem");

  const number = document.createElement("span");
  number.className = "guide-number";
  number.textContent = String(index + 1).padStart(2, "0");

  const content = document.createElement("div");
  const pages = document.createElement("p");
  pages.className = "guide-pages";
  pages.textContent = guide.pages;
  const title = document.createElement("h3");
  title.textContent = guide.title;
  const description = document.createElement("p");
  description.textContent = guide.description;
  content.append(pages, title, description);

  const link = document.createElement("a");
  link.href = `${SOURCE_PDF}#page=${guide.pdfPage}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open PDF";
  link.setAttribute(
    "aria-label",
    `Open ${guide.title} on PDF page ${guide.pdfPage} in the official source in a new tab`
  );

  row.append(number, content, link);
  return row;
};

const activeFilters = () => ({
  family: state.family,
  chapter: state.chapter,
  mandatoryOnly: state.mandatoryOnly,
});

const activeFilterCount = () =>
  Number(state.family !== "all") + Number(state.chapter !== "all") + Number(state.mandatoryOnly);

const offenseById = (offenseId) =>
  state.data?.offenses.find((offense) => offense.id === offenseId) ?? null;

const createCandidateOption = (candidate, index) => {
  const { offense } = candidate;
  const option = document.createElement("div");
  option.className = "command-option";
  option.id = `command-option-${index}`;
  option.dataset.offenseId = offense.id;
  option.setAttribute("role", "option");
  option.tabIndex = -1;
  option.setAttribute("aria-selected", String(index === state.activeCandidateIndex));

  const code = document.createElement("span");
  code.className = "command-code";
  code.append(highlight(offense.code ?? "No direct citation", state.query));

  const description = document.createElement("span");
  description.className = "command-description";
  description.append(highlight(offense.description, state.query));

  const detail = document.createElement("span");
  detail.className = "command-detail";
  detail.textContent = `Possible match · ${candidate.reason} · ${offense.family} · PDF ${offense.page}`;

  if (offense.mandatoryAppearance) {
    const court = document.createElement("span");
    court.className = "command-court";
    court.textContent = "Court required";
    court.setAttribute("aria-label", "Court appearance required");
    option.append(code, description, detail, court);
  } else {
    option.append(code, description, detail);
  }

  option.addEventListener("pointermove", () => setActiveCandidate(index, false));
  option.addEventListener("click", () => selectCandidate(offense.id));
  return option;
};

const setActiveCandidate = (index, scroll = true) => {
  const options = [...elements.commandResults.querySelectorAll("[role='option']")];
  if (!options.length) {
    state.activeCandidateIndex = -1;
    elements.search.removeAttribute("aria-activedescendant");
    return;
  }

  const nextIndex = Math.max(0, Math.min(index, options.length - 1));
  state.activeCandidateIndex = nextIndex;
  options.forEach((option, optionIndex) => {
    option.setAttribute("aria-selected", String(optionIndex === nextIndex));
  });
  elements.search.setAttribute("aria-activedescendant", options[nextIndex].id);
  if (scroll) options[nextIndex].scrollIntoView({ block: "nearest" });
};

const renderRecentSelections = () => {
  const offenses = state.recentOffenseIds.map(offenseById).filter(Boolean);
  state.recentOffenseIds = offenses.map(({ id }) => id);
  elements.recentSearches.hidden = offenses.length === 0;
  if (!offenses.length) {
    elements.recentResults.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();
  offenses.forEach((offense) => {
    const item = document.createElement("div");
    item.setAttribute("role", "listitem");
    const button = document.createElement("button");
    button.className = "recent-option";
    button.type = "button";
    const code = document.createElement("span");
    code.textContent = offense.code ?? "No direct citation";
    const description = document.createElement("span");
    description.textContent = offense.description;
    button.append(code, description);
    button.addEventListener("click", () => selectCandidate(offense.id, { fromRecent: true }));
    item.append(button);
    fragment.append(item);
  });
  elements.recentResults.replaceChildren(fragment);
};

const renderCommandResults = () => {
  const hasQuery = Boolean(normalizeText(state.query));
  elements.search.setAttribute("aria-expanded", String(state.searchOpen && hasQuery));
  elements.searchStartView.hidden = hasQuery;
  elements.searchResultsView.hidden = !hasQuery;

  if (!hasQuery) {
    elements.commandResults.replaceChildren();
    elements.search.removeAttribute("aria-activedescendant");
    renderRecentSelections();
    return;
  }

  const { candidates, total, hiddenByFilters } = state.searchResult;
  elements.commandResultTotal.textContent = `${total.toLocaleString()} ${
    total === 1 ? "match" : "matches"
  }`;
  elements.hiddenFilterNote.hidden = hiddenByFilters === 0;
  elements.hiddenFilterNote.textContent = hiddenByFilters
    ? `${hiddenByFilters.toLocaleString()} ${
        hiddenByFilters === 1 ? "match is" : "matches are"
      } hidden by filters · Clear filters`
    : "";
  elements.commandEmpty.hidden = candidates.length > 0;

  const fragment = document.createDocumentFragment();
  candidates.forEach((candidate, index) => fragment.append(createCandidateOption(candidate, index)));
  elements.commandResults.replaceChildren(fragment);
  setActiveCandidate(state.activeCandidateIndex);
};

const updateSearchResult = (resetActive = true) => {
  state.searchResult = querySearchIndex(state.searchIndex, {
    text: state.query,
    filters: activeFilters(),
    limit: 8,
  });
  state.resultCount = state.searchResult.total;
  if (resetActive) {
    state.activeCandidateIndex = state.searchResult.candidates.length ? 0 : -1;
  }
  renderCommandResults();
};

const candidateChaptersFromLocation = () => {
  const values = [];
  try {
    const hashQuery = window.location.hash.startsWith("#lookup?")
      ? window.location.hash.slice("#lookup?".length)
      : "";
    const hashChapter = new URLSearchParams(hashQuery).get("chapter");
    const legacyChapter = new URLSearchParams(window.location.search).get("chapter");
    [hashChapter, legacyChapter].forEach((chapter) => {
      if (typeof chapter === "string" && chapter.length <= 180) values.push(chapter);
    });
  } catch {
    // Strict parsing in share-state rejects malformed values.
  }
  return values;
};

const shareValidationOptions = () => ({
  allowedFamilies: FAMILIES,
  allowedChapters: state.data
    ? [...new Set(state.data.offenses.map((offense) => offense.chapter))]
    : candidateChaptersFromLocation(),
});

const clearSharedLookupUrl = () => {
  if (!window.location.hash.startsWith("#lookup")) return;
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  history.replaceState(null, "", url);
  state.sharedLookupActive = false;
};

const renderSummary = (count) => {
  const strong = document.createElement("strong");
  strong.textContent = count.toLocaleString();
  const noun = count === 1 ? " offense" : " offenses";
  const suffix = state.query ? ` matching “${state.query.trim()}”` : " · complete index";
  elements.resultSummary.replaceChildren(strong, document.createTextNode(`${noun}${suffix}`));
};

const setSearchExperienceOpen = (open) => {
  state.searchOpen = open;
  elements.searchExperience.classList.toggle("is-open", open);
  elements.searchTools.inert = !open;
  elements.searchTools.setAttribute("aria-hidden", String(!open));
  elements.search.setAttribute(
    "aria-expanded",
    String(open && Boolean(normalizeText(state.query)))
  );
  if (!open) {
    elements.search.removeAttribute("aria-activedescendant");
  } else if (normalizeText(state.query) && state.searchResult?.candidates.length) {
    setActiveCandidate(state.activeCandidateIndex, false);
  }
};

const syncSearchControls = () => {
  const normalizedQuery = normalizeText(state.query);
  const hasQuery = Boolean(normalizedQuery);
  const ownsFocus = elements.searchExperience.contains(document.activeElement);

  elements.searchShell.classList.toggle("has-value", hasQuery);
  elements.searchMatchCount.hidden = !hasQuery;
  elements.searchMatchCount.textContent = `${state.resultCount.toLocaleString()} ${
    state.resultCount === 1 ? "match" : "matches"
  }`;
  elements.searchPrompts.forEach((prompt) => {
    const isCurrent = normalizeText(prompt.dataset.searchQuery) === normalizedQuery;
    if (isCurrent) prompt.setAttribute("aria-current", "true");
    else prompt.removeAttribute("aria-current");
  });
  elements.quickFamilyFilters.forEach((filter) => {
    filter.setAttribute("aria-pressed", String(state.family === filter.dataset.familyFilter));
  });
  elements.quickMandatory.setAttribute("aria-pressed", String(state.mandatoryOnly));
  const filterCount = activeFilterCount();
  elements.activeFilterCount.hidden = filterCount === 0;
  elements.activeFilterCount.textContent = filterCount ? String(filterCount) : "";
  elements.browseFilterToggle.classList.toggle("has-active-filters", filterCount > 0);
  if (!ownsFocus) setSearchExperienceOpen(false);
};

const syncSearchMetadata = () => {
  syncSearchControls();
  elements.resetFilters.disabled =
    !state.query && state.family === "all" && state.chapter === "all" && !state.mandatoryOnly;
  renderSummary(state.resultCount);
};

const renderCatalog = () => {
  const offenses = state.searchResult.matches.map(({ offense }) => offense);
  const fragment = document.createDocumentFragment();
  offenses.forEach((offense) => fragment.append(createOffenseRow(offense)));
  elements.results.replaceChildren(fragment);
  elements.results.setAttribute("role", "list");
  elements.results.setAttribute("aria-busy", "false");
  elements.results.hidden = offenses.length === 0;
  elements.emptyState.hidden = offenses.length > 0;
};

const renderOffenses = () => {
  if (!state.data || !state.searchIndex) return;
  updateSearchResult();
  renderCatalog();
  syncSearchMetadata();
};

const clearBrowseFilters = () => {
  state.family = "all";
  state.chapter = "all";
  state.mandatoryOnly = false;
  elements.familyFilter.value = "all";
  elements.chapterFilter.value = "all";
  elements.mandatoryFilter.checked = false;
};

/**
 * Statutory detail.
 *
 * One shared sheet serves every record rather than a hidden panel per row: 953 panels
 * would nest tinted surfaces four deep inside an offense row, which the design system
 * explicitly avoids, and long sections need more room than a row can give.
 *
 * The sheet is a native <dialog> opened with showModal(), which supplies focus trapping,
 * Escape, and background inerting without hand-rolling any of it.
 *
 * Statutory text is several megabytes across ~695 sections, so it is never part of the
 * initial payload: each section is fetched the first time it is opened and kept in memory
 * afterwards. The sheet is built with createElement/textContent only, which the Trusted
 * Types policy in the deployed CSP requires.
 */
const SECTION_KEY_PATTERN = /^\d{4}-\d{4}-(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9.\-]*$/;

const STATUS_NOTICES = {
  unavailable:
    "The Illinois General Assembly no longer serves this section. It may have been renumbered or repealed since the February 2024 source publication.",
  repealed: "The current statutory text for this section is marked repealed.",
  "citation-mismatch":
    "The Illinois General Assembly returned a different section than the one cited here. Treat this citation as unconfirmed.",
  "subsection-not-found":
    "The section was retrieved, but the subsection cited by the February 2024 source publication does not appear in the current text.",
  unparseable: "The statutory text could not be read automatically. Open the official source below.",
  "fetch-failed": "The statutory text could not be retrieved. Open the official source below.",
};

const sectionRequests = new Map();
let sheetReturnFocus = null;
// Monotonic: identifies which open request owns the sheet's contents.
let sheetRequestToken = 0;

/**
 * Build the official ILGA URL for a record from its section key.
 *
 * The key already encodes chapter, act, and section ("0625-0005-11-709"), and ILGA's
 * document token is chapter + act + "0K" + section, so the URL is derived rather than
 * stored once per record in the initial payload.
 *
 * The template is data, and this link is the one place the interface sends an officer to
 * an external site, so it is checked against the official host before use.
 */
const ilgaUrlFor = (offense) => {
  const template = state.data?.ilgaUrlTemplate;
  if (!template || !offense.sectionKey) return null;
  if (!/^https:\/\/www\.ilga\.gov\//.test(template) || !template.includes("{docName}")) return null;
  if (!SECTION_KEY_PATTERN.test(offense.sectionKey)) return null;

  const docName = `${offense.sectionKey.slice(0, 4)}${offense.sectionKey.slice(5, 9)}0K${offense.sectionKey.slice(10)}`;
  return template.replace("{docName}", encodeURIComponent(docName));
};

const loadStatutorySection = (sectionKey) => {
  if (!SECTION_KEY_PATTERN.test(sectionKey)) return Promise.resolve(null);
  if (!sectionRequests.has(sectionKey)) {
    const request = fetch(`${SECTION_URL_PREFIX}${encodeURIComponent(sectionKey)}.json`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .catch(() => {
        // Only successes are memoised. Caching the failure would mean a statute opened
        // in a dead spot stays broken for the life of the page even once signal returns,
        // which is the one place this is used and the one time it matters.
        sectionRequests.delete(sectionKey);
        return null;
      });
    sectionRequests.set(sectionKey, request);
  }
  return sectionRequests.get(sectionKey);
};

/**
 * Render verbatim clauses, emphasising the qualifiers an officer has to satisfy.
 *
 * Emphasis is presentation only — the segments concatenate back to the exact statutory
 * text, which test/elements.test.mjs asserts for every clause in the corpus.
 */
const createClauseList = (clauses, className) => {
  const list = document.createElement("ul");
  list.className = className;
  for (const clause of clauses) {
    const item = document.createElement("li");
    for (const segment of emphasize(clause)) {
      if (segment.emphasis) {
        const mark = document.createElement("strong");
        mark.className = "statutory-qualifier";
        mark.textContent = segment.text;
        item.append(mark);
      } else {
        item.append(document.createTextNode(segment.text));
      }
    }
    list.append(item);
  }
  return list;
};

const createStatuteBlocks = (blocks) => {
  const container = document.createElement("div");
  container.className = "statute-blocks";
  // Skipped because the sheet already shows each of these in its own place: the citation
  // and historical reference in the header, the heading above the statute, and the
  // Public Act line as provenance beneath it.
  const shownElsewhere = new Set(["citation", "historical-reference", "heading", "source"]);
  blocks.forEach((block) => {
    if (shownElsewhere.has(block.type)) return;
    const paragraph = document.createElement("p");
    paragraph.className = `statute-block statute-${block.type}`;
    paragraph.textContent = block.text;
    container.append(paragraph);
  });
  return container;
};

const createSheetContent = (offense, section) => {
  const fragment = document.createDocumentFragment();

  const notice = STATUS_NOTICES[offense.statutoryStatus];
  if (notice) {
    const warning = document.createElement("p");
    warning.className = "detail-notice";
    warning.textContent = notice;
    fragment.append(warning);
  }

  if (section?.headingText) {
    const heading = document.createElement("p");
    heading.className = "detail-heading";
    heading.textContent = section.headingText;
    fragment.append(heading);
  }

  const ilgaUrl = ilgaUrlFor(offense);
  if (ilgaUrl) {
    const link = document.createElement("a");
    link.className = "detail-ilga";
    link.href = ilgaUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute(
      "aria-label",
      `View the official Illinois General Assembly text of ${offense.citation} in a new tab`
    );
    link.append(
      document.createTextNode(`View official ILGA statute · ${offense.citation}`),
      document.createTextNode(" ↗")
    );
    fragment.append(link);
  }

  const elements = section?.blocks?.length
    ? elementsFor({ blocks: section.blocks, subsectionPath: offense.subsectionPath ?? [], citation: offense.citation })
    : null;

  if (elements) {
    const panel = document.createElement("section");
    panel.className = "key-language";

    const label = document.createElement("p");
    label.className = "micro-label";
    // Only claim to be showing the cited provision when that is what was found.
    label.textContent = elements.exact && elements.citedSubsection
      ? `Elements · ${elements.citedSubsection}`
      : elements.citedSubsection
        ? `Elements · subsection (${elements.subsection})`
        : "Elements · opening provision of the section";
    panel.append(label);

    panel.append(createClauseList(elements.elements, "key-language-list"));

    if (elements.truncated > 0) {
      const omitted = document.createElement("p");
      omitted.className = "key-language-caveat";
      omitted.textContent = `${elements.truncated} further ${elements.truncated === 1 ? "clause" : "clauses"} in this provision are not shown. Read the full text below.`;
      panel.append(omitted);
    }

    // ILGA merges some nested provisions into their parent. Presenting a lead-in as the
    // cited provision would be a quieter error than saying so plainly.
    if (!elements.exact && elements.citedSubsection) {
      const caveat = document.createElement("p");
      caveat.className = "key-language-caveat";
      caveat.textContent = `The cited provision ${elements.citedSubsection} is not published separately; this is the enclosing subsection.`;
      panel.append(caveat);
    }

    const notReviewed = document.createElement("p");
    notReviewed.className = "key-language-caveat";
    notReviewed.textContent = "Quoted word for word from the statute and not reviewed by your agency. Which elements apply is for an officer to determine.";
    panel.append(notReviewed);

    fragment.append(panel);

    if (elements.exceptions.length) {
      const exceptionsPanel = document.createElement("section");
      exceptionsPanel.className = "key-language key-exceptions";
      const exceptionsLabel = document.createElement("p");
      exceptionsLabel.className = "micro-label";
      exceptionsLabel.textContent = "Important Exceptions";
      exceptionsPanel.append(exceptionsLabel, createClauseList(elements.exceptions, "key-language-list"));
      fragment.append(exceptionsPanel);
    }
  }

  if (section?.blocks?.length) {
    // The sheet exists to give statutory language room, so it renders expanded rather
    // than behind a disclosure control.
    fragment.append(createStatuteBlocks(section.blocks));

    if (section.sourceLine) {
      const source = document.createElement("p");
      source.className = "detail-source-line";
      source.textContent = section.sourceLine;
      fragment.append(source);
    }
  }

  // Provenance is unconditional visible text, never a tooltip: an officer reading this
  // needs to know when it was retrieved and that no person has reviewed it.
  const provenance = document.createElement("p");
  provenance.className = "detail-provenance";
  provenance.textContent = section?.retrievedAt
    ? `Statutory text retrieved from ilga.gov on ${section.retrievedAt.slice(0, 10)}. Retrieved automatically and not reviewed by a person. Verify against the official source before relying on it.`
    : "Statutory text is not available offline for this record. Open the official source above.";
  fragment.append(provenance);

  const report = document.createElement("a");
  report.className = "detail-copy-link";
  report.target = "_blank";
  report.rel = "noopener noreferrer";
  report.textContent = "Report an issue";
  report.setAttribute("aria-label", `Report an issue with ${offense.citation}, opens a prefilled report in a new tab`);
  {
    const title = `Record issue: ${offense.fullCitation ?? offense.code ?? offense.id}`;
    const body = [
      `Record: ${offense.id}`,
      `Citation: ${offense.fullCitation ?? "(unresolved)"}`,
      `2024 index label: ${offense.description}`,
      `Statutory status: ${offense.statutoryStatus ?? "retrieved"}`,
      "",
      "What is wrong (wrong statute / outdated / unclear / wrong classification / other):",
      "",
      "Do not include names, plates, case details, or any CJI.",
    ].join("\n");
    report.href = `${ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }
  fragment.append(report);

  const copyLink = document.createElement("button");
  copyLink.className = "detail-copy-link";
  copyLink.type = "button";
  copyLink.textContent = "Copy link to this statute";
  copyLink.setAttribute("aria-label", `Copy a direct link to the statutory text for ${offense.citation}`);
  copyLink.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = `offense/${encodeURIComponent(offense.id)}`;
    writeClipboard(url.toString(), `Link to ${offense.citation} copied`);
  });
  fragment.append(copyLink);

  return fragment;
};

const createSheetSkeleton = () => {
  const skeleton = document.createElement("div");
  skeleton.className = "statute-skeleton";
  skeleton.setAttribute("role", "status");
  // The ruled placeholder carries the wait visually; the announcement carries it for
  // anyone who cannot see it.
  const announcement = document.createElement("span");
  announcement.className = "sr-only";
  announcement.textContent = "Loading statutory text…";
  skeleton.append(announcement);
  return skeleton;
};

/**
 * Tear-down shared by every way the sheet can close.
 *
 * showModal() handles Escape itself and is supposed to fire a "close" event, but not
 * every engine does, so nothing that matters for accessibility is left to that event
 * alone. This is idempotent and safe to call from all of them.
 */
const finishStatuteSheetClose = () => {
  // Invalidate any in-flight load so it cannot render into a sheet the user has closed.
  sheetRequestToken += 1;
  if (elements.statuteSheetBody.childElementCount) elements.statuteSheetBody.replaceChildren();
  if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus({ preventScroll: true });
  sheetReturnFocus = null;
};

const closeStatuteSheet = () => {
  const sheet = elements.statuteSheet;
  if (sheet?.open) sheet.close();
  // Only tear down once the dialog has actually closed. Clearing unconditionally left an
  // open sheet with an empty body whenever close() did not take effect — a field tool
  // showing a statute heading over blank space is worse than one that stays open.
  if (!sheet?.open) finishStatuteSheetClose();
};

const openStatuteSheet = async (offense, { returnFocusTo = null } = {}) => {
  const sheet = elements.statuteSheet;
  if (!sheet || !offense?.sectionKey) return;

  // Only capture on the way in. Opening one record over another would otherwise capture
  // a node inside the dialog, which the render below destroys — leaving nothing
  // connected to hand focus back to when the sheet finally closes.
  if (!sheet.open) sheetReturnFocus = returnFocusTo ?? document.activeElement;

  const token = (sheetRequestToken += 1);
  elements.statuteSheetTitle.textContent = offense.fullCitation ?? offense.code ?? "";
  elements.statuteSheetBody.replaceChildren(createSheetSkeleton());
  if (!sheet.open) sheet.showModal();

  const section = await loadStatutorySection(offense.sectionKey);
  // Identity, not rendered text: ~953 records share 695 sections, so two records can
  // carry the same citation, and a late response must not paint into a closed sheet.
  if (token !== sheetRequestToken) return;
  elements.statuteSheetBody.replaceChildren(createSheetContent(offense, section));
  elements.statuteSheetBody.scrollTop = 0;
};

const openStatuteSheetById = (offenseId) => {
  const offense = offenseById(offenseId);
  if (!offense?.sectionKey) return Promise.resolve();
  return openStatuteSheet(offense, { returnFocusTo: document.getElementById(`${offenseId}-statute`) });
};

const setFilterBarOpen = (open, focus = false) => {
  state.filtersOpen = open;
  elements.filterBar.hidden = !open;
  elements.browseFilterToggle.setAttribute("aria-expanded", String(open));
  elements.browseFilterToggle.lastElementChild.textContent = open ? "−" : "+";
  if (open && focus) {
    window.requestAnimationFrame(() => elements.familyFilter.focus({ preventScroll: true }));
  }
};

const resetFilters = () => {
  clearSharedLookupUrl();
  state.query = "";
  elements.search.value = "";
  clearBrowseFilters();
  renderOffenses();
};

const selectCandidate = (offenseId, { fromRecent = false } = {}) => {
  const offense = offenseById(offenseId);
  if (!offense) return;
  rememberOffense(offense.id);

  if (elements.searchTools.contains(document.activeElement)) {
    elements.search.focus({ preventScroll: true });
  }

  if (fromRecent) {
    clearSharedLookupUrl();
    state.query = offense.code ?? offense.description;
    elements.search.value = state.query;
    renderOffenses();
  }

  const row = document.getElementById(offense.id);
  if (row) row.focus({ preventScroll: true });
  setSearchExperienceOpen(false);
  window.requestAnimationFrame(() => {
    if (!row) return;
    row.scrollIntoView({ block: "center" });
  });
};

const activateSuggestedSearch = (query) => {
  if (elements.searchTools.contains(document.activeElement)) {
    elements.search.focus({ preventScroll: true });
  }
  clearSharedLookupUrl();
  state.query = query.slice(0, MAX_QUERY_LENGTH);
  elements.search.value = state.query;
  clearBrowseFilters();
  renderOffenses();

  window.requestAnimationFrame(() => {
    elements.offensesSection.scrollIntoView({ block: "start" });
    elements.resultSummary.focus({ preventScroll: true });
    setSearchExperienceOpen(false);
  });
};

const buildFilters = () => {
  const counts = new Map(FAMILIES.map((family) => [family, 0]));
  state.data.offenses.forEach((offense) => counts.set(offense.family, counts.get(offense.family) + 1));

  FAMILIES.forEach((family) => {
    const option = document.createElement("option");
    option.value = family;
    option.textContent = `${family} (${counts.get(family).toLocaleString()})`;
    elements.familyFilter.append(option);
  });

  const chapters = [...new Set(state.data.offenses.map((offense) => offense.chapter))].sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true })
  );
  chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = chapter.replace(/^CHAPTER\s+/i, "");
    elements.chapterFilter.append(option);
  });

  elements.familyFilter.value = state.family;
  elements.chapterFilter.value = chapters.includes(state.chapter) ? state.chapter : "all";
  if (elements.chapterFilter.value === "all") state.chapter = "all";
};

const hydrateStateFromUrl = () => {
  const options = shareValidationOptions();
  const fragmentState = parseShareFragment(window.location.hash, options);
  const legacy = fragmentState
    ? null
    : readLegacyShareState(window.location.search, options);
  const nextState = fragmentState ?? legacy?.state ?? null;

  if (nextState) {
    state.query = nextState.query;
    state.family = nextState.family;
    state.chapter = nextState.chapter;
    state.mandatoryOnly = nextState.mandatoryOnly;
    state.sharedLookupActive = true;
  } else if (window.location.hash.startsWith("#lookup")) {
    state.query = "";
    state.family = "all";
    state.chapter = "all";
    state.mandatoryOnly = false;
    state.sharedLookupActive = false;
  }

  if (legacy || window.location.search) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash =
      legacy?.fragment ??
      (fragmentState || !window.location.hash.startsWith("#lookup") ? window.location.hash : "");
    history.replaceState(null, "", url);
  } else if (window.location.hash.startsWith("#lookup") && !fragmentState) {
    history.replaceState(null, "", window.location.pathname);
  }

  elements.search.value = state.query;
  elements.mandatoryFilter.checked = state.mandatoryOnly;
};

const renderStaticSections = () => {
  const guideFragment = document.createDocumentFragment();
  guides.forEach((guide, index) => guideFragment.append(createGuideRow(guide, index)));
  elements.guideList.replaceChildren(guideFragment);
};

const showUnavailableLookup = (heading, message) => {
  elements.search.disabled = true;
  elements.searchDock.hidden = true;
  elements.searchShell.setAttribute("aria-busy", "false");
  elements.browseFilterToggle.hidden = true;
  elements.filterBar.hidden = true;
  elements.recordKey.hidden = true;
  elements.copyLink.hidden = true;
  elements.emptyState.hidden = true;
  elements.results.setAttribute("aria-busy", "false");
  elements.results.hidden = true;
  elements.resultSummary.textContent = heading;
  elements.contentStatusHeading.textContent = heading;
  elements.contentStatusMessage.textContent = message;
  elements.contentStatusPanel.hidden = false;
};

const syncSourceReviewStatus = () => {
  const review = state.sourceVersion?.review;
  if (!review) return;
  const corpusStatus = state.contentStatus?.corpus?.status;
  const effectiveStatus = corpusStatus === "superseded" ? "superseded" : review.status;
  elements.sourceReviewStatus.dataset.status = effectiveStatus;
  if (
    effectiveStatus === "active" &&
    corpusStatus === "active" &&
    review.lastReviewedDate &&
    review.nextReviewDate
  ) {
    elements.sourceReviewStatus.textContent =
      `Content review active · Reviewed ${review.lastReviewedDate} · Next review ${review.nextReviewDate}.`;
    return;
  }
  const label = effectiveStatus === "superseded" ? "Source superseded" : "Content review due";
  elements.sourceReviewStatus.textContent = `${label} · Approval dates pending.`;
};

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const applyTheme = (theme, persist = false) => {
  document.documentElement.dataset.theme = theme;
  if (persist) writeThemePreference(theme);
  elements.themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
  elements.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Use light theme" : "Use dark theme"
  );
};

const setupTheme = () => {
  const storedTheme = readThemePreference();
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = storedTheme ?? (systemDark ? "dark" : "light");
  applyTheme(theme);
};

const setupShortcut = () => {
  applyShortcutPreference(readShortcutPreference());
};

const setupFreshness = () => {
  const currentBuild = document.querySelector('meta[name="app-build"]')?.content;
  if (!isBuildId(currentBuild)) return;

  let hideTimer;

  const hideUpdatePrompt = (publishedBuild, persist = false) => {
    if (persist && isBuildId(publishedBuild)) writeSuppressedBuild(publishedBuild);
    if (elements.updatePrompt.contains(document.activeElement)) {
      elements.search.focus({ preventScroll: true });
      setSearchExperienceOpen(false);
    }
    elements.updatePrompt.classList.remove("is-visible");
    document.documentElement.classList.remove("update-ready");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      elements.updatePrompt.hidden = true;
    }, prefersReducedMotion() ? 0 : 200);
  };

  const showUpdatePrompt = (publishedBuild) => {
    window.clearTimeout(hideTimer);
    elements.updatePrompt.dataset.build = publishedBuild;
    elements.updatePrompt.hidden = false;
    document.documentElement.classList.add("update-ready");
    window.requestAnimationFrame(() => {
      elements.updatePrompt.classList.add("is-visible");
      elements.updateAnnouncement.textContent =
        "A newer version of the offense index is ready. Refresh when convenient.";
    });
  };

  const monitor = createFreshnessMonitor({
    currentBuild,
    fetchBuild: () =>
      fetchBuildVersion({
        url: new URL("./version.json", document.baseURI).toString(),
      }),
    onUpdate: showUpdatePrompt,
    isSuppressed: (publishedBuild) => readSuppressedBuild() === publishedBuild,
  });

  const checkForUpdate = () => {
    void monitor.check();
  };
  const checkWhenVisible = () => {
    if (document.visibilityState === "visible") checkForUpdate();
  };

  elements.updateRefresh.addEventListener("click", () => window.location.reload());
  elements.updateLater.addEventListener("click", () => {
    hideUpdatePrompt(elements.updatePrompt.dataset.build, true);
  });
  elements.updatePrompt.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    hideUpdatePrompt(elements.updatePrompt.dataset.build, true);
  });
  window.addEventListener("pageshow", checkForUpdate);
  window.addEventListener("focus", checkForUpdate);
  document.addEventListener("visibilitychange", checkWhenVisible);
  void monitor.check({ force: true });
};

const setupHeaderScrollState = () => {
  let framePending = false;

  const update = () => {
    elements.siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
    framePending = false;
  };

  update();
  window.addEventListener(
    "scroll",
    () => {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(update);
    },
    { passive: true }
  );
};

const setupRevealMotion = () => {
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(".section-heading, .guide-row");
  document.documentElement.classList.add("motion-ready");
  targets.forEach((target) => target.classList.add("is-reveal-ready"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  targets.forEach((target) => observer.observe(target));
};

const bindEvents = () => {
  let searchTimer;

  elements.searchShell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || prefersReducedMotion()) return;
    elements.searchShell.classList.remove("is-engaged");
    elements.searchShell.classList.add("is-pressed");
  });

  window.addEventListener("pointerup", () => {
    if (!elements.searchShell.classList.contains("is-pressed")) return;
    elements.searchShell.classList.replace("is-pressed", "is-engaged");
  });

  window.addEventListener("pointercancel", () => {
    elements.searchShell.classList.remove("is-pressed");
  });

  elements.searchShell.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    elements.search.focus();
    setSearchExperienceOpen(true);
  });

  elements.search.addEventListener("click", () => setSearchExperienceOpen(true));

  elements.searchShell.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => {
      if (elements.searchShell.contains(document.activeElement)) return;
      elements.searchShell.classList.remove("is-pressed", "is-engaged");
    });
  });

  elements.searchExperience.addEventListener("focusin", () => {
    setSearchExperienceOpen(true);
  });

  /**
   * Keep the tools panel open while the pointer is pressing something inside it.
   *
   * Chromium focuses a <button> when you click it, so the focusout check below saw
   * focus still inside the search experience and left the panel alone. Safari and
   * Firefox do not focus buttons on click: focus went to <body>, this handler closed
   * the panel and marked it inert on the very next frame, and the click that followed
   * landed on an inert subtree and never fired. Every common stop and quick filter was
   * dead in those browsers while working perfectly in Chromium.
   */
  let pointerHeldInsideSearch = false;
  elements.searchExperience.addEventListener("pointerdown", () => {
    pointerHeldInsideSearch = true;
  });
  window.addEventListener("pointerup", () => {
    pointerHeldInsideSearch = false;
  });
  window.addEventListener("pointercancel", () => {
    pointerHeldInsideSearch = false;
  });

  elements.searchExperience.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => {
      if (pointerHeldInsideSearch) return;
      if (elements.searchExperience.contains(document.activeElement)) return;
      setSearchExperienceOpen(false);
    });
  });

  elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    clearSharedLookupUrl();
    state.query = elements.search.value.slice(0, MAX_QUERY_LENGTH);
    updateSearchResult();
    syncSearchMetadata();
    searchTimer = window.setTimeout(renderCatalog, 48);
  });

  elements.search.addEventListener("keydown", (event) => {
    const candidateCount = state.searchResult?.candidates.length ?? 0;
    if (!candidateCount) return;

    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!state.searchOpen) setSearchExperienceOpen(true);
      if (event.key === "ArrowDown") {
        setActiveCandidate((state.activeCandidateIndex + 1) % candidateCount);
      } else {
        setActiveCandidate(
          state.activeCandidateIndex <= 0 ? candidateCount - 1 : state.activeCandidateIndex - 1
        );
      }
      return;
    }

    if (event.key === "Enter" && state.searchOpen && state.activeCandidateIndex >= 0) {
      event.preventDefault();
      const candidate = state.searchResult.candidates[state.activeCandidateIndex];
      if (candidate) selectCandidate(candidate.offenseId);
    }
  });

  elements.clearSearch.addEventListener("click", () => {
    clearSharedLookupUrl();
    state.query = "";
    elements.search.value = "";
    elements.search.focus();
    renderOffenses();
  });

  elements.familyFilter.addEventListener("change", () => {
    clearSharedLookupUrl();
    state.family = elements.familyFilter.value;
    renderOffenses();
  });

  elements.chapterFilter.addEventListener("change", () => {
    clearSharedLookupUrl();
    state.chapter = elements.chapterFilter.value;
    renderOffenses();
  });

  elements.mandatoryFilter.addEventListener("change", () => {
    clearSharedLookupUrl();
    state.mandatoryOnly = elements.mandatoryFilter.checked;
    renderOffenses();
  });

  elements.quickFamilyFilters.forEach((filter) => {
    filter.addEventListener("click", () => {
      clearSharedLookupUrl();
      const family = filter.dataset.familyFilter;
      state.family = state.family === family ? "all" : family;
      state.chapter = "all";
      elements.familyFilter.value = state.family;
      elements.chapterFilter.value = "all";
      renderOffenses();
    });
  });

  elements.quickMandatory.addEventListener("click", () => {
    clearSharedLookupUrl();
    state.mandatoryOnly = !state.mandatoryOnly;
    elements.mandatoryFilter.checked = state.mandatoryOnly;
    renderOffenses();
  });

  elements.hiddenFilterNote.addEventListener("click", () => {
    elements.search.focus({ preventScroll: true });
    clearSharedLookupUrl();
    clearBrowseFilters();
    renderOffenses();
    setSearchExperienceOpen(true);
  });

  elements.clearRecents.addEventListener("click", () => {
    elements.search.focus({ preventScroll: true });
    state.recentOffenseIds = [];
    writeRecentSelections();
    renderRecentSelections();
    setToast("Recent selections cleared");
  });

  elements.shortcutToggle.addEventListener("click", () => {
    const enabled = !state.slashShortcutEnabled;
    applyShortcutPreference(enabled, true);
    setToast(enabled ? "Slash shortcut enabled" : "Slash shortcut disabled");
  });

  elements.moreFilters.addEventListener("click", () => {
    setFilterBarOpen(true);
    elements.filterBar.scrollIntoView({ block: "center" });
    window.requestAnimationFrame(() => elements.familyFilter.focus({ preventScroll: true }));
  });

  elements.browseFilterToggle.addEventListener("click", () => {
    setFilterBarOpen(!state.filtersOpen, !state.filtersOpen);
  });

  elements.resetFilters.addEventListener("click", resetFilters);
  elements.emptyReset.addEventListener("click", () => {
    resetFilters();
    elements.search.focus();
  });

  elements.searchPrompts.forEach((prompt) => {
    prompt.addEventListener("click", () => {
      activateSuggestedSearch(prompt.dataset.searchQuery);
    });
  });

  elements.copyLink.addEventListener("click", () => {
    const url = new URL(window.location.href);
    const fragment = serializeShareState(
      {
        query: state.query,
        family: state.family,
        chapter: state.chapter,
        mandatoryOnly: state.mandatoryOnly,
      },
      shareValidationOptions()
    );
    url.search = "";
    url.hash = fragment;
    history.replaceState(null, "", url);
    state.sharedLookupActive = true;
    writeClipboard(url.toString(), "Results link copied");
  });

  elements.clearLocalData.addEventListener("click", () => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
      localStorage.removeItem(SHORTCUT_STORAGE_KEY);
      sessionStorage.removeItem(UPDATE_SUPPRESSION_KEY);
      sessionStorage.removeItem(RECENT_SELECTIONS_KEY);
    } catch {
      // The visible state is still cleared when browser storage is unavailable.
    }
    state.recentOffenseIds = [];
    renderRecentSelections();
    applyShortcutPreference(true);
    applyTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setToast("Local site data cleared");
  });

  elements.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    const updateTheme = () => applyTheme(next, true);
    if (document.startViewTransition && !prefersReducedMotion()) {
      document.startViewTransition(updateTheme);
    } else {
      updateTheme();
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isEditableTarget =
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select") || target.isContentEditable);

    if (
      event.key === "/" &&
      state.slashShortcutEnabled &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !isEditableTarget
    ) {
      event.preventDefault();
      elements.search.focus();
      elements.search.select();
      setSearchExperienceOpen(true);
    }

    if (event.key === "Escape" && elements.searchExperience.contains(document.activeElement)) {
      event.preventDefault();
      if (state.searchOpen) {
        elements.search.focus({ preventScroll: true });
        setSearchExperienceOpen(false);
        return;
      }
      if (elements.search.value) {
        clearSharedLookupUrl();
        state.query = "";
        elements.search.value = "";
        renderOffenses();
      }
    }
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash.startsWith("#lookup")) {
      hydrateStateFromUrl();
      if (state.data) {
        elements.familyFilter.value = state.family;
        elements.chapterFilter.value = state.chapter;
        renderOffenses();
      }
      return;
    }

    const offenseId = readOffenseHash(window.location.hash);
    if (offenseId) {
      const row = document.getElementById(offenseId);
      if (!row) return;
      // Scroll the row into place behind the sheet, so closing it leaves the reader
      // looking at the record they followed the link to.
      row.scrollIntoView({ block: "start" });
      openStatuteSheetById(offenseId);
      return;
    }

    const targetId = decodeHash(window.location.hash.replace(/^#/, ""));
    const target = targetId ? document.getElementById(targetId) : null;
    if (target) target.scrollIntoView({ block: "center" });
  });

  elements.statuteSheetClose.addEventListener("click", closeStatuteSheet);

  // Clicking the backdrop closes: the dialog element itself fills only the sheet, so a
  // click landing on the dialog node is a click outside the sheet's content.
  elements.statuteSheet.addEventListener("click", (event) => {
    if (event.target === elements.statuteSheet) closeStatuteSheet();
  });

  // Handle Escape rather than leaving it to the dialog's own dismissal, so the tear-down
  // is deterministic on engines that never dispatch the "close" event.
  elements.statuteSheet.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeStatuteSheet();
  });

  elements.statuteSheet.addEventListener("close", finishStatuteSheetClose);

  syncSearchControls();
};

const init = async () => {
  setupTheme();
  setupShortcut();
  setupHeaderScrollState();
  hydrateStateFromUrl();
  bindEvents();
  setupFreshness();

  try {
    const [dataResponse, sourceResponse, contentResponse] = await Promise.all([
      fetch(DATA_URL),
      fetch(SOURCE_VERSION_URL),
      fetch(CONTENT_STATUS_URL),
    ]);
    if (!dataResponse.ok) throw new Error(`Data request failed: ${dataResponse.status}`);
    if (!sourceResponse.ok) throw new Error(`Source status failed: ${sourceResponse.status}`);
    if (!contentResponse.ok) throw new Error(`Content status failed: ${contentResponse.status}`);
    [state.data, state.sourceVersion, state.contentStatus] = await Promise.all([
      dataResponse.json(),
      sourceResponse.json(),
      contentResponse.json(),
    ]);
    syncSourceReviewStatus();

    renderStaticSections();
    if (
      state.contentStatus.corpus.status === "disabled" ||
      state.contentStatus.corpus.enabled !== true
    ) {
      showUnavailableLookup(
        "Lookup Temporarily Unavailable",
        state.contentStatus.emergencyControl.publicMessage
      );
      return;
    }

    state.data.offenses.forEach((offense) => {
      offense.family = familyFor(offense);
      offense.primarySearchDocument = buildOffensePrimarySearchDocument(offense);
      offense.searchDocument = buildOffenseSearchDocument(offense);
    });
    state.searchIndex = createSearchIndex(state.data.offenses);
    elements.search.disabled = false;
    elements.searchShell.setAttribute("aria-busy", "false");
    state.recentOffenseIds = readRecentSelections().filter((id) => offenseById(id));
    if (window.location.hash.startsWith("#lookup")) hydrateStateFromUrl();
    buildFilters();
    setFilterBarOpen(activeFilterCount() > 0);
    renderOffenses();
    setupRevealMotion();

    const offenseId = readOffenseHash(window.location.hash);
    const targetId = offenseId ?? decodeHash(window.location.hash.replace(/^#/, ""));
    const target = targetId ? document.getElementById(targetId) : null;

    if (window.location.hash && target) {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: "start" });
        if (offenseId) openStatuteSheetById(offenseId);
      });
    }
  } catch (error) {
    renderStaticSections();
    showUnavailableLookup(
      "Index Unavailable",
      "The code index could not be loaded. Refresh the page or open the source publication."
    );
    console.error(error);
  }
};

init();
