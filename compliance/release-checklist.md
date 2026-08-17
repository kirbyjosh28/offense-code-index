# Production release checklist

- Operator legal identity and monitored legal/privacy/security/accessibility/corrections contacts are published.
- Counsel, source-rights, content, accessibility, and security/privacy approvals reference the exact artifact.
- Source artifact bytes match the approved SHA-256; corpus contains exactly 953 unique records with valid page targets.
- Trust pages and security.txt contain no draft or placeholder language and publish approved contacts.
- Independent WCAG 2.2 AA audit and accurate ACR/VPAT are complete with no unresolved A/AA failures.
- Threat model, data flow, SBOM, headers, no-egress checks, artifact checksums, search benchmark, and rollback drill are reviewed.
- Hosting/subprocessor, log-content, retention, incident, DPA, and agency-hosting facts are approved.
- Production build gate passes; preview and production checksums match; previous approved application artifact remains available.
