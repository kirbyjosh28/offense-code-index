const DATA_URL = "./src/data/offense-codes.json";
const PAGE_SIZE = 80;
const SOURCE_PDF = "https://www.ilsos.gov/content/dam/departments/police/offense_code24.pdf";

const guides = [
  {
    id: "guide-index-scope",
    title: "Index scope & reporting codes",
    pages: "PDF page 2",
    pdfPage: 2,
    description: "Read the publication's limits, its current-law warning, and how Secretary of State Police uses the four-digit reporting code.",
    topics: ["Scope", "ILCS", "Reporting codes"],
  },
  {
    id: "guide-pretrial-fairness",
    title: "Pretrial Fairness Act",
    pages: "PDF pages 2–3",
    pdfPage: 2,
    description: "Source guidance on proceedings after arrest, release by citation, pretrial release, and the referenced implementation flowcharts.",
    topics: ["725 ILCS 5/109", "725 ILCS 5/110", "Release"],
  },
  {
    id: "guide-notice-to-appear",
    title: "Notice to Appear",
    pages: "PDF page 3",
    pdfPage: 3,
    description: "The publication's Notice to Appear summary and explanation of its mandatory-court-appearance marker.",
    topics: ["Notice to Appear", "Court appearance"],
  },
  {
    id: "guide-supreme-court-rules",
    title: "Illinois Supreme Court rules",
    pages: "PDF pages 3–7",
    pdfPage: 3,
    description: "Reference text for Rules 504, 529, 530, 531, 551, 552, 553, 554, and the Rule 501(g) definition.",
    topics: ["Appearance dates", "Written pleas", "Ticket processing"],
  },
  {
    id: "guide-required-appearance",
    title: "Required appearance — Rule 551",
    pages: "PDF pages 5–6",
    pdfPage: 5,
    description: "The source list of allegations and circumstances that require an in-person or remote court appearance.",
    topics: ["Rule 551", "Major traffic", "Specified sections"],
  },
  {
    id: "guide-traffic-release",
    title: "Traffic enforcement & pretrial release",
    pages: "PDF pages 6–7",
    pdfPage: 6,
    description: "Source material on 625 ILCS 5/6-308 and jurisdictions not yet in the Nonresident Violator Compact.",
    topics: ["625 ILCS 5/6-308", "Failure to appear", "Nonresident compact"],
  },
  {
    id: "guide-under-21",
    title: "Drivers under age 21",
    pages: "PDF page 7",
    pdfPage: 7,
    description: "A compact source list of alcohol, graduated-driver, zero-tolerance, and phone-related provisions for drivers under 21.",
    topics: ["Under 21", "Graduated driver", "Zero tolerance"],
  },
  {
    id: "guide-plate-weights",
    title: "License plate weight chart",
    pages: "PDF page 11",
    pdfPage: 11,
    description: "Flat-weight, mileage, farm-truck, and farm-trailer letter designations with their listed maximum gross weights.",
    topics: ["Plate classes", "Gross weight", "Trailers"],
  },
  {
    id: "guide-placards-contacts",
    title: "Disability placards & publication contacts",
    pages: "PDF pages 54–56",
    pdfPage: 54,
    description: "The law-enforcement placard identification guide, publication-order contacts, report-form contacts, and corrections address.",
    topics: ["Parking placards", "Ordering", "Corrections"],
  },
];

const state = {
  data: null,
  view: "offenses",
  query: "",
  family: "all",
  chapter: "all",
  mandatoryOnly: false,
  visibleCount: PAGE_SIZE,
};

