# Changelog

Public software versions follow SemVer-style numbering.
Internal design document versions are not public release numbers.

## Unreleased

- Reduced the desktop initial JavaScript bundle by lazy-loading the heavy
  execution workspace panels for information aggregation, Agent Harness, Agent
  teams, notifications, and Daily Briefing. Library Home remains immediately
  available and navigation smoke coverage verifies asynchronous loading.

- Localized runtime capability-map identifiers, states, and guarded status
  details in Simplified Chinese mode; UI smoke now rejects the raw
  `memory-capture` identifier after a language switch.

- Strengthened Windows installer acceptance with a captured packaged-window
  screenshot rendered from the target window handle and a nonblank visual check
  before uninstall; the machine-readable smoke receipt now records screenshot
  dimensions and sampled color evidence.

- Hardened release freshness gates: release evidence now compares every
  distributable installer against the bundled frontend/Rust build inputs, so a
  newly generated evidence file cannot approve an older package after source
  changes.

- Added a two-step low-risk runtime settings editor for mode, local data directory, and scheduler cadence. It validates values, preserves unrelated local configuration, synchronizes a `.bak` copy before atomically replacing the active file, and requires restart-aware confirmation.

- Settings now show the active runtime configuration source and local data root as read-only diagnostics for installed-app troubleshooting.

- Windows installer smoke now verifies first-launch AppData configuration-template creation and its guarded execution defaults before uninstalling the preview package.

- On first installed-app launch, Synapse now creates a local AppData configuration template with guarded defaults and preserves user edits on later starts.

- Installed desktop builds now load an optional AppData `synapse.config.toml` as the process-wide runtime configuration source, keeping later safety, scheduler, and storage reads consistent with startup.

- Installed desktop builds now initialize the local store under the current user's AppData before the scheduler starts, avoiding writes to the build-time workspace path. Development and test fallbacks remain isolated and local.

- Activated `[storage].data_dir` for the local store. Synapse now accepts only non-empty project-relative locations, preserves `.synapse` as the default, and rejects absolute or parent-traversal paths.

- Added an isolated loopback acceptance path for approved Data Source Registry health checks. The path now verifies reviewed enablement, bounded credential-free JSON retrieval, quarantined observation persistence, audit, snapshot, and committed Saga without touching local user data.
- Registered `source-registry-health` as a protected snapshot object type so approved health checks can complete their recovery evidence chain.

- Distinguished unsigned preview release evidence from signed production review: release status now reports an explicit distribution tier, and Production Readiness keeps unsigned previews review-required.

- Strengthened Windows installer smoke evidence: packaged Synapse must now create a main window within five seconds, and the verified window handle/title are recorded before uninstall.
- Release evidence now rejects stale installer smoke records that do not prove main-window creation.

- Hardened real Agent team finalization: a final audit or Saga-commit failure now removes only the provisional team summary receipt, while preserving quarantined per-step evidence for review.

- Added Agent Harness transaction acceptance to both public CI and manual release workflows, including static guards for direct Codex execution compensation.

- Hardened direct guarded Codex execution: quarantined output, Task Run completion, domain audit, and final Saga commit now compensate together, removing provisional output and restoring the prior run after later persistence failure.

- Hardened Daily Briefing delivery review: only archived reviewable briefing artifacts tied to succeeded, approved Task Runs can produce a preview, and the review remains network-free and Zhishu-write-free.

- Hardened Data Source Registry health checks: a final Saga commit failure now removes the provisional quarantined observation, with direct failure-injection coverage.

- Added temporary SQLite fault injection for Device Sync import compensation: a locked Zhishu rollback is reported while device-state restoration still runs, preventing a partial rollback from being misrepresented as success.

- Hardened Browser Automation inspection persistence: a task-completion failure now compensates the provisional quarantined artifact, with failure-path coverage.

- Allowed Notification Gateway previews for successfully completed, previously approved task runs while retaining rejection for failed, cancelled, and unapproved runs; no delivery action is started by this change.

- Added a read-only Daily Briefing scheduled archive-review queue: approved scheduler ticks are surfaced for manual review, while automatic archive, network fetch, delivery, and Zhishu admission remain denied.

- Added Daily Briefing post-fetch persistence-failure coverage: a failed live-source artifact write now has a direct proof that quarantined observations are compensated before the error returns.

- Hardened Provider receipt final Saga commits: review queues, task artifacts, and Zhishu candidates now restore their pre-write state when final commit fails, while retaining auditable compensated Saga evidence.

- Fixed Windows release signature verification to pass installer paths through a process-local environment variable, correctly reporting `NotSigned` instead of a PowerShell path parsing error.

- Hardened Provider receipt review-queue staging: an audit persistence failure restores the pre-write candidate queue instead of leaving an unaudited entry.

