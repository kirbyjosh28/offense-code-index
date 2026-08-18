# Design Brief: Raycast-Inspired Offense Index Refinement

## Direction

Refine the Illinois Offense Code Index with Raycast-like spacing discipline, hierarchy, quiet surfaces, and purposeful motion while preserving the existing warm charcoal and restrained lavender identity. The result should feel like a focused professional lookup tool, not a marketing landing page.

## Experience requirements

- Keep the centered pill navigation and make the persistent centered search the primary tool.
- Keep the sticky header at a stable 120px; suggestions and filters open in an overlaid panel without moving page content.
- Use a concise static placeholder and interaction-only motion.
- Preserve plain-language, fuzzy, partial-code, and URL-synchronized search behavior.
- Keep all 953 offenses and nine guides visible on the same page with no pagination or county section.
- Reduce nested borders and repeated tinted boxes; use accent color only for state and action.
- Compact offense records without hiding codes, descriptions, court requirements, source pages, or actions.
- Support light and dark themes, keyboard navigation, 44px touch targets, WCAG 2.2 AA contrast, and reduced motion.

## Responsive targets

- Mobile: 320×568 through 430×932, tuned at 375×812, with 16px gutters and horizontally scrollable search-tool rails.
- Tablet: 768×1024 with 32px gutters.
- Desktop: 1280×800 with 48px gutters and a three-column offense record layout.

The gutter applies identically to the document column and to the floating header
shell above it: the pill navigation, the search pill, and the first offense row
share one left edge at every breakpoint. `--page-gutter` is the design value;
`--gutter-inline` is the derived consumer that widens it to
`env(safe-area-inset-*)` where the inset exceeds it.

## Viewport and safe areas

- `index.html` sets `viewport-fit=cover`, so the page paints under the notch and
  home indicator and is responsible for its own insets. The six `trust/*.html`
  pages deliberately do not: their bytes are checksummed in
  `config/release-governance.json`, and with the default `viewport-fit` iOS insets
  their layout viewport already.
- Bottom-anchored surfaces add `env(safe-area-inset-bottom)` so they clear the
  home indicator: the statute sheet body, the toast, the update prompt, the footer.
- Document gutters take `max()` against the inset (a minimum clearance); fixed
  transient chrome adds it (preserving an optical gap).
- Viewport-relative caps use `svh` for edge-anchored surfaces that must stay fully
  visible while Safari's URL bar is showing (the search panel, the phone statute
  sheet) and `dvh` for centred surfaces that can breathe (the desktop sheet). Each
  is preceded by a `vh` declaration as the fallback.

## Spacing scale

`--space-1` through `--space-8` (4/8/12/16/24/32/48/64px) plus two sanctioned
half-steps, `--space-05` (2px) and `--space-15` (6px). Values outside that scale —
3, 5, 7, 9, 10, 26, 36, 82px — are not part of the system and were removed.

One documented exception remains: `.offense-row` keeps `padding: 20px 0` at
≥980px. It is off-scale, and correcting it to 24px would change desktop row
density across all 953 records, which is out of scope for a mobile pass.

## Motion

- Use the existing `--ease-out` curve and 140–260ms duration scale.
- Search press, focus, panel reveal, theme changes, headings, hover, and status feedback may animate.
- Do not animate result rendering or run ambient placeholder/border animations.
- Remove meaningful transforms when `prefers-reduced-motion: reduce` is active.
