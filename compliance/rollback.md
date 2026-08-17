# Release and rollback procedure

Application and corpus versions are independent release dimensions.

- Promote only the exact checksummed artifact approved by counsel, content, accessibility, security, and privacy owners.
- An application-only rollback may repoint hosting to a prior approved application artifact only when it remains compatible with the latest approved corpus checksum.
- A corpus rollback requires written content-owner approval and a new release manifest. It must never occur as an incidental frontend rollback.
- If source rights, affiliation, query privacy, corpus accuracy, or a critical accessibility/security issue is disputed, set corpus status to `disabled` and deploy the source-status page rather than restore known-questionable content.
- Preserve the previous approved application artifact, the latest approved corpus, release checksums, approvals, and smoke-test results.