- Hardened Provider task-artifact staging: candidate state and isolated artifact storage are restored together when the post-write audit cannot persist.

- Hardened Provider artifact Zhishu candidate admission: an audit persistence failure now restores the pre-write memory set, preventing an unaudited candidate from remaining in Zhishu.

- Added failure-injection coverage for Taiheng Task Direction activation: audit-write and Saga-commit failures now have direct tests proving the previous direction state is compensated.

- Added durable Source Registry health-state projection so refreshed registry entries expose the most recent quarantined health check without surfacing raw source content.

- Bound configured HTTP responses to their registered source identity: a response that declares a different `source_id` is rejected before quarantine persistence or downstream admission.

- Hardened approved Daily Briefing live-source fetches with write-ahead Saga, Snapshot, and network-intent audit records; post-fetch persistence failures now remove new quarantined observations and receipt artifacts before marking the transaction failed.

- Added a Taiheng-governed Source Registry health-check lifecycle: exact configured ID/URL mapping, reviewed enablement, explicit two-step approval, bounded read-only HTTP, quarantined observations, audit evidence, snapshots, and Saga failure handling.

- Hardened Local App Bridge launch persistence: successful launches expose artifact and audit receipts, while post-spawn artifact or audit failures terminate the child process and roll back provisional artifacts.
- Added a durable production webhook delivery-attempt journal that reserves idempotency keys before network access, blocks duplicate sends, records provider acceptance before local receipt persistence, and requires manual reconciliation after uncertain outcomes.
- Added a Taiheng delivery reconciliation center with snapshot, audit, and Saga-protected delivered/not-delivered decisions; only confirmed non-delivery releases an idempotency key for controlled retry.
- Hardened real Agent team execution with asynchronous worker isolation, active operator cancellation tokens, child-process cancellation checks, and partial execution receipts that preserve quarantined step evidence after failures.
- Added write-ahead Saga and Task Run snapshot protection for real Agent teams, with domain-owned audit receipts and commit only after quarantined outputs and the final team artifact are durable.
- Added Windows process integration tests proving descendant process-tree termination and timeout cleanup for guarded Agent execution.
- Added the first guarded Skill Library executor: a hash-locked, read-only system inventory PowerShell adapter with independent safety gate, Task Run approval, timeout, quarantine artifact, snapshot, audit, and Saga receipt.

### Added

- Added transactional Data Source Registry enablement reviews with explicit UI
  confirmation, Taiheng snapshot/audit/Saga receipts, and compensation when a
  later approval write fails.
- Added compensatable Daily Briefing archives for approved Task Runs. Archive
  receipts now expose recorded observations, artifact, snapshot, audit event,
  and Saga state while automatic delivery and durable Zhishu admission remain
  blocked.
- Added changelog-driven GitHub Release notes for the manual release workflow.
- Added mandatory Windows installer code signing to the manual release workflow
  before SHA-256 checksum generation and asset upload.
- Added the Cognitive IDE layout with Knowledge, Thinking, and Execution views,
  a left knowledge tree, right context rail, and bottom system monitor / CLI
  activity stream.
- Added a Xingtai task-loop acceptance verifier covering direction request,
  approval, local execution, artifact indexing, candidate review, and L1 memory
  admission.
- Surfaced the Xingtai task-loop acceptance state in Production Readiness.
- Added Rust task-loop and Production Readiness checks to public baseline and
  manual release GitHub Actions.
- Added a Settings panel for runtime mode, sandbox, step budget, config
  warnings, and core safety gate states.
- Added UI-driven Xingtai task-loop smoke coverage with a smoke-only Tauri
  invoke mock.
- Tightened manual release ordering so version metadata is synchronized before
  frontend bundling, and expanded installer smoke evidence for Start menu
  shortcut validation.
- Upgraded release evidence/status from MSI-only checks to Windows installer
  readiness covering NSIS, MSI, SHA-256 sidecars, and verified installer smoke.
- Added Zhishu retrieval acceptance for reviewed L2 memory admission, filtered
  search, and UI smoke coverage for capture -> review -> retrieval.
- Added scheduled Xingtai task-loop acceptance for scheduler tick -> approval
  -> local execution -> artifact -> reviewed memory admission, with UI smoke
  coverage for scheduled run feedback.
- Added guarded Feishu/WeChat notification mock receipt acceptance and UI smoke
  coverage, keeping external delivery disabled while recording auditable
  dry-run artifacts.
- Added a visible Feishu/WeChat webhook staging policy contract for signature,
  retry, redaction, error-classification, and external-delivery gates before any
  real webhook adapter can be claimed.
