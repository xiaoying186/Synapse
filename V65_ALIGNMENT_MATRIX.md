# Synapse V6.5 Alignment Matrix

This matrix maps the guarded V6.5 local-first baseline to concrete evidence in
the current repository. It is a review aid, not a claim that external release
blockers are resolved.

## Baseline Scope

| Requirement | Current alignment | Evidence |
| --- | --- | --- |
| Local-first operation | External delivery, Agent execution, and relay upload are disabled by default. | `synapse.config.toml`; `npm.cmd run preflight:static`; Production Readiness panel |
| Guarded release posture | Release preflight blocks GitHub/MSI release when Git metadata or WiX tooling is not ready. | `npm.cmd run preflight:release`; `npm.cmd run preflight:release:json` |
| Reproducible dependency resolution | npm and Rust lockfiles are required by static preflight and GitHub CI uses `npm ci`. | `package-lock.json`; `src-tauri/Cargo.lock`; `.github/workflows/v65-local-baseline.yml` |
| CI evidence artifacts | GitHub CI keeps release evidence and UI smoke artifacts for review without publishing, signing, or bypassing release blockers. | `.github/workflows/v65-local-baseline.yml`; `synapse-v65-release-evidence`; `synapse-v65-ui-smoke`; `npm.cmd run preflight:static` |
| Tauri version consistency | npm API, Rust `tauri`, and `tauri-build` are pinned and checked together. | `package.json`; `src-tauri/Cargo.toml`; `npm.cmd run preflight:static` |
| UI smoke production anchors | UI smoke verifies core workbench anchors, Library Home, Production Readiness, and captures desktop/mobile screenshots when Playwright can launch. | `npm.cmd run smoke:ui`; `.tmp/ui-smoke/desktop.png`; `.tmp/ui-smoke/mobile.png` |
| Release evidence | Release evidence records preflight results, blockers, MSI hashes, screenshot hashes, and Git/WiX diagnostics. | `npm.cmd run release:evidence`; `.tmp/release-evidence/release-evidence.md` |
| Machine-readable release status | Release status reads generated evidence and reports ready state, blockers, and MSI artifact readiness for humans or automation. | `npm.cmd run release:status`; `npm.cmd run release:status -- --json`; `.tmp/release-evidence/release-evidence.json` |
| Read-only release doctor | Release doctor summarizes Git, WiX, static preflight, release preflight, and current evidence/status checks without repairing, generating evidence, or publishing. | `npm.cmd run release:doctor`; `npm.cmd run release:doctor -- --json`; `scripts/release-doctor.mjs` |
| In-app release evidence gate | Production Readiness reads current release evidence and surfaces missing, stale, blocked, or ready evidence without executing scripts. | `src-tauri/src/domains/production_readiness.rs`; `.tmp/release-evidence/release-evidence.json`; `npm.cmd run preflight:static` |
| GitHub-facing documentation boundary | README keeps GitHub readiness, release evidence, local production baseline, and V6.5 claim boundaries visible before publishing. | `README.md`; `npm.cmd run preflight:static` |
| Push metadata only | Task Center can store push preferences and notification previews, but Feishu/WeChat do not start delivery in this baseline. | `src-tauri/src/domains/notification_gateway.rs`; `synapse.config.toml`; `npm.cmd run preflight:static` |
| Agent team blueprint preview | Multi-agent teams can generate bounded orchestration blueprints, but no Agent process is started. | `src-tauri/src/domains/agent_team.rs`; `src/components/AgentTeamPanel.tsx`; `npm.cmd run preflight:static` |
| Agent Harness safety gateway | Real Codex execution remains explicitly approved, read-only, credential-filtered, snapshot-backed, output-quarantined, and review-gated before reuse. | `src-tauri/src/domains/agent_harness.rs`; `cargo test domains::agent_harness --offline --quiet`; `npm.cmd run preflight:static` |
| Secret-free release tree | Local env files, private keys, signing certificates, hardcoded secrets, and factory default credentials are blocked by static preflight. | `.gitignore`; `scripts/production-preflight.mjs`; `npm.cmd run preflight:static` |
| GitHub repository hygiene | Text files are normalized for Windows/GitHub Actions and binary release/design artifacts are protected from text conversion. | `.gitattributes`; `npm.cmd run preflight:static` |
| Local app launch-only bridge | Local app integration is limited to built-in/reviewed descriptors, explicit confirmation, no arguments, and no session or window-content extraction. | `src-tauri/src/domains/local_app_bridge.rs`; `src/App.tsx`; `npm.cmd run preflight:static` |
| Browser read-only automation | Browser automation is limited to allowlisted hosts, navigation/read/screenshot capture, redirect host revalidation, no downloads, and quarantined output. | `src-tauri/src/domains/browser_automation.rs`; `src-tauri/scripts/browser_readonly.py`; `npm.cmd run preflight:static` |
| Web App Shell manual preview | Web App Shell exposes only built-in/reviewed manual isolated profiles and denies auto-login, submit, send, publish, trade, sensitive page reads, and session export. | `src-tauri/src/domains/web_app_shell.rs`; `src/components/WebAppShellPanel.tsx`; `cargo test domains::web_app_shell --offline --quiet`; `npm.cmd run preflight:static` |
| Codebase Memory structural adapter | Codebase Memory exposes CodeGraph index and project rule availability as a read-only structural preview with no command execution, repository-wide scan, raw file ingest, automatic L2 write, or index rebuild. | `src-tauri/src/domains/codebase_memory.rs`; `src/components/CodebaseMemoryPanel.tsx`; `cargo test domains::codebase_memory --offline --quiet`; `npm.cmd run preflight:static` |
| Permission Memory candidate preview | Permission Memory models reusable approval candidates with scope, tool range, permission level, action pattern, expiry, revocation, audit reference, and high-risk non-reuse boundaries without auto-granting policy permissions. | `src-tauri/src/domains/permission_memory.rs`; `src/components/PermissionMemoryPanel.tsx`; `cargo test domains::permission_memory --offline --quiet`; `npm.cmd run preflight:static` |
| HTTP source quarantine | Information aggregation accepts only configured JSON sources, rejects credentials and redirects, bounds response size, and quarantines observations before review. | `src-tauri/src/http_source.rs`; `npm.cmd run preflight:static` |
| Device sync local-first relay preview | Device sync uses local packages with SHA-256 integrity, import preview, explicit replace approval, and relay dry-run only. | `src-tauri/src/domains/device_sync.rs`; `src/components/DeviceSyncPanel.tsx`; `npm.cmd run preflight:static` |
| Computer diagnostics read-only | Computer diagnostics expose read-only reports and approved-run archival without process launch, deletion, registry write, or system setting changes. | `src-tauri/src/domains/computer_diagnostics.rs`; `npm.cmd run preflight:static` |
| System Profile Reader context snapshot | System Profile Reader captures only non-sensitive local environment facts and denies account, file content, browser, network identity, token, cookie, API key, and serial data by policy. | `src-tauri/src/domains/computer_diagnostics.rs`; `src/components/ComputerDiagnosticsPanel.tsx`; `cargo test domains::computer_diagnostics --offline --quiet`; `npm.cmd run preflight:static` |
| Context Budget evidence preservation | Context Budget records source SHA-256, evidence state, missing-evidence review, and sensitive-marker review before model-call packaging. | `src-tauri/src/domains/context_budget.rs`; `src/components/ContextBudgetPanel.tsx`; `cargo test domains::context_budget --offline --quiet`; `npm.cmd run preflight:static` |
| Store schema migration guard | Store files use schema envelopes, can read legacy arrays, reject future schemas, replace files atomically, and migrate legacy Zhishu JSON into SQLite once. | `src-tauri/src/store/mod.rs`; `src-tauri/src/store/repository.rs`; `npm.cmd run preflight:static` |

