import {
  buildOffensePrimarySearchDocument,
  buildOffenseSearchDocument,
  normalizeText,
  scoreOffenseMatch,
} from "./src/search.js";

const DATA_URL = "./src/data/offense-codes.json";
const SOURCE_PDF = "https://www.ilsos.gov/content/dam/departments/police/offense_code24.pdf";
const MAX_QUERY_LENGTH = 120;

const guides = [
  {
    id: "guide-index-scope",
    title: "Index scope & reporting codes",
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
    title: "Illinois Supreme Court rules",
    pages: "PDF pages 3–7",
    pdfPage: 3,
    description: "Rules 504, 529, 530, 531, 551, 552, 553, 554, and the Rule 501(g) definition.",
  },
  {
    id: "guide-required-appearance",
    title: "Required appearance — Rule 551",
    pages: "PDF pages 5–6",
    pdfPage: 5,
    description: "Allegations and circumstances that require an in-person or remote court appearance.",
  },
  {
    id: "guide-traffic-release",
    title: "Traffic enforcement & pretrial release",
    pages: "PDF pages 6–7",
    pdfPage: 6,
    description: "625 ILCS 5/6-308 and jurisdictions not yet in the Nonresident Violator Compact.",
  },
  {
    id: "guide-under-21",
    title: "Drivers under age 21",
    pages: "PDF page 7",
    pdfPage: 7,
    description: "Alcohol, graduated-driver, zero-tolerance, and phone-related provisions for drivers under 21.",
  },
  {
    id: "guide-plate-weights",
    title: "License plate weight chart",
    pages: "PDF page 11",
    pdfPage: 11,
    description: "Flat-weight, mileage, farm-truck, and farm-trailer designations and maximum gross weights.",
  },
  {
    id: "guide-placards-contacts",
    title: "Disability placards & publication contacts",
    pages: "PDF pages 54–56",
    pdfPage: 54,
    description: "Placard identification, publication ordering, report-form contacts, and corrections information.",
  },
];

const families = [
  "Vehicle Code",
  "Criminal Code",
  "Drugs & public health",
  "Recreation vehicles",
  "Other Illinois statutes",
];

const state = {
  data: null,
  query: "",
  family: "all",
  chapter: "all",
  mandatoryOnly: false,
};

const elements = {
  siteHeader: document.querySelector(".site-header"),
  search: document.querySelector("#search"),
  searchShell: document.querySelector(".search-shell"),
  clearSearch: document.querySelector("#clear-search"),
  results: document.querySelector("#results"),
  resultSummary: document.querySelector("#result-summary"),
  emptyState: document.querySelector("#empty-state"),
  emptyReset: document.querySelector("#empty-reset"),
  familyFilter: document.querySelector("#family-filter"),
  chapterFilter: document.querySelector("#chapter-filter"),
  mandatoryFilter: document.querySelector("#mandatory-filter"),
  resetFilters: document.querySelector("#reset-filters"),
  guideList: document.querySelector("#guide-list"),
  searchPrompts: document.querySelectorAll("[data-search-query]"),
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

const createOffenseRow = (offense) => {
  const displayCode = offense.code ?? "No direct citation";
  const row = document.createElement("article");
  row.className = "offense-row";
  row.id = offense.id;
  row.setAttribute("role", "listitem");

  const codeColumn = document.createElement("div");
  codeColumn.className = "code-column";

  const codeLabel = document.createElement("span");
  codeLabel.className = "micro-label";
  codeLabel.textContent = "ILCS section";
  const primaryCode = document.createElement("h3");
  primaryCode.className = "primary-code";
  primaryCode.append(highlight(displayCode, state.query));
  codeColumn.append(codeLabel, primaryCode);

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
  const description = document.createElement("p");
  description.className = "offense-description";
  description.append(highlight(offense.description, state.query));
  const context = document.createElement("p");
  context.className = "offense-context";
  context.textContent = `${offense.chapter} · ${offense.section} · PDF page ${offense.page}`;
  descriptionColumn.append(description, context);

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
      `${offense.mandatoryAppearance ? "*" : ""}${displayCode}${reporting} — ${offense.description}`,
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
    url.hash = offense.id;
    writeClipboard(url.toString(), `Link to ${displayCode} copied`);
  });
  actions.append(copyButton, linkButton);

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
  link.rel = "noreferrer";
  link.textContent = "Open PDF";
  link.setAttribute("aria-label", `Open ${guide.title} in the source PDF`);

  row.append(number, content, link);
  return row;
};

const getFilteredOffenses = () => {
  const hasQuery = Boolean(normalizeText(state.query));
  return state.data.offenses
    .map((offense, index) => ({
      offense,
      index,
      score: hasQuery ? scoreOffenseMatch(offense, state.query) : 0,
    }))
    .filter(({ offense, score }) => {
      if (!Number.isFinite(score)) return false;
      if (state.family !== "all" && offense.family !== state.family) return false;
      if (state.chapter !== "all" && offense.chapter !== state.chapter) return false;
      if (state.mandatoryOnly && !offense.mandatoryAppearance) return false;
      return true;
    })
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ offense }) => offense);
};

const syncUrl = () => {
  const url = new URL(window.location.href);
  url.search = "";
  if (state.query) url.searchParams.set("q", state.query);
  if (state.family !== "all") url.searchParams.set("family", state.family);
  if (state.chapter !== "all") url.searchParams.set("chapter", state.chapter);
  if (state.mandatoryOnly) url.searchParams.set("appearance", "mandatory");
  history.replaceState(null, "", url);
};

