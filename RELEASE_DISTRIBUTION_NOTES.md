# Synapse V6.5 Release Distribution Notes

These notes describe the guarded Windows MSI release path for the V6.5
local-first baseline. They are intentionally conservative: do not use them to
claim unrestricted automation, external delivery, or production cloud readiness.

## Release Preconditions

- `npm.cmd run preflight` passes on the release machine.
- `npm.cmd run preflight:release` passes after Git metadata and WiX tooling are
  ready.
- `npm.cmd run smoke:ui` passes. If Playwright is available, keep the generated
  `.tmp/ui-smoke/desktop.png` and `.tmp/ui-smoke/mobile.png` as local release
  evidence.
- Production Readiness in the app has no unexplained blocked or
  release-blocked checks.
- Library Home shows no active, failed, or unresolved Saga transaction.
- `synapse.config.toml` keeps external delivery, Agent execution, and relay
  upload disabled unless this is an explicit private test build.

## Windows MSI Tooling

The checked-in bundle target is MSI. Before packaging on Windows, make sure one
of these is true:

- WiX v3 tools are on PATH: `candle.exe` and `light.exe`.
- WiX CLI is on PATH: `wix.exe`.
- Tauri's WiX bundle is already cached in the release environment.

Run the local diagnosis first:

```powershell
npm.cmd run wix:diagnose
```

If WiX is missing, Tauri may try to download `wix314-binaries.zip` during
bundling. That is not a reliable release process for an offline or restricted
machine.

## Build Command

Use the Tauri build script from the repository root:

```powershell
npm.cmd run tauri:build
```

For a debug packaging rehearsal:

```powershell
npm.cmd run tauri -- build --debug
```

Expected Windows MSI output lives under:

```text
src-tauri/target/release/bundle/msi/
src-tauri/target/debug/bundle/msi/
```

Only MSI files under `src-tauri/target/release/bundle/msi/` are release
distribution candidates. Debug MSI files under
`src-tauri/target/debug/bundle/msi/` are packaging rehearsals and must not be
shared as a formal release.

## Signing

The current repository does not include signing credentials or certificate
configuration. Before distributing outside a private local test:

- Use a trusted code-signing certificate owned by the operator or release
  organization.
- Keep signing certificates, passwords, tokens, and timestamp credentials out of
  Git and out of `.synapse/`.
- Sign the final MSI or configure Tauri signing in the release environment.
- Timestamp the signature so the installer remains verifiable after certificate
  expiry.
- Record the certificate subject, timestamp authority, and signed artifact path
  in private release notes.

Do not commit signing secrets or populated signing config.

## Artifact Verification

After building and signing, record hashes for every distributed artifact:

```powershell
Get-FileHash .\path\to\Synapse_*.msi -Algorithm SHA256
```

Keep the SHA-256 hash next to the release notes. For GitHub Releases, include
the hash in the release body so the downloaded MSI can be verified.

You can also generate a local release evidence bundle:

```powershell
npm.cmd run release:evidence
```

This writes `.tmp/release-evidence/release-evidence.json` and
`.tmp/release-evidence/release-evidence.md`, plus a compact
`.tmp/release-evidence/release-summary.md` for release review. The command exits
non-zero when release preflight still has blockers, but it keeps the generated
evidence so the blockers can be reviewed. When UI smoke screenshots exist under
`.tmp/ui-smoke/`, their SHA-256 hashes are included in the evidence bundle. The
evidence bundle also embeds the dry-run Git bootstrap and WiX diagnosis output.
MSI artifacts are labeled as release or debug so rehearsal installers are not
mistaken for distributable release artifacts.

For automation, read the top-level `release_review` object in
`.tmp/release-evidence/release-evidence.json`. It reports whether the snapshot is
ready for release review, the current release blockers, and MSI artifact
readiness. The JSON evidence also includes `schema_version` so automation can
reject unsupported evidence structures.

To print that decision in a compact CLI form:

```powershell
npm.cmd run release:status
npm.cmd run release:status -- --json
```

The status command also reports stale evidence. If it lists stale inputs, rerun
`npm.cmd run release:evidence` before using the release decision.

To run read-only release diagnostics against the current evidence in one pass:

```powershell
npm.cmd run release:doctor
npm.cmd run release:doctor -- --json
```

## GitHub Release Checklist

Before publishing a GitHub snapshot or release:

- `npm.cmd run git:diagnose` passes.
- If `.git` is an empty directory, preview `npm.cmd run git:bootstrap` and only
  run `npm.cmd run git:bootstrap -- --repair-empty-git --yes` when no previous
  history needs to be preserved.
- `npm.cmd run preflight:release` passes.
- The `V6.5 Local Baseline` GitHub Actions workflow passes after pushing. It
  verifies local baseline gates and does not replace MSI packaging or signing
  verification.
- `git status --short` contains only intentional source and documentation
  changes.
- `.synapse/`, `.codegraph/`, `dist/`, `target/`, local databases, logs, and
  generated MSI files are not committed.
- No webhook URLs, SMTP credentials, signing credentials, `.env` files, or local
  user data are committed.
- The V6.5 design document is included only if it is intended to be public.
- Release notes clearly say this is a guarded local-first baseline.

## Do Not Claim In This Baseline

- Direct CLI Agent execution as a general production feature.
- One-click real Agent team execution.
- Automatic Feishu or WeChat delivery.
- Browser write automation, form submission, purchases, or arbitrary scripts.
- Automatic C drive cleanup or system file deletion.
- Automatic L2 memory writes without explicit review.
- External/cloud synchronization beyond the local export/import and relay
  readiness preview.