const elements = {
  search: document.querySelector("#search"),
  searchShell: document.querySelector(".search-shell"),
  clearSearch: document.querySelector("#clear-search"),
  results: document.querySelector("#results"),
  resultSummary: document.querySelector("#result-summary"),
  emptyState: document.querySelector("#empty-state"),
  emptyReset: document.querySelector("#empty-reset"),
  loadMore: document.querySelector("#load-more"),
  familyFilters: document.querySelector("#family-filters"),
  chapterFilter: document.querySelector("#chapter-filter"),
  mandatoryFilter: document.querySelector("#mandatory-filter"),
  resetFilters: document.querySelector("#reset-filters"),
  filters: document.querySelector("#filters"),
  filterTrigger: document.querySelector("#filter-trigger"),
  closeFilters: document.querySelector("#close-filters"),
  filterBackdrop: document.querySelector("#filter-backdrop"),
  filterCount: document.querySelector("#filter-count"),
  offenseTabCount: document.querySelector("#offense-tab-count"),
  countyTabCount: document.querySelector("#county-tab-count"),
  guideTabCount: document.querySelector("#guide-tab-count"),
  copyLink: document.querySelector("#copy-link"),
  themeToggle: document.querySelector("#theme-toggle"),
  toast: document.querySelector("#toast"),
};

const familyFor = (offense) => {
  if (/^720 ILCS 5\//i.test(offense.code)) return "Criminal Code";
  if (/^720 ILCS (?:550|570|600|635|648|670|675|685|690)\//i.test(offense.code)) {
    return "Drugs & public health";
  }
  if (/SNOWMOBILE|BOAT REGISTRATION/i.test(offense.chapter)) return "Recreation vehicles";
  if (!/ILCS|Section/i.test(offense.code) || offense.page <= 34) return "Vehicle Code";
  return "Other Illinois statutes";
};

const families = [
  "Vehicle Code",
  "Criminal Code",
  "Drugs & public health",
  "Recreation vehicles",
  "Other Illinois statutes",
];

const normalizeQuery = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlight = (value, query) => {
  if (!query || query.length < 2) return document.createTextNode(value);
  const fragment = document.createDocumentFragment();
  const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    fragment.append(document.createTextNode(value.slice(cursor, match.index)));
    const mark = document.createElement("mark");
    mark.textContent = match[0];
    fragment.append(mark);
    cursor = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(value.slice(cursor)));
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

const icon = (name) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    name === "copy"
      ? "M7 6V3h10v10h-3M3 7h10v10H3z"
      : "M7.5 12.5 12.5 7.5M6 14l-1 1a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0M14 6l1-1a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0"
  );
  svg.append(path);
  return svg;
};

const createOffenseRow = (offense) => {
  const displayCode = offense.code ?? "No direct citation";
  const row = document.createElement("article");
  row.className = "offense-row";
  row.id = offense.id;

  const codeStack = document.createElement("div");
  codeStack.className = "code-stack";
  const primaryCode = document.createElement("span");
  primaryCode.className = "primary-code";
  primaryCode.append(highlight(displayCode, state.query));
  const primaryGroup = document.createElement("span");
  primaryGroup.className = "code-group";
  const primaryLabel = document.createElement("span");
  primaryLabel.className = "code-label";
  primaryLabel.textContent = "ILCS section";
  primaryGroup.append(primaryLabel, primaryCode);
  codeStack.append(primaryGroup);

  offense.reportingCodes.forEach((reportingCode, index) => {
    const reportingGroup = document.createElement("span");
    reportingGroup.className = "code-group";
    if (index === 0) {
      const reportingLabel = document.createElement("span");
      reportingLabel.className = "code-label";
      reportingLabel.textContent = "SOS Police report";
      reportingGroup.append(reportingLabel);
    }
    const uniform = document.createElement("span");
    uniform.className = "uniform-code";
    uniform.title = "Secretary of State Police uniform reporting code";
    const label = reportingCode.role
      ? `${reportingCode.value} · ${reportingCode.role}`
      : reportingCode.value;
    uniform.append(highlight(label, state.query));
    uniform.setAttribute("aria-label", `Secretary of State Police reporting code ${label}`);
    reportingGroup.append(uniform);
    codeStack.append(reportingGroup);
  });

  if (offense.mandatoryAppearance) {
    const badge = document.createElement("span");
    badge.className = "mandatory-badge";
    badge.textContent = "Court appearance required";
    codeStack.append(badge);
  }

  const descriptionBlock = document.createElement("div");
  const description = document.createElement("p");
  description.className = "offense-description";
  description.append(highlight(offense.description, state.query));
  const context = document.createElement("p");
  context.className = "offense-context";
  context.textContent = `${offense.chapter} · ${offense.section} · PDF page ${offense.page}`;
  descriptionBlock.append(description, context);

  const actions = document.createElement("div");
  actions.className = "offense-actions";
  const copyButton = document.createElement("button");
  copyButton.className = "row-action";
  copyButton.type = "button";
  copyButton.setAttribute("aria-label", `Copy full record for ILCS section ${displayCode}`);
  copyButton.title = "Copy full record";
  copyButton.append(icon("copy"));
  copyButton.addEventListener("click", () => {
    const uniform = offense.reportingCodes.length
      ? ` (${offense.reportingCodes
          .map(({ value, role }) => (role ? `${value}-${role}` : value))
          .join(", ")})`
      : "";
    writeClipboard(
      `${offense.mandatoryAppearance ? "*" : ""}${displayCode}${uniform} — ${offense.description}`,
      `${displayCode} copied`
    );
  });

  const shareButton = document.createElement("button");
  shareButton.className = "row-action";
  shareButton.type = "button";
  shareButton.setAttribute("aria-label", `Copy direct link to ILCS section ${displayCode}`);
  shareButton.title = "Copy direct link to record";
  shareButton.append(icon("link"));
  shareButton.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.hash = offense.id;
    writeClipboard(url.toString(), `Link to ${displayCode} copied`);
  });
  actions.append(copyButton, shareButton);

  row.append(codeStack, descriptionBlock, actions);
  return row;
};