## Safety Boundaries

| Boundary | Current alignment | Evidence |
| --- | --- | --- |
| No direct general Agent execution claim | Agent teams remain preview/guarded; real one-click teams are not claimed for this baseline. | `PRODUCTION_RELEASE_CHECKLIST.md`; `RELEASE_DISTRIBUTION_NOTES.md`; Agent Team panel |
| No automatic Feishu/WeChat delivery | Webhook URLs are empty by default and Feishu/WeChat remain preview-only. | `synapse.config.toml`; `npm.cmd run preflight:static` |
| No automatic L2 writes | Promotion and admission paths remain review-gated. | README capability boundaries; Production Readiness gates |
| No browser write automation | Browser automation cannot click, submit forms, upload, download, or accept redirected hosts outside the allowlist. | `npm.cmd run preflight:static`; Production Readiness panel |
| No automatic cleanup/system deletion | Computer diagnostics remain read-only; cleanup is not marketed as shipped automation. | README capability boundaries; `RELEASE_DISTRIBUTION_NOTES.md` |
| No committed secrets or default credentials | Credentials remain environment-only or external to the repository; factory default credentials are not allowed in source/config/docs. | `npm.cmd run preflight:static`; `PRODUCTION_RELEASE_CHECKLIST.md` |
| No arbitrary local app control | Local App Bridge cannot accept a user-supplied executable or read existing application content/session state in this baseline. | `npm.cmd run preflight:static`; Production Readiness panel |
| No unreviewed web-source admission | HTTP source output remains quarantined and must pass review before any durable Zhishu admission. | `npm.cmd run preflight:static`; Production Readiness panel |
| No automatic cloud sync | Device relay remains preview-only; relay token is environment-only and no network upload starts in this baseline. | `npm.cmd run preflight:static`; Production Readiness panel |
| No automatic system maintenance | Computer diagnostics cannot delete files, write registry values, launch repair tools, or change system settings. | `npm.cmd run preflight:static`; Production Readiness panel |

