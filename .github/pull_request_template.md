# Summary

Describe the change and why it is needed.

## Boundary Check

- [ ] Does not enable external delivery by default.
- [ ] Does not enable unrestricted Agent execution.
- [ ] Does not add browser write automation, form submission, downloads, uploads, or arbitrary scripts without guardrails.
- [ ] Does not add local file deletion, registry writes, system setting changes, or cleanup automation without review gates.
- [ ] Does not add automatic durable L2 writes without explicit review.
- [ ] Does not treat cloud sync as a source of truth.
- [ ] Does not commit secrets, credentials, private workflows, internal design docs, or local data.
- [ ] Updates `docs/CLAIM_BOUNDARIES.md` if public capability claims changed.

## Verification

List the smallest relevant checks:

```text
npm.cmd run preflight:static
```
