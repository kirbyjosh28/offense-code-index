# Data-flow inventory

Status: release-candidate evidence; hosting facts must be completed before production.

1. The browser requests static HTML, CSS, JavaScript, the 953-record corpus, source status, content status, and the freshness manifest from the same origin.
2. Search text is normalized, indexed, ranked, and rendered locally. Application code sends no search event or query-dependent request.
3. Theme and slash-shortcut preferences may use local storage. Up to five offense IDs and a dismissed build ID may use session storage. Raw search wording is not stored.
4. Share Results explicitly serializes supported lookup state into a URL fragment. Recipients and anyone with the link can read it; fragments are not included in ordinary HTTP requests.
5. Legacy query parameters are validated and migrated to a fragment before optional runtime fetches. The initial legacy document request may already have entered infrastructure logs.
6. Source and policy links navigate to external destinations with `noopener noreferrer` and a `no-referrer` response policy.

Production approval must record the host, subprocessors, request metadata, locations, retention, incident terms, DPA, and any agency-controlled replacement hosting.
