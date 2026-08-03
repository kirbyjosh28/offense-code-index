# 001 — Add a cohesive search-led motion system

- **Status**: DONE
- **Commit**: e9f67fc
- **Severity**: HIGH
- **Category**: Cohesion & tokens / missed opportunities / accessibility
- **Estimated scope**: 2 files, roughly 120 lines

## Problem

The interface is now organized around a persistent search dock, but the motion layer does not yet
communicate that hierarchy. The sticky header, search focus, theme switch, suggestion buttons, and
section entrances mostly change state instantly. The one existing toast transition uses a weak
built-in easing:

```css
/* styles.css:790 — current */
.toast {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 160ms ease, transform 160ms ease;
}
```

The theme switch also swaps every color immediately:

```js
/* app.js:425 — current */
elements.themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("offense-index-theme", next);
});
```

Search-result rendering is intentionally high-frequency and must remain instant while typing. Do
not animate, delay, or stagger `renderOffenses()`; delight belongs around the persistent tool, rare
page entrance, occasional theme switch, section discovery, buttons, and toast feedback.

## Target

Introduce one crisp motion vocabulary and use GPU-safe `transform` and `opacity` transitions only:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --duration-fast: 140ms;
  --duration-medium: 220ms;
  --duration-enter: 260ms;
}
```

- The header remains sticky at all times. After the page scrolls 24px, add `.is-scrolled` and use a
  220ms `--ease-in-out` transition to reduce nav opacity/scale slightly while increasing the search
  shell's visual emphasis. Do not change header height, padding, top, width, or other layout
  properties during the transition.
- On first page load only, the nav, search dock, intro copy, and suggestion pills enter with opacity
  plus `translateY(10px)` over 260ms `--ease-out`, staggered by 50ms. This is a rare entrance, so
  keyframes are acceptable.
- Suggestion pills, nav controls, row actions, primary buttons, and guide links use targeted color,
  border-color, background-color, opacity, and transform transitions. Press feedback is
  `scale(0.97)` over 140ms `--ease-out`. Put hover-only transforms inside
  `@media (hover: hover) and (pointer: fine)`.
- Section headings and guide rows reveal once with opacity plus `translateY(12px)` over 260ms
  `--ease-out`. Add the initial hidden state only after JavaScript adds a root `.motion-ready` class,
  so content never disappears when JavaScript fails.
- Theme changes use `document.startViewTransition` when available and fall back to an instant swap.
  Animate only the old/new root snapshots for 220ms; do not add color transitions to all 953 rows.
- Toast entrance/exit uses 180ms `--ease-out` instead of bare `ease`.
- Reduced-motion mode removes translations, scaling, scroll smoothing, entrance keyframes, and view
  transitions. Keep short opacity/color feedback where it aids comprehension.

## Repo conventions to follow

- Motion tokens belong in the existing `:root` token block at `styles.css:1`.
- Theme state is centralized in `setupTheme()` and the existing theme-toggle handler in `app.js`.
- The app has no runtime dependencies; use CSS and browser APIs only.
- The current global `[hidden] { display: none !important; }` invariant must remain unchanged.
- The persistent search remains the main interaction; its layout and all search/filter behavior are
  out of scope for this plan.

## Steps

1. In `styles.css`, add the five shared duration/easing tokens under `:root`.
2. Add a single 260ms `@keyframes surface-enter` animation from `opacity: 0` and
   `transform: translateY(10px)` to the settled state. Apply it only to `.pill-nav`, `.search-dock`,
   `.eyebrow`, `.intro h1`, `.intro-copy`, `.search-prompts`, and `.notice`, with 50ms incremental
   delays and `both` fill mode.
3. Add targeted 140–220ms transitions to `.pill-nav`, `.search-shell`, `.search-capability`,
   `.search-prompts button`, `.row-action`, `.primary-button`, `.text-button`, `.guide-row a`, and
   `.toast`. Never use `transition: all`.
4. Add `.site-header.is-scrolled .pill-nav` and `.site-header.is-scrolled .search-shell` styles that
   change only opacity, transform, border-color, and box-shadow. Use `scale(0.97)` for the nav and
   `scale(1.01)` for the search shell; keep transform origin centered.
5. In `app.js`, add one passive scroll listener using a requestAnimationFrame guard. Toggle
   `.is-scrolled` on `.site-header` when `window.scrollY > 24`. Do not add a continuous animation
   loop.
6. In `app.js`, add an IntersectionObserver with threshold `0.12` for `.section-heading` and
   `.guide-row`. Add `.motion-ready` to the root immediately before observation, add
   `.is-revealed` when visible, and unobserve each revealed element.
7. Wrap the existing theme mutation in a helper. If `document.startViewTransition` exists and the
   user does not prefer reduced motion, call it with that mutation; otherwise run the mutation
   immediately. Preserve localStorage and accessible-label behavior exactly.
8. Add `::view-transition-old(root)` and `::view-transition-new(root)` animations using opacity only
   for 220ms. Do not animate individual named elements.
9. Replace the global reduced-motion duration nuke with targeted rules that disable the new entrance,
   transforms, smooth scroll, and view-transition animations while leaving color/focus feedback
   intact.
10. Extend `test/interface.test.mjs` with static assertions for the shared curves, targeted
    transition properties, hover-capable media query, reduced-motion branch, passive scroll state,
    IntersectionObserver, and `startViewTransition` fallback.

## Boundaries

- Do NOT change search ranking, aliases, filters, URL persistence, result order, or result rendering.
- Do NOT reintroduce the county section.
- Do NOT add dependencies or a JavaScript animation library.
- Do NOT animate width, height, margin, padding, top, left, or every offense row.
- Do NOT use `transition: all`, `ease-in`, `scale(0)`, or bounce.
- If the persistent search markup or the cited selectors have drifted substantially, STOP and report
  instead of inventing a different motion architecture.

## Verification

- **Mechanical**: run `node --check app.js`, `npm run build`, and `npm test`; all must pass.
- **Feel check**: load the page and confirm:
  - search is immediately interactive during every entrance and reveal;
  - scrolling 24px subtly quiets the nav and emphasizes search without moving page content;
  - typing and clearing results never waits for or restarts an animation;
  - repeated theme toggles remain interruptible and never flash unstyled content;
  - suggestion/button presses compress to 97% without lingering;
  - section reveals happen once and do not replay while scrolling back;
  - at 10% playback speed, no layout property animates;
  - with reduced motion enabled, position/scale movement disappears while focus and color feedback
    remain visible.
- **Done when**: the site feels animated around search and discovery, while search-result updates stay
  immediate and the reduced-motion experience remains stable.
