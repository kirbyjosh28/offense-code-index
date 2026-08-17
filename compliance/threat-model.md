# Threat model

Status: release-candidate evidence; independent security review remains required.

## Trust boundary

The application is an unauthenticated static reference. Search, ranking, filtering, and recents execute in the browser. It has no application backend, accounts, analytics, advertising, report-writing feature, or intended PII/CJI processing. Same-origin static asset delivery and outbound navigation to the source publication are the only runtime network boundaries.

## Principal threats and controls

- Query disclosure: ordinary state remains in memory; explicit sharing uses URL fragments; legacy query strings are migrated before optional fetches; no-referrer is enforced.
- Script/data injection: query and corpus values are rendered with text APIs, URL state is bounded and allowlisted, CSP disallows inline script/style attributes, and Trusted Types enforcement is requested.
- Stale or corrupt corpus: a pinned corpus checksum, exact 953-record invariant, source-page validation, review status, freshness identifier, and emergency-disable state are release controls.
- False authority or operational misuse: independent/non-endorsed and historical-reference language appears before lookup and on every result; results are possible matches and require source/current-law/agency-policy verification.
- Supply chain: there are no runtime dependencies; the build emits an SBOM and deterministic artifact checksums.
- Scope expansion: accounts, stored queries, telemetry, CAD/RMS/MDT connections, and CJI processing require a new privacy, security, and CJIS review.

## Residual risks

Users can place sensitive wording in a shared fragment, legacy query URLs may already have reached hosting logs, the external PDF is controlled by its publisher, and technical controls cannot replace professional judgment or current-law verification.
