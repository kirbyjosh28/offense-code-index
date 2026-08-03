# Illinois Offense Code Index

A searchable, responsive web edition of the Illinois Secretary of State Police's February 2024 Offense Code Index. It organizes 953 offense records, all 103 county/reporting entries, and nine guide cards for the publication's procedural and reference material.

## Run locally

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

## Verify

```bash
npm test
npm run validate:data
```

The site has no runtime dependencies. The structured data was generated from positioned text extracted from the supplied 57-page PDF; validation checks ensure every detected primary code was consumed and every four-digit uniform code belongs to a record.

This is a reference interface, not legal advice or a substitute for the current Illinois Compiled Statutes.
