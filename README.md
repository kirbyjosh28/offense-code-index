# Independent Illinois Offense Code Reference

A searchable, responsive, independently operated reference derived from the Illinois Secretary of State Police's February 2024 Offense Code Index. It organizes 953 offense records and nine guide cards for the publication's procedural and reference material. It is not affiliated with or endorsed by Illinois or any government agency.

The interface is a single continuous page with a centered search pill, an eight-candidate command panel, quick filters, and the full index beneath it. Search ranks exact ILCS and Secretary of State Police reporting codes first, while also understanding partial wording, natural questions, numeric speeding ranges, vehicle-equipment terms such as “headlight out” and “bald tires,” common phrases such as “wrong plates” and “open alcohol,” and minor spelling mistakes. Active filters stay visible and recoverable when they hide a match. Ordinary lookup state remains in memory; only an explicit Share action creates a fragment URL containing the selected query and filters.

Keyboard users can move through ranked candidates with Arrow keys, select with Enter, dismiss with Escape, and focus search with `/`. Up to five selected offense IDs are kept in `sessionStorage` for same-session recents; raw search text is never stored there.

Each row leads with the resolved ILCS citation and the official Illinois General Assembly section title, with the February 2024 publication demoted to a provenance line linking to its exact PDF page. The record list, offence labels, Secretary of State reporting codes, and court-appearance flags still come from that 2024 publication — ILGA publishes statutes, not an offence index, and the reporting codes exist nowhere else. Everything about *current law* comes from ILGA.

Each record that resolves to a statutory section carries a **Statute** action that opens a floating sheet with the current text of that section as retrieved from the Illinois General Assembly, alongside a direct link to the official ILGA page. On phones the sheet is bottom-anchored and full width; on larger screens it is centred. Statutory text is fetched only when the sheet is opened, so it never enters the initial payload, and every sheet states the retrieval date and that the text was retrieved automatically rather than reviewed by a person. Records whose statute is repealed or is missing the cited subsection are marked in the list. `#offense/<id>` links directly to a record with its statute open; the older `#<id>` form still scrolls without opening anything.

Each statute sheet opens with **Key statutory language** — the operative clauses of the exact subsection the record cites, quoted verbatim from the retrieved text. Nothing there is written by the application: clauses are sliced on punctuation only, so statutory qualifiers survive by construction, and every clause is a verbatim substring of what ILGA served. Where a nested provision is not published separately the sheet says so and falls back to the enclosing subsection rather than passing a lead-in off as the cited element. Every record carries a **Report an issue** action that opens a prefilled report for the officers reviewing the content in the field.

No record is presented as verified. A review signature binds to specific bytes — the exact draft text a person read and the exact statutory text it was derived from — so editing an approved draft, or an amendment to the statute beneath it, silently returns the record to needs-review. Plain-language summaries, quick elements, and penalty guidance are deliberately absent: the pipeline that would generate them is designed to require a recorded human review before publication, and that review has not happened. See [`docs/legal-data-maintenance.md`](docs/legal-data-maintenance.md) for how the layer is kept current, and [`docs/illinois-law-audit.md`](docs/illinois-law-audit.md) for what the last sweep found.

The checked-in release uses an owner-attestation governance model. It explicitly records that no external attorney, government agency, accessibility auditor, or independent security assessor approved the site. Production validation requires those limitations to remain visible, binds every trust-center document to an exact checksum, validates the 953-record corpus, and prevents the release from implying independent review that did not occur.

Live site: [illinois-offense-code-index.vercel.app](https://illinois-offense-code-index.vercel.app)

## Run locally

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

## Verify

```bash
npm test
npm run validate:data
npm run validate:release
```

## Refresh the statutory layer

```bash
npm run enrichment:probe
npm run enrichment:verify
npm run enrichment:validate
npm run enrichment:audit
```

`enrichment:probe` confirms ILGA's URL template still resolves before any sweep runs. `enrichment:verify` retrieves each cited section one request at a time with a 1.5s gap, fingerprints the text, and **exits non-zero when a statute has changed** — marking the affected records for review rather than republishing anything. `enrichment:validate` checks the review log's hash chain and asserts that every generated element quotes its statute verbatim. `enrichment:audit` regenerates the findings report. The layer is optional: with no sweep results on disk the site builds and falls back to the frozen 2024 corpus.

`npm run build:draft` emits a local review build in `dist/client` and a Sites worker bundle in `dist/server`. The default `npm run build` and explicit `npm run build:production` run the production governance gate. That gate accepts either documented independent approval or an explicit owner attestation with public disclosure; it does not treat self-review as legal or government approval.

The search regression suite includes 157 synthetic, deidentified officer-style queries across 36 intents, exact and partial codes, typos, numeric boundaries, and related-concept conflicts.

The site has no runtime dependencies. The structured data was generated from positioned text extracted from the supplied 57-page PDF; validation checks ensure every detected primary code was consumed and every four-digit uniform code belongs to a record.

Every result is only a possible match from a historical reporting publication. Confirm the exact source page, current Illinois Compiled Statutes, and applicable agency policy before use. The interface is not legal advice, a probable-cause or charging system, an emergency service, or a substitute for authoritative agency systems.
 
