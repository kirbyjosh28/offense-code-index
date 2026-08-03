# Illinois Offense Code Index

A searchable, responsive web edition of the Illinois Secretary of State Police's February 2024 Offense Code Index. It organizes 953 offense records and nine guide cards for the publication's procedural and reference material.

The interface is a single continuous page with a persistent, centered pill search. Search ranks exact ILCS and Secretary of State Police reporting codes first, while also understanding partial wording, natural questions, vehicle-equipment terms such as “headlight out” and “bald tires,” common phrases such as “driving drunk” and “no insurance,” and minor spelling mistakes. Starting a new search clears browse-only filters so valid matches cannot stay hidden; search and filter state still persist in shared URLs.

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
