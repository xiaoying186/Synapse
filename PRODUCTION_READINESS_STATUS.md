# Synapse V6.5 Production Readiness Status

Last updated: 2026-06-27

## Verified In This Workspace

- Static V6.5 preflight passes with `npm.cmd run preflight:static`.
- UI smoke guard passes with `npm.cmd run smoke:ui`; Node Playwright is not
  installed, but Python Playwright can capture desktop and mobile screenshots
  when browser launch is allowed.
- UI smoke now verifies Library Home and Production Readiness anchors before
  capturing desktop and mobile screenshots.
- GitHub release preflight exists as `npm.cmd run preflight:release` and
  currently blocks on the empty `.git` directory and missing local WiX tooling
  for MSI packaging.
- Release preflight also supports machine-readable diagnostics with
  `npm.cmd run preflight:release:json`.
- Release signing, hashing, and distribution notes are documented in
  `RELEASE_DISTRIBUTION_NOTES.md`.
- Static and full preflight now verify the release distribution notes include
  signing, SHA-256 hash, and V6.5 claim-boundary guidance.
- Static and release preflight now verify the README keeps GitHub readiness,
  release evidence, and V6.5 claim-boundary guidance visible before publishing.
- Static and full preflight now verify the GitHub Actions `V6.5 Local Baseline`
  workflow remains present with static, smoke, and full local preflight gates.
- GitHub Actions now also generates release evidence/status/doctor diagnostics
  and uploads `synapse-v65-release-evidence` plus `synapse-v65-ui-smoke`
  artifacts without publishing or signing a release.
- `.gitattributes` now normalizes text line endings and marks design docs,
  screenshots, databases, archives, installers, and executables as binary before
  GitHub publication.
- Agent Harness now creates a pre-execution rollback snapshot, filters
  credential-like environment variables before launching Codex, keeps execution
  in a read-only workspace boundary, and records post-execution review checks on
  quarantined output.
- Context Budget now preserves a source SHA-256 manifest, evidence state, and
  sensitive-marker review signals so compression cannot erase provenance or
  risk cues before model use.
- Computer Diagnostics now includes a V6.5 System Profile Reader context
  snapshot with non-sensitive OS/architecture/runtime availability fields,
  explicit denied fields, and review-before-memory persistence policy.
- Web App Shell now has a manual, isolated, preview-only surface with built-in
  descriptors, denied automation actions, and no process start, login,
  submission, publishing, trading, page-content reading, or session export.
- Codebase Memory now has a CodeGraph structural adapter preview that surfaces
  index/rule availability without command execution, repository-wide scanning,
  raw file ingestion, automatic L2 writes, or index rebuild.
- Permission Memory now has a candidate-only preview for reusable approval
  records with scope/tool/level/action/expiry/revocation/audit fields and
  explicit high-risk non-reuse boundaries.
- Library Home now surfaces recoverability policy for backup/recycle entries:
  backup index is read-only, restore goes to a temporary recovery area first,
  and cleanup, permanent delete, or original-location restore require review
  and audit.
- Static and full preflight now report missing protected release files as
  readable failures with remediation instead of crashing.
- Static and full preflight now require `package-lock.json`,
  `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` so GitHub CI dependency
  resolution remains reproducible.
- Static and full preflight now verify the pinned Tauri npm/Rust crate baseline:
  `@tauri-apps/api` 2.10.1, `tauri` =2.10.3, and `tauri-build` =2.5.6.
- Full preflight and GitHub baseline CI now include `cargo fmt --check`.
- `npm.cmd run release:evidence` generates local JSON/Markdown release evidence
  under `.tmp/release-evidence/` while preserving non-zero exit status for
  unresolved release blockers.
- Release evidence now includes a documentation-boundary section for release
  checklist, distribution notes, README, and the V6.5 alignment matrix.
- Release evidence now also writes `.tmp/release-evidence/release-summary.md`
  with the current release state, blockers, safe public claim, non-claims, and
  required next actions.
- Release evidence now labels MSI artifacts as release or debug and the release
  summary warns that debug MSI rehearsal artifacts must not be distributed as
  formal releases.
- Release evidence JSON now includes a top-level `release_review` object with
  machine-readable release state, blockers, and MSI artifact readiness.
- Release evidence JSON now includes `schema_version: 1`, and `release:status`
  rejects unsupported or missing evidence schema versions.
- Release evidence Markdown summaries now display the evidence schema version
  for manual release review.
- `npm.cmd run release:status` now prints the latest `release_review` decision,
  blockers, and MSI artifact readiness from generated evidence.
- `npm.cmd run release:status -- --json` exposes the same release decision for
  automation while preserving non-zero exit status when blockers remain.
- `npm.cmd run release:status` now detects stale release evidence when
  release-relevant source, configuration, or documentation files are newer than
  `.tmp/release-evidence/release-evidence.json`.
- `npm.cmd run release:doctor` now provides a read-only release readiness
  summary across Git, WiX, static preflight, release preflight, and current
  evidence/status checks without regenerating evidence.
- `npm.cmd run release:doctor -- --json` now provides the same read-only doctor
  decision as machine-readable output for CI or release scripts.