const createCountyRow = (county) => {
  const row = document.createElement("div");
  row.className = "county-row";
  const name = document.createElement("span");
  name.append(highlight(county.name, state.query));
  const code = document.createElement("code");
  code.append(highlight(county.code, state.query));
  row.append(name, code);
  return row;
};

const createGuideRow = (guide, index) => {
  const row = document.createElement("article");
  row.className = "guide-row";
  row.id = guide.id;

  const number = document.createElement("span");
  number.className = "guide-number";
  number.textContent = String(index + 1).padStart(2, "0");

  const content = document.createElement("div");
  const meta = document.createElement("p");
  meta.className = "guide-meta";
  meta.textContent = guide.pages;
  const title = document.createElement("h2");
  title.append(highlight(guide.title, state.query));
  const description = document.createElement("p");
  description.className = "guide-description";
  description.append(highlight(guide.description, state.query));
  const topics = document.createElement("div");
  topics.className = "guide-topics";
  guide.topics.forEach((topic) => {
    const tag = document.createElement("span");
    tag.append(highlight(topic, state.query));
    topics.append(tag);
  });
  content.append(meta, title, description, topics);

  const link = document.createElement("a");
  link.className = "guide-link";
  link.href = `${SOURCE_PDF}#page=${guide.pdfPage}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Open source pages";
  link.setAttribute("aria-label", `Open ${guide.title} in the source PDF`);

  row.append(number, content, link);
  return row;
};

const searchDocumentFor = (offense) => {
  const aliases = [];
  if (offense.code && offense.page <= 34 && !/ILCS|Section/i.test(offense.code)) {
    aliases.push(`625 ILCS 5/${offense.code}`);
  }
  return normalizeQuery(`${offense.searchText} ${aliases.join(" ")}`);
};

const offenseSearchScore = (offense, query) => {
  if (!query) return 2;
  const code = normalizeQuery(offense.code ?? "");
  const canonical = offense.code && offense.page <= 34 && !/ILCS|Section/i.test(offense.code)
    ? normalizeQuery(`625 ILCS 5/${offense.code}`)
    : code;
  const reports = offense.reportingCodes.map(({ value }) => normalizeQuery(value));
  if (query === code || query === canonical || reports.includes(query)) return 0;
  if (code.startsWith(query) || canonical.startsWith(query) || reports.some((value) => value.startsWith(query))) return 1;
  return 2;
};

const getFilteredOffenses = () => {
  const query = normalizeQuery(state.query);
  return state.data.offenses.map((offense, index) => ({ offense, index })).filter(({ offense }) => {
    if (query && !searchDocumentFor(offense).includes(query)) return false;
    if (state.family !== "all" && familyFor(offense) !== state.family) return false;
    if (state.chapter !== "all" && offense.chapter !== state.chapter) return false;
    if (state.mandatoryOnly && !offense.mandatoryAppearance) return false;
    return true;
  }).sort((a, b) => offenseSearchScore(a.offense, query) - offenseSearchScore(b.offense, query) || a.index - b.index)
    .map(({ offense }) => offense);
};

const getFilteredCounties = () => {
  const query = normalizeQuery(state.query);
  if (!query) return state.data.counties;
  return state.data.counties.filter((county) =>
    `${county.name} ${county.code}`.toLowerCase().includes(query)
  );
};

const getFilteredGuides = () => {
  const query = normalizeQuery(state.query);
  if (!query) return guides;
  return guides.filter((guide) =>
    normalizeQuery(`${guide.title} ${guide.description} ${guide.topics.join(" ")}`).includes(query)
  );
};

const activeFilterCount = () =>
  Number(state.family !== "all") +
  Number(state.chapter !== "all") +
  Number(state.mandatoryOnly);

const syncUrl = () => {
  const url = new URL(window.location.href);
  url.search = "";
  if (state.query) url.searchParams.set("q", state.query);
  if (state.view !== "offenses") url.searchParams.set("view", state.view);
  if (state.family !== "all") url.searchParams.set("family", state.family);
  if (state.chapter !== "all") url.searchParams.set("chapter", state.chapter);
  if (state.mandatoryOnly) url.searchParams.set("appearance", "mandatory");
  history.replaceState(null, "", url);
};

const render = () => {
  if (!state.data) return;
  elements.results.replaceChildren();
  elements.results.setAttribute("aria-busy", "false");

  const isOffenses = state.view === "offenses";
  const isCounties = state.view === "counties";
  const allResults = isOffenses
    ? getFilteredOffenses()
    : isCounties
      ? getFilteredCounties()
      : getFilteredGuides();
  const visibleResults = allResults.slice(0, state.visibleCount);
  const fragment = document.createDocumentFragment();

  if (isOffenses) {
    visibleResults.forEach((offense) => fragment.append(createOffenseRow(offense)));
  } else if (isCounties) {
    const countyList = document.createElement("div");
    countyList.className = "county-list";
    visibleResults.forEach((county) => countyList.append(createCountyRow(county)));
    fragment.append(countyList);
  } else {
    visibleResults.forEach((guide) => fragment.append(createGuideRow(guide, guides.indexOf(guide))));
  }
  elements.results.append(fragment);

  const noun = isOffenses
    ? (allResults.length === 1 ? "offense" : "offenses")
    : isCounties
      ? "county codes"
      : (allResults.length === 1 ? "guide" : "guides");
  elements.resultSummary.innerHTML = `<strong>${allResults.length.toLocaleString()}</strong> ${noun}`;
  elements.emptyState.hidden = allResults.length > 0;
  elements.results.hidden = allResults.length === 0;
  elements.loadMore.hidden = allResults.length <= state.visibleCount;
  if (!elements.loadMore.hidden) {
    const remaining = allResults.length - state.visibleCount;
    elements.loadMore.textContent = `Show ${Math.min(PAGE_SIZE, remaining)} more of ${remaining}`;
  }

  const filterTotal = activeFilterCount();
  elements.filterCount.textContent = filterTotal;
  elements.filterCount.hidden = filterTotal === 0;
  elements.searchShell.classList.toggle("has-value", Boolean(state.query));
  if (window.innerWidth >= 980) {
    elements.filters.hidden = !isOffenses;
  } else if (!elements.filters.classList.contains("is-open")) {
    elements.filters.hidden = true;
  }
  elements.filterTrigger.hidden = !isOffenses;
  elements.search.placeholder = isOffenses
    ? "Search 11-501, 2490, DUI…"
    : isCounties
      ? "Search Cook, 016…"
      : "Search pretrial, placards, weights…";

  document.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab.dataset.view === state.view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) elements.results.setAttribute("aria-labelledby", tab.id);
  });

  syncUrl();
};

const resetView = ({ keepView = true } = {}) => {
  state.query = "";
  state.family = "all";
  state.chapter = "all";
  state.mandatoryOnly = false;
  state.visibleCount = PAGE_SIZE;
  if (!keepView) state.view = "offenses";
  elements.search.value = "";
  elements.mandatoryFilter.checked = false;
  elements.chapterFilter.value = "all";
  const allFamily = document.querySelector('input[name="family"][value="all"]');
  if (allFamily) allFamily.checked = true;
  render();
};

const openFilters = () => {
  window.clearTimeout(closeFilters.hideTimer);
  elements.filters.hidden = false;
  elements.filters.classList.add("is-open");
  elements.filterBackdrop.hidden = false;
  elements.filterTrigger.setAttribute("aria-expanded", "true");
  elements.filters.setAttribute("role", "dialog");
  elements.filters.setAttribute("aria-modal", "true");
  document.body.style.overflow = "hidden";
  elements.closeFilters.focus();
};

const closeFilters = () => {
  window.clearTimeout(closeFilters.hideTimer);
  const wasOpen = elements.filters.classList.contains("is-open");
  elements.filters.classList.remove("is-open");
  elements.filterBackdrop.hidden = true;
  elements.filterTrigger.setAttribute("aria-expanded", "false");
  elements.filters.removeAttribute("role");
  elements.filters.removeAttribute("aria-modal");
  document.body.style.overflow = "";
  if (wasOpen && window.innerWidth < 980 && state.view === "offenses") {
    elements.filterTrigger.focus();
  }
  if (window.innerWidth < 980) {
    closeFilters.hideTimer = window.setTimeout(() => {
      if (!elements.filters.classList.contains("is-open")) {
        elements.filters.hidden = true;
      }
    }, 230);
  }
};

const buildFilters = () => {
  const counts = new Map(families.map((family) => [family, 0]));
  state.data.offenses.forEach((offense) => counts.set(familyFor(offense), counts.get(familyFor(offense)) + 1));

  const options = [{ label: "All codes", value: "all", count: state.data.offenses.length }].concat(
    families.map((family) => ({ label: family, value: family, count: counts.get(family) }))
  );

  options.forEach((option) => {
    const label = document.createElement("label");
    label.className = "radio-row";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "family";
    input.value = option.value;
    input.checked = option.value === state.family;
    const labelText = document.createElement("span");
    labelText.className = "radio-label";
    const text = document.createElement("span");
    text.textContent = option.label;
    const count = document.createElement("span");
    count.className = "radio-count";
    count.textContent = option.count.toLocaleString();
    labelText.append(text, count);
    input.addEventListener("change", () => {
      state.family = input.value;
      state.visibleCount = PAGE_SIZE;
      render();
    });
    label.append(input, labelText);
    elements.familyFilters.append(label);
  });

  const chapters = [...new Set(state.data.offenses.map((offense) => offense.chapter))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true })
  );
  chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = chapter.replace(/^CHAPTER\s+/i, "");
    elements.chapterFilter.append(option);
  });
  elements.chapterFilter.value = state.chapter;
};

const hydrateStateFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  state.query = params.get("q") ?? "";
  state.view = ["counties", "guides"].includes(params.get("view")) ? params.get("view") : "offenses";
  state.family = families.includes(params.get("family")) ? params.get("family") : "all";
  state.chapter = params.get("chapter") ?? "all";
  state.mandatoryOnly = params.get("appearance") === "mandatory";
  elements.search.value = state.query;
  elements.mandatoryFilter.checked = state.mandatoryOnly;
};

const setupTheme = () => {
  const storedTheme = localStorage.getItem("offense-index-theme");
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = storedTheme ?? (systemDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Use light theme" : "Use dark theme"
  );
};

const bindEvents = () => {
  let searchTimer;
  elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = elements.search.value;
      state.visibleCount = PAGE_SIZE;
      render();
    }, 70);
  });

  elements.clearSearch.addEventListener("click", () => {
    state.query = "";
    elements.search.value = "";
    elements.search.focus();
    render();
  });

  elements.loadMore.addEventListener("click", () => {
    const previousCount = state.visibleCount;
    state.visibleCount += PAGE_SIZE;
    render();
    const renderedRows = elements.results.querySelectorAll(".offense-row, .county-row, .guide-row");
    const firstNewRow = renderedRows[previousCount];
    if (firstNewRow) {
      firstNewRow.tabIndex = -1;
      firstNewRow.focus();
    }
  });

  elements.mandatoryFilter.addEventListener("change", () => {
    state.mandatoryOnly = elements.mandatoryFilter.checked;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  elements.chapterFilter.addEventListener("change", () => {
    state.chapter = elements.chapterFilter.value;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  elements.resetFilters.addEventListener("click", resetView);
  elements.emptyReset.addEventListener("click", () => resetView({ keepView: true }));

  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.view = tab.dataset.view;
      state.visibleCount = PAGE_SIZE;
      if (state.view === "counties") closeFilters();
      render();
    });
  });

  document.querySelector(".view-tabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll(".view-tab")];
    const current = tabs.indexOf(document.activeElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  });

  elements.filters.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !elements.filters.classList.contains("is-open")) return;
    const focusable = [...elements.filters.querySelectorAll("button, input, select, a[href]")]
      .filter((control) => !control.disabled && !control.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  elements.filterTrigger.addEventListener("click", openFilters);
  elements.closeFilters.addEventListener("click", closeFilters);
  elements.filterBackdrop.addEventListener("click", closeFilters);

  elements.copyLink.addEventListener("click", () => {
    writeClipboard(window.location.href, "Current view link copied");
  });

  elements.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("offense-index-theme", next);
    elements.themeToggle.setAttribute(
      "aria-label",
      next === "dark" ? "Use light theme" : "Use dark theme"
    );
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      document.activeElement !== elements.search &&
      !elements.filters.classList.contains("is-open")
    ) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === "Escape") {
      if (elements.filters.classList.contains("is-open")) {
        closeFilters();
      } else if (document.activeElement === elements.search && elements.search.value) {
        state.query = "";
        elements.search.value = "";
        render();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 980) {
      window.clearTimeout(closeFilters.hideTimer);
      elements.filters.hidden = state.view !== "offenses";
      elements.filters.classList.remove("is-open");
      elements.filterBackdrop.hidden = true;
      elements.filterTrigger.setAttribute("aria-expanded", "false");
      elements.filters.removeAttribute("role");
      elements.filters.removeAttribute("aria-modal");
      document.body.style.overflow = "";
    } else if (!elements.filters.classList.contains("is-open")) {
      elements.filters.hidden = true;
    }
  });
};

const init = async () => {
  setupTheme();
  bindEvents();
  hydrateStateFromUrl();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    state.data = await response.json();
    state.data.offenses.forEach((offense) => {
      offense.family = familyFor(offense);
    });
    elements.offenseTabCount.textContent = state.data.meta.offenseEntries.toLocaleString();
    elements.countyTabCount.textContent = state.data.meta.countyCodes.toLocaleString();
    elements.guideTabCount.textContent = guides.length.toLocaleString();
    buildFilters();

    if (window.location.hash.startsWith("#offense-")) {
      state.view = "offenses";
      const targetIndex = getFilteredOffenses().findIndex(({ id }) => `#${id}` === window.location.hash);
      if (targetIndex >= 0) {
        state.visibleCount = Math.ceil((targetIndex + 1) / PAGE_SIZE) * PAGE_SIZE;
      }
    }
    render();

    if (window.location.hash) {
      window.requestAnimationFrame(() => {
        const target = document.querySelector(window.location.hash);
        target?.scrollIntoView({ block: "center" });
      });
    }
  } catch (error) {
    elements.results.setAttribute("aria-busy", "false");
    elements.resultSummary.textContent = "Index unavailable";
    elements.results.innerHTML = "<p class=\"offense-description\">The code index could not be loaded. Start the included local server and refresh this page.</p>";
    console.error(error);
  }
};

init();
