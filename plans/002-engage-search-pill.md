# 002 — Make the search pill respond to touch

- **Status**: DONE
- **Commit**: dd6c075
- **Severity**: MEDIUM
- **Category**: Purpose & frequency / physicality / accessibility
- **Estimated scope**: 4 source files, roughly 90 lines

## Problem

The persistent search pill is the site's primary control, but pointer interaction only changes its
border and focus ring. It does not physically acknowledge a click, and the separate helper sentence
under the pill repeats capability copy the user explicitly wants removed:

```html
<!-- index.html:61-69 — current -->
aria-describedby="search-capability"
placeholder="Describe what happened or enter a code…"
...
<p class="search-capability" id="search-capability"><span aria-hidden="true"></span> Everyday-language search · searches all categories</p>
```

```css
/* styles.css:311-333 — current */
.search-shell {
  transform-origin: center;
  transition:
    transform var(--duration-medium) var(--ease-in-out);
}

.search-shell:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
```

The search can be focused from the `/` keyboard shortcut, so motion must be pointer-specific.
Keyboard-initiated focus is high frequency and must retain the clear focus ring without playing the
click movement. Search-result rendering must remain instantaneous.

## Target

Remove the helper paragraph and its `aria-describedby` reference. Make the whole non-button area of
the pill focus the search input. Add one interruptible, pointer-only physical response using existing
motion tokens and CSS transitions:

```css
/* target interaction states */
.site-header .search-shell.is-pressed {
  transform: scale(0.985);
  transition-duration: 160ms;
  transition-timing-function: var(--ease-out);
}

.site-header .search-shell.is-engaged {
  transform: scale(1.018);
  transition-duration: var(--duration-fast);
  transition-timing-function: var(--ease-out);
}

.search-shell.is-engaged .search-icon {
  transform: rotate(-8deg) scale(1.08);
  transition-duration: var(--duration-fast);
}

.search-shell.is-engaged .search-icon::before {
  opacity: 0.28;
  transform: scale(1);
  transition-duration: var(--duration-fast);
}
```

- Pointer down compresses the pill to `scale(0.985)` over `160ms` with `--ease-out`.
- Pointer release expands it to `scale(1.018)` over `--duration-fast` (`140ms`) with `--ease-out`
  and leaves that subtle emphasis while focus remains inside the pill.
- Focus leaving the pill removes both state classes and returns it to the normal or scrolled scale.
- The magnifying glass rotates `-8deg` and scales to `1.08` over `--duration-fast` (`140ms`)
  `--ease-out`. A circular
  `::before` halo moves from `opacity: 0; transform: scale(0.78)` to
  `opacity: 0.28; transform: scale(1)` over the same duration.
- The existing focus ring remains visible for pointer and keyboard focus. Keyboard focus alone does
  not add `.is-pressed` or `.is-engaged` and therefore does not move the pill.
- Under `prefers-reduced-motion: reduce`, engaged/pressed transforms are `none`; the focus ring and a
  short `120ms` halo opacity change may remain.

## Repo conventions to follow

- Reuse `--ease-out`, `--ease-in-out`, `--duration-fast`, and `--duration-medium` from the `:root`
  motion tokens in `styles.css`.
- The existing pointer/button press pattern uses `scale(0.97)` and targeted transitions near
  `styles.css:947`; keep selectors targeted and never use `transition: all`.
- Motion around search is allowed, but `renderOffenses()` and the 100ms input debounce in
  `app.js:452-461` stay untouched.
- `prefersReducedMotion()` already exists in `app.js`; use it rather than adding another media-query
  listener.
- The product direction is refined functionalism: crisp and restrained, with no bounce, spring,
  decorative loop, or sound.

## Steps

1. In `index.html`, remove `aria-describedby="search-capability"` from `#search` and delete the
   complete `.search-capability` paragraph. Preserve the visible placeholder and screen-reader-only
   label.