- Production Readiness now reads `.tmp/release-evidence/release-evidence.json`
  in-app and reports missing, stale, blocked, or ready release evidence without
  executing release scripts or mutating external state.
- Static and release preflight now protect the release evidence script itself so
  blocker, documentation-boundary, and claim-boundary summaries cannot drift
  silently.
- Static and release preflight now also verify that the release checklist and
  distribution notes require review of `.tmp/release-evidence/release-summary.md`.
- `V65_ALIGNMENT_MATRIX.md` now maps the machine-readable `release:status`
  command and JSON output to the V6.5 release evidence surface.
- The latest release evidence run recorded the current release blockers and a
  SHA-256 hash for the existing debug MSI artifact and UI smoke screenshots,
  while still exiting non-zero because Git metadata and WiX tooling remain
  unresolved.
- Release evidence now embeds dry-run Git bootstrap output and WiX diagnosis
  output so external blockers have local remediation evidence.
- Full V6.5 preflight passes with `npm.cmd run preflight`.
- Tauri debug application build passes, but MSI bundling currently needs WiX
  installed or pre-cached because network download timed out in this workspace.
- Tauri CSP is configured and checked by preflight.
- Tauri Windows local bundle target is MSI.
- External delivery, Agent execution, and relay upload are disabled by default.
- Feishu and WeChat webhook URLs are empty by default.
- Library Home exposes read-only memory, task artifact, snapshot, recycle, audit,
  and Saga transaction projections.
- Production Readiness preview checks V6.5 local-first gates.
- Production Readiness preview also reports read-only release environment gates
  for Git repository shape and Windows MSI WiX tooling.
- Production Readiness release environment gates now include remediation text so
  the app mirrors the CLI release doctor fix guidance.
- Saga Recovery preview exposes active, compensating, and failed transactions as
  read-only manual recovery review items.
- Saga Recovery can record audit-only manual review receipts without changing
  Saga state.
- Saga Recovery can mark a failed Saga as `resolved` only after an
  operator-provided external recovery note is recorded.
- Memory review and Zhishu rollback are tied to Saga state, snapshot, and audit
  traceability.
- Protected snapshot rollback, Task Direction active-state changes, and Arsenal
  allow-state changes now create Saga traces.
- Task Direction active-state changes now write explicit audit events carrying
  `saga_id`.
- Arsenal custom tool save/remove changes now create Saga traces, protected
  rollback snapshots, and carry `saga_id` in audit payloads.

## Guardrails And Release Boundaries

- Full release builds still need to be verified on the target release machine.
- Git repository metadata is currently an empty `.git` directory. This is now
  detected by `npm.cmd run git:diagnose` and `npm.cmd run preflight:release`.
- `npm.cmd run git:bootstrap` now provides a dry-run-first path for repairing
  only an empty `.git` directory; actual repair still requires
  `--repair-empty-git --yes`.
- Static and full preflight now verify the guarded Git bootstrap script remains
  present and keeps explicit repair guardrails.
- Static and full preflight now verify the WiX diagnosis script remains present
  and keeps release tooling guidance.
- Static and full preflight now verify `V65_ALIGNMENT_MATRIX.md` remains present
  and maps core V6.5 baseline requirements to evidence.
- Static and full preflight now enforce Feishu/WeChat preview-only delivery and
  Agent team blueprint-only execution guards.
- Static and full preflight now reject local env files, private keys, signing
  certificates, hardcoded secret assignments, and factory default credentials.
- Static and full preflight now enforce Local App Bridge launch-only guards:
  built-in/reviewed descriptors, explicit confirmation, no arguments, and no
  session or window-content extraction.
- Static and full preflight now enforce browser read-only automation and HTTP
  source quarantine gates: host allowlists, no credentials, no redirects, no
  browser write actions, bounded JSON responses, and review before Zhishu use.
- Static and full preflight now enforce local-first Device Sync and read-only
  Computer Diagnostics gates: hash-verified packages, import preview, explicit
  replace approval, relay dry-run only, and no system maintenance mutations.
- Static and full preflight now enforce store schema/migration guards: schema
  envelopes, legacy array reads, future-schema rejection, atomic file
  replacement, and one-time legacy Zhishu import into SQLite.
- Full preflight now protects the Windows Vite production build with an explicit
  relative `index.html` entry, avoiding absolute-drive HTML output names.
- MSI packaging currently stops at WiX acquisition; install WiX or pre-cache the
  Tauri WiX bundle before release packaging.
- `npm.cmd run wix:diagnose` now provides a non-network WiX tooling diagnosis
  path for the remaining MSI packaging blocker.
- Real Feishu/WeChat push, direct Agent execution, and one-click Agent teams are
  intentionally excluded from this V6.5 baseline.
- Browser, Agent, and local app flows remain guarded and should not be marketed
  as unrestricted automation.

## Remaining External Release Blockers

- Resolve the empty `.git` directory with an explicit operator action before
  publishing to GitHub.
- Install or pre-cache WiX before producing the Windows MSI on the release
  machine.
- Provide the actual release-machine signing certificate and timestamp service
  when distributing outside private local testing.
