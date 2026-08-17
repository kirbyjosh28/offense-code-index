# Design Brief: Lookup-First UX Overhaul

## Direction

Make search shortcuts feel immediate and dependable, replace the heavy source notice with a compact actionable provenance component, and improve mobile efficiency and record scanning without changing the one-page information architecture.

## Experience requirements

- Preserve the warm charcoal/lavender identity and stable 120px sticky header.
- Keep search primary, with a visible live match count and an overlaid tools panel.
- Common-stop actions must close the panel, reveal results, and announce the count.
- Quick filters remain open so users can combine them.
- Keep every one of the 953 offenses and nine guides available without pagination.
- Preserve fuzzy search, partial codes, URL state, exact PDF-page links, themes, keyboard navigation, 44px targets, and reduced motion.

## Responsive and motion targets

- Review at 375×812, 768×1024, and 1280×800 in light and dark themes.
- Search tools use horizontally scrollable chip rails on narrow screens without page overflow.
- Limit motion to 140–260ms interaction and status transitions; never animate result rendering.
