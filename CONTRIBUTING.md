# Contributing

Synapse is currently in an early `0.0.0` public baseline stage. Issues and
small suggestions are welcome; large architectural changes should be discussed
first.

## Contribution Rules

- Do not submit secrets, credentials, private workflows, local data, or internal
  design documents.
- Keep external delivery, direct Agent execution, browser write automation,
  cloud sync, and automatic L2 writes disabled unless a change explicitly
  updates the security boundary and review gates.
- Prefer small pull requests with clear verification.
- Update `docs/CLAIM_BOUNDARIES.md` when a change affects public capability
  claims.
- Run the smallest relevant verification command before opening a PR.

## Useful Checks

```powershell
npm.cmd run preflight:static
npm.cmd run preflight
npm.cmd run smoke:ui
```
