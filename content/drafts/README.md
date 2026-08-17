# Generated content drafts

Plain-language summaries, quick elements, and things-to-confirm live here as drafts.

**Nothing in this directory is ever copied into `dist/`.** A draft becomes publishable
only when `content/review-log.ndjson` carries a `verified` entry whose `draftSha256` and
`sectionSha256` still match the draft on disk and the statutory text currently retrieved
from ILGA. Edit a draft, or let Illinois amend the statute, and the record silently
returns to needs-review — an approval cannot be inherited by content nobody approved.

Every quick element must also carry a `sourceMapping` entry whose `sourceText` is a
verbatim substring of that section's retrieved text. `scripts/validate-enrichment.mjs`
fails the build otherwise.

This directory is intentionally empty of drafts. See `docs/legal-data-maintenance.md`.