- Added a hashed Feishu/WeChat webhook staging request envelope with idempotency,
  required headers, destination redaction, and no-network/no-external-delivery
  assertions.
- Added notification preview audit evidence for webhook staging policy and
  staging envelope metadata while keeping webhook secrets and external delivery
  out of the audit trail.
- Added a Feishu/WeChat webhook staging preflight that requires loopback-only
  staging endpoints, signature material, explicit external-delivery gates, and
  no network activity during preflight.
- Extended release evidence and freshness checks to cover notification staging
  contracts, UI panels, mocks, and dynamic localization before release claims.
- Added a signed loopback-only Feishu/WeChat staging webhook delivery adapter
  with explicit approval, redacted endpoint evidence, idempotency headers, and
  no secret persistence or public webhook delivery.
- Added a real Agent team staging receipt that freezes per-step preflight
  blockers and input hashes into quarantine-only artifacts without starting
  agent processes or sending task content.
- Added a guarded real Agent team preflight contract that evaluates every team
  step through the Agent Harness gates without spawning processes or sending
  task content.
- Added Chinese terminology acceptance checks for the four Synapse centers and
  dynamic UI text so localization regressions are caught by `i18n:check`.
- Restored strict browser UI smoke on Windows by falling back to installed
  Microsoft Edge when Playwright's bundled Chromium is unavailable, and fixed
  the Xingtai direction layout so Push/channel controls remain clickable.
- Added a computer assistant safe-cleanup dry-run preview with denied actions,
  restore-point/approval requirements, and no deletion or mutation.
- Expanded Simplified Chinese dynamic UI coverage for Library Home acceptance
  regions, four-center navigation feedback, and computer assistant archive /
  cleanup review actions.
- Extracted computer diagnostics preview, cleanup dry-run, and archive state
  from `App.tsx` into a focused UI hook.
- Added a guarded Skill Library preview for versioned reusable skills and script
  adapters, with execution contracts that block process start, script-content
  reads, and durable Zhishu writes by default.
- Added a Daily Briefing evidence contract that surfaces source count,
  quarantine state, cross-check requirements, and blocked automatic delivery /
  Zhishu admission before archive.
- Tightened the Data Source Registry contract with explicit verification and
  quarantine policies for every registered source.
- Added a Browser Automation action policy contract that keeps write actions
  denied by default and documents approval, anti-injection, audit, quarantine,
  and rollback requirements.

## 0.0.1 - Guarded Manual Release Workflow

### Added

- Added repository collaboration baselines for Codex task tracking, Synapse
  fusion tracking, public design notes, and branch/PR workflow guidance.
- Added a read-only Secret Guard scanner and connected it to static preflight.
- Added Agent Harness dry-run previews for repository trust and command safety
  classification.
- Added redacted remote-origin metadata to Agent Harness repository trust
  previews.
- Added disabled Project Radar source descriptors for GitHub Trending,
  OSSInsight, and Hugging Face Trending inside the Data Source Registry preview.
- Added a public Baigong module manifest template for future guarded tools,
  Agents, automation adapters, and data-source connectors.
- Surfaced Secret Guard and Agent repository trust in Production Readiness and
  Security Center capability evidence.
- Added UI smoke coverage for English/Simplified Chinese language switching,
  including persisted language mode and `document.documentElement.lang`.
- Extracted Production Overview preview state and refresh operations from
  `App.tsx` into a focused hook without changing UI behavior.
- Extracted Data Source Registry preview state and refresh operation from
  `App.tsx` into a focused hook, and updated static preflight anchors.
- Extracted Web App Shell, Codebase Memory, and Permission Memory preview state
  and operations from `App.tsx` into a focused hook.
- Added a guarded manual GitHub release workflow for versioned Windows
  installer releases with SHA-256 files.
- Renamed the manual release workflow to `.github/workflows/manual-release.yml`,
  toned down installer availability claims, added Rust check to public baseline
  CI, and removed the obsolete V65 workflow file.

### Changed

- Expanded project agent rules to cover Synapse terminology, bilingual UI copy,
  Git collaboration expectations, and public repository boundaries.
- Repaired internal/private document ignore patterns that had become mojibake.

## 0.0.0 - Initial Public Baseline

- Established Synapse as a local-first guarded desktop prototype.
- Separated public software versioning from internal design alignment.
- Added public safety boundaries, release preflight, release evidence, and UI
  smoke checks.
- Added Taiheng, Zhishu, Xingtai, and Baigong public architecture language.
- Added preview-only Data Source Registry governance.
- Added public repository governance files and issue/PR templates.
- Documented that unrestricted Agent execution, automatic Feishu/WeChat
  delivery, browser write automation, automatic cleanup, automatic L2 writes,
  and cloud sync as a source of truth are not included in this baseline.
