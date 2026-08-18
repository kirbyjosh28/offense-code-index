# Design plans

| Plan | Title | Severity | Status |
|---|---|---:|---|
| [001](001-search-led-motion.md) | Add a cohesive search-led motion system | High | DONE |
| [002](002-engage-search-pill.md) | Make the search pill respond to touch | Medium | DONE |
| [003](003-mobile-spacing.md) | Give the phone layout a real spacing system | High | DONE |

Recommended execution order: 001, then 002. Plan 002 extends the tokens and interaction patterns
established by 001 and intentionally leaves high-frequency search-result rendering unanimated.
Plan 003 is independent of both: it reworks spacing, gutters, and iOS viewport handling without
touching the motion layer.