## State Integrity

| Requirement | Current alignment | Evidence |
| --- | --- | --- |
| Store/snapshot/audit/Saga traceability | Protected rollback, Task Direction state changes, Arsenal allow-state, and custom tool registry changes have Saga/audit/snapshot coverage. | `PRODUCTION_READINESS_STATUS.md`; `cargo test services::arsenal --offline --quiet`; `cargo test domains::saga_recovery --offline --quiet` |
| Library Home recoverability policy | Library Home exposes read-only backup/recycle policy, temporary recovery area first, and review/audit requirements before backup cleanup, permanent delete, or original-location restore. | `src-tauri/src/domains/library_home.rs`; `src/components/LibraryHomePanel.tsx`; `npm.cmd run preflight:static` |
| Manual Saga recovery | Failed Saga transactions can be reviewed, deferred, or marked resolved only with operator-provided external recovery notes. | Saga Recovery panel; `cargo test domains::saga_recovery --offline --quiet` |
| Release blockers are visible in-app | Production Readiness reports Git and WiX release environment gates with remediation text. | Production Readiness panel; `cargo test domains::production_readiness --offline --quiet` |
| Store schema migration remains test-backed | JSON envelope, legacy array read, future schema rejection, atomic replacement, and SQLite legacy import-once behavior have targeted tests. | `cargo test store --offline --quiet` |

## Release Blockers

| Blocker | Status | Evidence / next action |
| --- | --- | --- |
| Empty `.git` directory | Unresolved external operator action. | `npm.cmd run git:diagnose`; `npm.cmd run git:bootstrap`; run `npm.cmd run git:bootstrap -- --repair-empty-git --yes` only if no history must be preserved. |
| WiX tooling for MSI packaging | Unresolved release-machine dependency. | `npm.cmd run wix:diagnose`; install WiX v3/v4 or pre-cache Tauri's WiX bundle, then rerun `npm.cmd run preflight:release`. |
| Signing certificate and timestamp service | Not provided in repository by design. | `RELEASE_DISTRIBUTION_NOTES.md`; provide only in private release environment. |

## Verification Commands

Run these from the repository root:

```powershell
npm.cmd run preflight:static
npm.cmd run preflight
npm.cmd run smoke:ui
npm.cmd run preflight:release:json
npm.cmd run release:evidence
npm.cmd run release:status -- --json
npm.cmd run release:doctor
npm.cmd run release:doctor -- --json
```

Expected current result:

- `preflight:static`, `preflight`, and `smoke:ui` pass.
- `preflight:release:json` fails until `.git` and WiX are resolved.
- `release:evidence` writes evidence and exits non-zero while release blockers remain.
- `release:status -- --json` reports `ready: false` until `.git`, WiX, and a release MSI are ready.
- `release:doctor` and `release:doctor -- --json` exit non-zero while the same release blockers remain.
