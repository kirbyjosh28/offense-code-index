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

- Mobile: 375×812 with 16px gutters and horizontally scrollable search-tool rails.
- Tablet: 768×1024 with 32px gutters.
- Desktop: 1280×800 with 48px gutters and a three-column offense record layout.

## Motion

- Use the existing `--ease-out` curve and 140–260ms duration scale.
- Search press, focus, panel reveal, theme changes, headings, hover, and status feedback may animate.
- Do not animate result rendering or run ambient placeholder/border animations.
- Remove meaningful transforms when `prefers-reduced-motion: reduce` is active.