2. In `styles.css`, delete `.site-header.is-scrolled .search-capability`, `.search-capability`, and
   `.search-capability span`. Do not leave dead selectors.
3. In `styles.css`, keep the search shell's base `220ms` transform transition, then add a `160ms`
   press and a `--duration-fast` (`140ms`) release with `--ease-out` on
   `.site-header .search-shell.is-pressed` and `.site-header .search-shell.is-engaged` after the
   focus rule so they override `.site-header.is-scrolled .search-shell` without `!important`.
4. In `styles.css`, give `.search-icon` `transform-origin: center` and targeted `transform 220ms
   var(--ease-out)` transition. Add an absolutely positioned
   circular `::before` halo with `inset: -7px`, a `1px solid var(--accent)` border, initial
   `opacity: 0`, and initial `transform: scale(0.78)`. Animate only its opacity and transform.
5. In `styles.css`, add engaged icon and halo states with the exact transforms/opacities from the
   Target section and `--duration-fast` transition overrides. Keep the existing `::after`
   magnifying-glass handle unchanged.
6. In `app.js` inside `bindEvents()`, add pointer-state handlers. On primary-button `pointerdown`,
   if reduced motion is not requested, remove `.is-engaged` and add `.is-pressed`. On window
   `pointerup`, only when `.is-pressed` exists, replace it with `.is-engaged`. On `pointercancel`,
   remove `.is-pressed`. Use class state and CSS transitions; do not use keyframes, WAAPI, or a
   continuous animation loop.
7. In `app.js`, add a `click` handler on `.search-shell` that focuses `#search` unless the click
   originated from a button. Add a `focusout` handler that checks focus on the next animation frame
   and removes both motion state classes only when focus is no longer inside `.search-shell`.
8. In the reduced-motion block of `styles.css`, remove the deleted `.search-capability` selector and
   explicitly neutralize `.is-pressed`, `.is-engaged`, and the engaged icon/halo transforms. Keep
   the halo's optional opacity feedback at `120ms ease`.
9. In `test/interface.test.mjs`, replace the assertion for the removed helper copy with negative
   assertions for the copy, `.search-capability`, and `aria-describedby="search-capability"`. Add
   assertions for pointerdown/pointerup/pointercancel/focusout behavior, the exact pressed/engaged
   scale values, icon/halo states, and reduced-motion neutralization.

## Boundaries

- Do NOT change search aliases, ranking, filters, URL persistence, query debounce, results, or data.
- Do NOT animate typing, result rows, the `/` keyboard shortcut, or programmatic focus from a
  suggestion pill.
- Do NOT animate width, height, margin, padding, top, left, or box-shadow.
- Do NOT use `transition: all`, `ease-in`, `scale(0)`, keyframes, bounce, or a new dependency.
- Do NOT change the search placeholder or hidden accessible label.
- If the cited search markup or motion tokens differ from commit `dd6c075`, stop and report the
  drift instead of improvising.

## Verification

- **Mechanical**: run `node --check app.js`, `npm run build`, `npm test`,
  `npm run validate:data`, and `git diff --check`; all must pass.
- **Feel check**: run the site and confirm:
  - clicking the icon, whitespace, or input focuses search and compresses then expands the pill;
  - holding the pointer keeps the pill compressed and releasing responds immediately;
  - repeatedly clicking retargets smoothly from the current transition state;
  - clicking Clear does not steal its own button action;
  - pressing `/` focuses search with the focus ring but no transform movement;
  - the pill settles to normal when focus leaves and preserves the scrolled-header base scale;
  - at 10% playback speed, only transform and opacity move and no layout shifts;
  - with reduced motion enabled, the focus ring/opacity feedback remains but spatial movement is gone.
- **Done when**: the helper sentence is absent, the whole pill feels tactile on pointer/touch input,
  keyboard focus stays immediate, and all existing search behavior and tests remain green.
