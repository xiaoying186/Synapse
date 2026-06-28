# Synapse 0.0.0 Public Baseline Status

Public software version: `0.0.0`
Public stage: `Initial Public Baseline`
Internal design alignment: `Synapse Design V6.6`

Synapse `0.0.0` is an early local-first desktop baseline. It is suitable for
guarded local preview, development, and review of the project boundaries. It is
not a stable production automation release.

## Verified Public Baseline

- Public version metadata is aligned across `package.json`,
  `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
- Static preflight passes with `npm.cmd run preflight:static`.
- The frontend build, Tauri backend check, and UI smoke guard are part of the
  local verification path.
- External delivery, direct Agent execution, and relay upload are disabled by
  default.
- Feishu and WeChat adapters are preview-only.
- Browser automation is limited to read-only, allowlisted inspection.
- Local application integration is guarded and does not extract existing app
  session or window content.
- Data Source Registry is a lightweight governance preview only; it does not
  store credentials, run background polling, process heavy data, or fetch live
  sources.

## Not Included In This Baseline

- Unrestricted Agent execution.
- One-click real multi-Agent teams.
- Automatic Feishu or WeChat delivery.
- Browser write automation, form submission, uploads, downloads, purchases, or
  arbitrary scripts.
- Automatic C drive cleanup, system maintenance, registry edits, or file
  deletion.
- Automatic durable L2 knowledge admission without explicit review.
- Cloud synchronization as a source of truth.
- Public release signing or a verified installer distribution channel.

## Release State

- Windows MSI packaging is supported by the checked-in Tauri configuration, but
  release artifacts must be rebuilt after version or bundle metadata changes.
- Debug MSI artifacts must not be distributed as official releases.
- A public GitHub release should wait until `LICENSE`, `SECURITY.md`,
  `VERSIONING.md`, `docs/CAPABILITY_MATRIX.md`,
  `docs/CONFIG_CAPABILITY_MATRIX.md`, `docs/CLAIM_BOUNDARIES.md`, and
  `docs/RELEASE_CHECKLIST.md` are present and reviewed.
- Signing certificates, API keys, webhook URLs, relay tokens, personal
  workflows, and internal design documents must not be committed.

## Suggested Verification

```powershell
npm.cmd run preflight:static
npm.cmd run preflight
npm.cmd run smoke:ui
```

For release-machine checks:

```powershell
npm.cmd run preflight:release
npm.cmd run release:evidence
npm.cmd run release:status -- --json
```