const renderSummary = (count) => {
  const strong = document.createElement("strong");
  strong.textContent = count.toLocaleString();
  const noun = count === 1 ? " offense" : " offenses";
  const suffix = state.query ? ` matching “${state.query.trim()}”` : " — complete index";
  elements.resultSummary.replaceChildren(strong, document.createTextNode(`${noun}${suffix}`));
};

const renderOffenses = () => {
  if (!state.data) return;
  const offenses = getFilteredOffenses();
  const fragment = document.createDocumentFragment();
  offenses.forEach((offense) => fragment.append(createOffenseRow(offense)));
  elements.results.replaceChildren(fragment);
  elements.results.setAttribute("aria-busy", "false");
  elements.results.hidden = offenses.length === 0;
  elements.emptyState.hidden = offenses.length > 0;
  elements.searchShell.classList.toggle("has-value", Boolean(state.query));
  elements.resetFilters.disabled =
    !state.query && state.family === "all" && state.chapter === "all" && !state.mandatoryOnly;
  renderSummary(offenses.length);
  syncUrl();
};

const clearBrowseFilters = () => {
  state.family = "all";
  state.chapter = "all";
  state.mandatoryOnly = false;
  elements.familyFilter.value = "all";
  elements.chapterFilter.value = "all";
  elements.mandatoryFilter.checked = false;
};

const resetFilters = () => {
  state.query = "";
  elements.search.value = "";
  clearBrowseFilters();
  renderOffenses();
};

const buildFilters = () => {
  const counts = new Map(families.map((family) => [family, 0]));
  state.data.offenses.forEach((offense) => counts.set(offense.family, counts.get(offense.family) + 1));

  families.forEach((family) => {
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
  const params = new URLSearchParams(window.location.search);
  state.query = (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  state.family = families.includes(params.get("family")) ? params.get("family") : "all";
  state.chapter = params.get("chapter") ?? "all";
  state.mandatoryOnly = params.get("appearance") === "mandatory";
  elements.search.value = state.query;
  elements.mandatoryFilter.checked = state.mandatoryOnly;
};

const renderStaticSections = () => {
  const guideFragment = document.createDocumentFragment();
  guides.forEach((guide, index) => guideFragment.append(createGuideRow(guide, index)));
  elements.guideList.replaceChildren(guideFragment);
};

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const applyTheme = (theme, persist = false) => {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("offense-index-theme", theme);
  elements.themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
  elements.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Use light theme" : "Use dark theme"
  );
};

const setupTheme = () => {
  const storedTheme = localStorage.getItem("offense-index-theme");
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = storedTheme ?? (systemDark ? "dark" : "light");
  applyTheme(theme);
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
  elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = elements.search.value.slice(0, MAX_QUERY_LENGTH);
      if (state.query) clearBrowseFilters();
      renderOffenses();
    }, 100);
  });

  elements.clearSearch.addEventListener("click", () => {
    state.query = "";
    elements.search.value = "";
    elements.search.focus();
    renderOffenses();
  });

  elements.familyFilter.addEventListener("change", () => {
    state.family = elements.familyFilter.value;
    renderOffenses();
  });

  elements.chapterFilter.addEventListener("change", () => {
    state.chapter = elements.chapterFilter.value;
    renderOffenses();
  });

  elements.mandatoryFilter.addEventListener("change", () => {
    state.mandatoryOnly = elements.mandatoryFilter.checked;
    renderOffenses();
  });

  elements.resetFilters.addEventListener("click", resetFilters);
  elements.emptyReset.addEventListener("click", resetFilters);

  elements.searchPrompts.forEach((prompt) => {
    prompt.addEventListener("click", () => {
      state.query = prompt.dataset.searchQuery.slice(0, MAX_QUERY_LENGTH);
      elements.search.value = state.query;
      clearBrowseFilters();
      renderOffenses();
      elements.search.focus();
      document.getElementById("offenses").scrollIntoView({ block: "start" });
    });
  });

  elements.copyLink.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.hash = "";
    writeClipboard(url.toString(), "Search link copied");
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
    if (event.key === "/" && document.activeElement !== elements.search) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === "Escape" && document.activeElement === elements.search && elements.search.value) {
      state.query = "";
      elements.search.value = "";
      renderOffenses();
    }
  });
};

const init = async () => {
  setupTheme();
  setupHeaderScrollState();
  hydrateStateFromUrl();
  bindEvents();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    state.data = await response.json();
    state.data.offenses.forEach((offense) => {
      offense.family = familyFor(offense);
      offense.primarySearchDocument = buildOffensePrimarySearchDocument(offense);
      offense.searchDocument = buildOffenseSearchDocument(offense);
    });
    buildFilters();
    renderStaticSections();
    renderOffenses();
    setupRevealMotion();

    if (window.location.hash) {
      window.requestAnimationFrame(() => {
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
      });
    }
  } catch (error) {
    elements.results.setAttribute("aria-busy", "false");
    elements.resultSummary.textContent = "Index unavailable";
    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent = "The code index could not be loaded. Please refresh and try again.";
    elements.results.replaceChildren(message);
    console.error(error);
  }
};

init();
