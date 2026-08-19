/**
 * Rendered-layout checks.
 *
 * Every other suite in this project asserts over source text. These assertions
 * need a real layout engine, so they run separately (`npm run test:layout`) and
 * drive the preinstalled Chromium over CDP — see scripts/cdp.mjs for why there
 * is no browser-automation dependency.
 *
 * Two things Chromium cannot verify, and which still need a device or the iOS
 * Simulator: env(safe-area-inset-*) always resolves to 0 here, and there is no
 * dynamic URL bar, so 100svh === 100dvh === 100vh.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { launchBrowser, startServer } from "../scripts/cdp.mjs";

/** Phone widths the design brief and review call out, plus the modern extremes. */
const VIEWPORTS = [
  { name: "iPhone SE (1st gen)", width: 320, height: 568 },
  { name: "iPhone X / 13 mini", width: 375, height: 812 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPhone 15 Pro Max", width: 430, height: 932 },
];

const TAP_TARGET_MIN = 44;

let browser;
let server;
let page;

before(async () => {
  server = await startServer();
  browser = await launchBrowser();
  page = browser.page;
});

after(async () => {
  await browser?.close();
  await server?.close();
});

test("the phone layout never overflows horizontally", async () => {
  for (const viewport of VIEWPORTS) {
    await page.setViewport(viewport);
    await page.goto(`${server.origin}/`);

    const overflow = await page.evaluate(`(() => {
      const doc = document.documentElement;
      const offenders = [...document.querySelectorAll("body *")]
        .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 0.5)
        .slice(0, 5)
        .map((node) => node.className || node.tagName);
      return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, offenders };
    })()`);

    assert.ok(
      overflow.scrollWidth <= overflow.innerWidth,
      `${viewport.name} (${viewport.width}px): document scrolls horizontally ` +
        `(${overflow.scrollWidth} > ${overflow.innerWidth}); first offenders: ` +
        `${overflow.offenders.join(", ") || "none identified"}`
    );
  }
});

test("the floating search shell shares one edge with the content below it", async () => {
  for (const viewport of VIEWPORTS) {
    await page.setViewport(viewport);
    await page.goto(`${server.origin}/`);

    const edges = await page.evaluate(`(() => {
      const main = document.querySelector("main");
      const shell = document.querySelector(".search-shell");
      const mainStyles = getComputedStyle(main);
      return {
        content: main.getBoundingClientRect().left + parseFloat(mainStyles.paddingLeft),
        shell: shell.getBoundingClientRect().left,
      };
    })()`);

    assert.ok(
      Math.abs(edges.content - edges.shell) <= 1,
      `${viewport.name} (${viewport.width}px): the search pill sits at ${edges.shell}px but ` +
        `page content starts at ${edges.content}px — the header and the list must share a gutter`
    );
  }
});

test("every page region keeps the gutter on both sides", async () => {
  for (const viewport of VIEWPORTS) {
    await page.setViewport(viewport);
    await page.goto(`${server.origin}/`);

    // A `padding` shorthand in a later rule can silently reset the inline
    // gutter the shared `main, footer` rule sets, so check the computed value.
    const regions = await page.evaluate(`(() => {
      return ["main", "footer"].map((selector) => {
        const node = document.querySelector(selector);
        const style = getComputedStyle(node);
        return {
          selector,
          left: parseFloat(style.paddingLeft),
          right: parseFloat(style.paddingRight),
        };
      });
    })()`);

    for (const region of regions) {
      assert.ok(
        region.left >= 16 && region.right >= 16,
        `${viewport.name} (${viewport.width}px): ${region.selector} has ` +
          `${region.left}px/${region.right}px inline padding, below the 16px gutter`
      );
    }
  }
});

/*
 * The design brief promises 44px touch targets and the stylesheet delivers that
 * as min-height on every control. Width is content-driven for text links in the
 * footer rail (`.trust-links a` pins only min-height), so the width floor here
 * is WCAG 2.2 SC 2.5.8's 24px rather than an invented 44px rule.
 */
const TARGET_WIDTH_MIN = 24;

test("interactive controls keep their tap targets on phones", async () => {
  for (const viewport of VIEWPORTS) {
    await page.setViewport(viewport);
    await page.goto(`${server.origin}/`);

    const undersized = await page.evaluate(`(() => {
      const selector = "a[href], button, input, select";
      // WCAG 2.2 SC 2.5.8 exempts targets sitting inline within a run of text.
      // Detect that structurally: the link shares its parent with real text.
      const isInlineInText = (node) => {
        if (node.tagName !== "A") return false;
        const parent = node.parentElement;
        if (!parent) return false;
        return [...parent.childNodes].some(
          (child) => child.nodeType === 3 && child.textContent.trim().length > 0
        );
      };
      return [...document.querySelectorAll(selector)]
        .filter((node) => {
          if (node.closest("[hidden], [inert], .sr-only")) return false;
          if (isInlineInText(node)) return false;
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const box = node.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          return box.height < ${TAP_TARGET_MIN} || box.width < ${TARGET_WIDTH_MIN};
        })
        .map((node) => {
          const box = node.getBoundingClientRect();
          const label = node.className || node.id || (node.textContent || "").trim().slice(0, 20) || node.tagName;
          return label + " " + Math.round(box.width) + "x" + Math.round(box.height);
        });
    })()`);

    assert.deepEqual(
      undersized,
      [],
      `${viewport.name} (${viewport.width}px): controls under ` +
        `${TAP_TARGET_MIN}px tall or ${TARGET_WIDTH_MIN}px wide: ${undersized.join("; ")}`
    );
  }
});

test("wrapped footer links keep vertical separation between tap targets", async () => {
  await page.setViewport(VIEWPORTS[0]);
  await page.goto(`${server.origin}/`);

  const rowGap = await page.evaluate(
    `getComputedStyle(document.querySelector(".trust-links")).rowGap`
  );
  assert.notEqual(
    rowGap,
    "0px",
    "trust links wrap to several rows on a phone; a zero row gap makes 44px targets touch"
  );
});

test("the sticky header holds its documented height while the search panel opens", async () => {
  await page.setViewport(VIEWPORTS[1]);
  await page.goto(`${server.origin}/`);

  const closed = await page.evaluate(
    `document.querySelector(".site-header").getBoundingClientRect().height`
  );
  assert.equal(closed, 120, "the design brief pins the sticky header at 120px");

  const opened = await page.evaluate(`(async () => {
    document.getElementById("search").focus();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const tools = document.getElementById("search-tools").getBoundingClientRect();
    return { header: header.height, toolsBottom: tools.bottom, viewport: window.innerHeight };
  })()`);

  assert.equal(opened.header, 120, "opening the search panel must not move page content");
  assert.ok(
    opened.toolsBottom <= opened.viewport + 0.5,
    `the search panel extends to ${opened.toolsBottom}px past a ${opened.viewport}px viewport`
  );
});

test("the statute sheet is bottom-anchored and full-bleed on phones", async () => {
  await page.setViewport(VIEWPORTS[1]);
  await page.goto(`${server.origin}/`);

  // Only records with a resolved statutory section get the affordance, and it is
  // the sole row action that opens a dialog.
  const sheet = await page.evaluate(`(async () => {
    const trigger = document.querySelector('.row-action[aria-haspopup="dialog"]');
    if (!trigger) return { trigger: false };
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const dialog = document.getElementById("statute-sheet");
    const box = dialog.getBoundingClientRect();
    return {
      trigger: true,
      open: dialog.open,
      left: box.left,
      right: box.right,
      bottom: box.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  })()`);

  assert.ok(sheet.trigger, "no statute affordance rendered; the check would pass vacuously");
  assert.ok(sheet.open, "clicking the statute action must open the dialog");
  assert.ok(Math.abs(sheet.left) <= 1, `sheet should be full-bleed, starts at ${sheet.left}px`);
  assert.ok(
    Math.abs(sheet.right - sheet.viewportWidth) <= 1,
    `sheet should reach the right edge, ends at ${sheet.right}px of ${sheet.viewportWidth}px`
  );
  assert.ok(
    Math.abs(sheet.bottom - sheet.viewportHeight) <= 1,
    `sheet should be bottom-anchored, ends at ${sheet.bottom}px of ${sheet.viewportHeight}px`
  );
});
