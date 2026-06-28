# Synapse

Current public version: `0.0.0`
Public stage: `Initial Public Baseline`
Internal design alignment: `Synapse Design V6.6`

Synapse is a Tauri + React desktop prototype for a local-first personal
cognitive kernel. Public software versions are intentionally separated from
internal design document versions: `0.0.0` is the public baseline version, while
`Synapse Design V6.6` is the internal architecture alignment target.

Synapse is organized around one governing core and three product centers:

- Taiheng / Governance Core: mode, permission, safety, recovery, release gates,
  audit, and cross-domain coordination
- Zhishu / Intelligence Hub: knowledge, memory, reusable skills, admission
  rules, experience, and project/user self-image material
- Xingtai / Action Desk: task directions, opportunity mining, scheduled output,
  execution previews, project progress, and Zhishu self-growth entry points
- Baigong / Arsenal: tools, agents, local automation, browser automation, data
  source registry, information aggregation, and module registry

Compatibility note: some code paths and local data files still use legacy
internal names such as `task_center`, Task Center, `arsenal`, and Arsenal. New
product-facing documentation should treat them as compatibility labels under
Xingtai and Baigong rather than as the primary structure.

The current build is intentionally conservative. It previews planning,
permission, memory, task, information, and tool-registry behavior without
executing external tools or fetching live network content.

## Current Capabilities

- Plan IR intake from the UI
- runtime configuration loading from `synapse.config.toml`
- rule-driven materialization into an executable plan preview
- context references across L0/L1/L2 memory scopes
- permission policy preview and driver-level dry-run enforcement
- policy preview classifies push, email, Feishu, and WeChat delivery requests
  as approval-gated external actions
- cognitive audit preview
- execution span preview
- recent decision trace in the workbench
- local Zhishu memory capture with admission metadata
- inspiration capture as low-friction L0 input
- manual Zhishu capture for knowledge, reference, rule, skill, skill-flow, and
  script-interface candidates
- manual Zhishu captures enter L2 as review candidates rather than accepted
  durable knowledge
- no-tag Zhishu knowledge, rule, skill, skill-flow, reference, and
  script-interface captures receive lightweight type tags for later association
- recent Zhishu items can be accepted or rejected from the workbench; accepted
  candidates become reviewed local records, rejected records are invalidated
- rejected Zhishu or memory records are excluded from Task Center candidate
  mining and synthesis association previews
- conservative local English keyword and Chinese domain-term tag extraction for
  sparsely tagged inspiration notes
- no-tag inspirations receive lightweight `idea` and `inspiration` tags so
  later association previews have a stable hook
- experience capture for success reuse and error avoidance
- plan previews surface matched accepted and reviewed success/avoidance
  experience records as context references without changing execution behavior
- experience context references distinguish Success and Avoidance hints for
  clearer reuse and error-path suppression
- push delivery capability status is preview-only; no delivery interface is
  executed
- Task Center directions, candidate generation, and candidate review
- Task Center candidate mining supports Chinese direction keywords and
  sparsely tagged Chinese inspiration notes
- Task Center direction enable/disable controls with inactive schedule previews
- inactive Task Center directions reject new run requests and local execution
- Task Center schedule preview records for manual, daily, weekly, and hourly
  custom directions
- Task Center schedule previews include preview-only push metadata before any
  real delivery integration exists
- custom schedule rules currently support hour and day intervals such as
  `custom:6h`, `custom:12h`, and `custom:2d`; legacy bare `custom` remains
  readable as an unconfigured placeholder
- Task Center schedule previews account for recent completed runs before
  showing readiness
- Task Center run request records that wait for approval before execution
- repeated Task Center run requests reuse the existing open direction run
- Task Center run approval/rejection actions that still do not start execution
- manual Task Center scheduler tick that records due run requests without
  background execution
- scheduler safety status showing that background loops remain disabled or
  configured-but-not-started
- scheduler safety gates include future push delivery when a run has push
  metadata enabled
- dry-run executor contract for approved Task Run records without invoking
  tools or jobs
- executor contract preview blocks otherwise-ready runs when their direction is
  inactive
- minimal local executor for approved local Task Run records that performs
  internal Task Center candidate mining only
- local executor support for approved candidate-deepening runs, deriving a new
  reviewed follow-up candidate from the source candidate
- deepened candidates keep explicit source-candidate lineage for review and UI
  tracing
- accepted deepened candidates preserve source-candidate lineage when promoted
  into reviewed L1 memory
- local Task Run execution receipts with generated candidate IDs and duplicate
  execution protection
- scheduler tick skips recently completed daily/weekly directions within the
  current interval
- scheduler tick can create the next run after a completed daily/weekly
  interval expires
- structured Task Candidate quality explanation with score components and
  memory evidence
- Task Candidate evidence includes the direction output-template preference
- Task Candidate evidence resolves `auto` output templates into a conservative
  candidate-level template hint
- auto output templates resolve skill, flow, script, and interface candidates
  toward checklist-style outputs
- Task Center directions can store one or more preview-only push preferences
  for Email, Feishu, or WeChat; no real push interface is executed yet
- Task Center run requests snapshot direction push preferences for future
  delivery gates
- minimum Task Candidate quality threshold to filter weak matches
- accepted Task Center candidates promoted into reviewed L1 memory
- accepted Task Center candidates preserve resolved output-template evidence in
  promoted memory content
- deepened Task Center candidates create local follow-up run requests that wait
  for approval
- repeated deepening of the same candidate reuses the existing open follow-up
  run instead of duplicating queue items
- reviewed summary and association previews for Zhishu synthesis
- Zhishu synthesis maintenance job previews for summary, association, and mined
  Task Candidate review queues
- Zhishu synthesis maintenance jobs expose admission gates before any self-growth
  write
- Zhishu synthesis maintenance jobs show preview cadence for summary,
  association, and Task Center review queues
- synthesis promotions return a review receipt with candidate kind, review
  state, admission gate, and written memory item
- manual promotion of reviewed synthesis summary/association candidates into
  L1 memory
- offline information aggregation preview with source trust gates
- delivery-channel requests such as push, email, Feishu, or WeChat are marked
  as policy-gated channels rather than evidence sources
- allowlisted, quarantined, and blocked source gate previews for future
  information retrieval
- retrieval dry-run contract explaining why real network calls remain blocked
- online retrieval contract gates include prompt-injection sanitization before
  quarantine, cross-check, or Zhishu admission
- aggregation preview flags instruction-bearing queries for manual security
  review before any future retrieval summary
- Arsenal registry preview for future agents, browser tools, scripts, Python
  tools, and local apps
- Arsenal registry entries expose capability tags for future filtering and
  policy mapping
- Arsenal registry entries show whether a tool is built-in or loaded from the
  custom tool file
- Arsenal includes blocked, not-configured placeholders for computer cleanup,
  computer troubleshooting, and local app bridge modules
- Arsenal includes blocked, not-configured placeholders for linear and
  roundtable agent team orchestration
- Arsenal PATH discovery preview for known local tool commands without
  invocation
- explicit Arsenal allowlist editing while tool execution remains disabled
- Arsenal allowlist preview downgrades previously allowed tools to blocked when
  the command is no longer detected
- frontend capability status panel showing available, dry-run, preview-only,
  and disabled features
- capability status includes Zhishu capture, experience-reuse, custom Arsenal
  tools, and Arsenal PATH discovery boundaries
- Security Center surface for recent audit evidence, guarded capabilities,
  high-risk trails, and Zhishu restore-point visibility

## Requirements

- Node.js and npm
- Rust stable MSVC toolchain on Windows
- WebView2 runtime

## Setup

```powershell
npm install
cd src-tauri
cargo fetch
```

If Cargo networking fails on Windows, check `src-tauri/.cargo/config.toml` and
your global Cargo configuration for stale `http.cainfo` entries. If Cargo can
download dependencies but `cargo check --offline` cannot resolve packages, run
`cargo fetch` once without `--offline` so the sparse index and crate archives
are cached locally.

The Tauri Rust crate is pinned to the same 2.10 minor line as
`@tauri-apps/api`. Upgrade the Rust crate, Cargo lockfile, and npm package
together to avoid Tauri's version-mismatch guard during `tauri dev`.

## Development

Run the web UI:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Run the desktop app:

```powershell
npm.cmd run tauri:dev
```

Build the desktop bundle:

```powershell
npm.cmd run tauri:build
```

The checked-in Tauri bundle target is MSI for the Windows local baseline. Add
NSIS, macOS, or Linux targets only when those release paths are ready to be
verified separately. On Windows, MSI packaging requires WiX tooling to be
installed on PATH or already cached for Tauri; otherwise Tauri may try to
download WiX during bundling.

Diagnose Windows MSI tooling without downloading anything:

```powershell
npm.cmd run wix:diagnose
```

Build the frontend:

```powershell
npm.cmd run build
```

Run the Synapse 0.0.0 public baseline production preflight:

```powershell
npm.cmd run preflight
```

The preflight is intentionally offline. It checks the default safety switches
in `synapse.config.toml`, verifies Feishu/WeChat remain preview-only, builds
the frontend, confirms the Tauri CSP is configured, and runs
`cargo check --offline` for the Tauri backend.

When you only need a fast static guard check without running build commands:

```powershell
npm.cmd run preflight:static
```

Before publishing to GitHub, run the release gate. It includes the static
public-baseline checks plus a non-destructive Git repository shape check:

```powershell
npm.cmd run preflight:release
```

For machine-readable release diagnostics:

```powershell
npm.cmd run preflight:release:json
```

After publishing to GitHub with a token that can update workflows, the
`Synapse 0.0.0 Public Baseline` workflow runs the guarded local baseline checks
on Windows. It intentionally does not package, sign, or publish an MSI.

To generate local release evidence under `.tmp/release-evidence/`:

```powershell
npm.cmd run release:evidence
```

The evidence command still writes JSON and Markdown summaries when release
blockers exist, then exits non-zero so blockers are not missed.

To print the latest machine-readable release decision from generated evidence:

```powershell
npm.cmd run release:status
npm.cmd run release:status -- --json
```

The status command returns non-zero when release evidence is stale, so rerun
`npm.cmd run release:evidence` after changing release-relevant source,
configuration, or documentation files.

To run the read-only release doctor that summarizes Git, WiX, preflight, and
existing evidence/status checks without regenerating evidence:

```powershell
npm.cmd run release:doctor
npm.cmd run release:doctor -- --json
```

Run the UI smoke guard:

```powershell
npm.cmd run smoke:ui
```

The smoke script always verifies key workbench source anchors. If Playwright is
available to Node, it also starts Vite and captures desktop/mobile screenshots
under `.tmp/ui-smoke/`; otherwise it reports a static-only pass.

Check the Rust side:

```powershell
cd src-tauri
cargo fmt --check
cargo check
cargo test
```

## Local Production Baseline

The Synapse 0.0.0 public baseline is local-first and guarded. Before treating a
local build as production-ready, keep these invariants true:

- `external_delivery_enabled = false`
- `agent_execution_enabled = false`
- `[sync.relay].enabled = false`
- Feishu and WeChat webhook URLs are empty unless you are explicitly testing
  preview/config detection
- the Production Readiness panel reports `ready-local` or only review items you
  intentionally accept
- the Production Readiness panel reports Git repository and WiX release
  environment blockers before publishing or MSI packaging
- Library Home shows no active or failed Saga transactions before risky work

Recommended local release check:

```powershell
npm.cmd run preflight
npm.cmd run tauri:dev
```

Inside the app, refresh Library Home and Production Readiness before performing
high-risk actions such as restore, import, or allowlist changes.
Production Readiness also reads the current release evidence and reports
missing, stale, blocked, or ready evidence without generating files or changing
Git/WiX state.

See `VERSIONING.md` for the public software version and internal design version
policy.
See `docs/CAPABILITY_MATRIX.md` for the truthful current capability status.
See `docs/CONFIG_CAPABILITY_MATRIX.md` for which `synapse.config.toml` fields are
active, preview, or reserved.
See `docs/SOURCE_REGISTRY.md` for the lightweight data source registry boundary.
See `docs/PUBLIC_BASELINE_STATUS.md` for the current public baseline status.
See `docs/CLAIM_BOUNDARIES.md` before changing public capability claims.
See `docs/RELEASE_DISTRIBUTION_NOTES.md` before signing, hashing, or sharing an
MSI outside private local testing.

## Do Not Claim In This Baseline

This repository currently represents a guarded local-first baseline. Do not
describe it as shipping unrestricted automation, real one-click Agent teams,
automatic Feishu or WeChat delivery, browser write automation, automatic system
cleanup, automatic L2 memory writes, or cloud synchronization as a source of
truth.

## Public Repository Policy

This repository is public, but Synapse is still an early public baseline:

- Issues are welcome for bugs, public feature requests, and security-boundary
  questions.
- Pull requests should stay small and pass the boundary checklist in
  `.github/pull_request_template.md`.
- Contribution expectations are documented in `CONTRIBUTING.md`.
- Do not submit secrets, webhook URLs, SMTP credentials, private workflows,
  generated local data, internal design documents, monetization plans, or local
  path notes.
- Security-sensitive reports should follow `SECURITY.md`.
- Public capability claims should match `docs/CLAIM_BOUNDARIES.md` and
  `docs/CAPABILITY_MATRIX.md`.

Before a release or public claim, run:

```powershell
npm.cmd run preflight:static
npm.cmd run preflight:release
npm.cmd run release:evidence
```

## Project Layout

```text
src/
  App.tsx              React workbench orchestration
  App.css              workbench styling
  types.ts             shared frontend types
  components/          focused workbench panels
src-tauri/
  src/aggregation/     offline information aggregation preview
  src/arsenal/         extension tool registry preview
  src/config/          runtime config loading and diagnostics
  src/domains/         Taiheng/Zhishu/Xingtai/Baigong preview domains
  src/kernel/          Plan IR and materialized Plan model
  src/rules/           hard constraint and route injection
  src/policy.rs        permission tier preview and dry-run gates
  src/context/         L0/L1/L2 context references
  src/audit/           cognitive audit preview
  src/execution/       execution span preview
  src/drivers/         Lite/Pro driver traits and placeholders
  src/store/           capped local JSON storage by domain
synapse.config.toml    runtime mode and policy configuration
ARCHITECTURE.md        architecture notes
ARCHITECTURE_REVIEW.md refactor timing and optimization notes
STRATEGIC_ROADMAP.md   long-range product direction
```

## Local Prototype Data

The app stores prototype state under `.synapse/`:

- `plan-history.json`: plan history
- `review-history.json`: review history
- `execution-queue.json`: execution queue preview records
- `memory-items.json`: Zhishu memory, inspiration, experience, and knowledge candidates
- `task-center-directions.json`: user-defined Task Center directions
- `task-center-candidates.json`: generated Task Center candidates
- `task-center-runs.json`: Task Center run requests waiting for approval
- `task-center-artifacts.json`: outputs indexed by Task Run
- `arsenal-allowlist.json`: explicit Arsenal allowlist state
- `arsenal-tools.json`: optional custom Arsenal tool descriptors
- `local-apps.json`: canonical local application allow decisions
- `device-sync-state.json`: local device identity and last sync hash metadata
- `snapshots.json`: protected-object baseline snapshots
- `audit-events.json`: durable state-change audit events
- `scheduler-state.json`: scheduler lease, heartbeat, and tick health
- `source-observations.json`: quarantined source confidence history
- `zhishu-relations.json`: reviewable relation candidates and accepted links
- `zhishu-maintenance-findings.json`: reviewable duplicate, stale, and conflict findings
- `synapse.db`: active SQLite repository for Zhishu collections

These files are local development data. The current implementation keeps them
small and JSON-readable so behavior can be inspected while the schema is still
settling. New writes use envelope schema v1 with `schema_version` and
`records`. Legacy array-only files, schema v0 envelopes, and envelopes without
an explicit schema version remain readable. Files with a schema version newer
than the running application are rejected instead of being interpreted with an
older model.

Zhishu memory, relations, and maintenance findings now use `synapse.db` as
their active repository. Existing JSON files are imported once and retained as
untouched migration sources. The workbench can export or transactionally
replace all three collections with a versioned JSON bundle.

Device sync currently builds on that Zhishu bundle. Exported packages include
the source device, base hash, content hash, and bundle payload; imports first
preview whether the package is already synchronized, a fast-forward, a conflict,
or an explicit replace. The optional relay setting only reports readiness and
never uploads in this stage.

Store writes use a same-directory temporary file, flush and sync its contents,
then replace the destination. A failed replacement removes the temporary file
and leaves the last valid store file unchanged.

Optional custom Arsenal tools can be added to `.synapse/arsenal-tools.json`.
They are preview-only and default to `blocked`; they can only be allowlisted
after one of their command candidates is detected on PATH.

The Arsenal panel also supports explicit draft validation, blocked-by-default
save, and audited removal for custom tools. Duplicate IDs are rejected.

```json
{
  "schema_version": 1,
  "records": [
    {
      "id": "custom-cleanup-helper",
      "label": "Custom cleanup helper",
      "category": "computer-assistant",
      "invocation_mode": "deep",
      "risk_level": "high",
      "ingestion_policy": "review-before-action",
      "capabilities": ["windows-maintenance", "cleanup-preview"],
      "command_candidates": ["cleanup-helper"]
    }
  ]
}
```

## Capability Boundaries

Implemented and available:

- local memory, inspiration, experience, Task Center direction, and candidate
  storage
- manual Zhishu knowledge, reference, rule, skill, skill-flow, and
  script-interface candidate capture
- manual Zhishu item accept/reject review
- unified Zhishu search across text, metadata, confidence, age, and admission state
- explained Zhishu search scores and matched fields
- reviewable Zhishu relation candidates stored outside original memory items
- reviewable Zhishu duplicate, stale, and conservative conflict findings without automatic mutation
- Context Budget package previews with source SHA-256 manifests, missing-evidence review,
  sensitive-marker review signals, and preserved evidence references before model use
- daily briefing domain pilot with template preview, source confidence gate, approved-run archival,
  and Task Artifact output
- read-only computer diagnostics for runtime, temporary directory, PATH health, agent discovery,
  configuration warnings, and approved-run report archival
- System Profile Reader context snapshots that expose only non-sensitive OS,
  architecture, runtime availability, PATH counts, and tool counts while denying
  account, file content, browser, token, cookie, API key, serial, and network identity data
- Web App Shell manual preview for built-in isolated web profiles with no
  process start, auto-login, auto-submit, publishing, trading, sensitive page
  reads, or session export
- Codebase Memory structural adapter preview for CodeGraph-backed project
  context with no command execution, repository-wide scan, raw file ingest,
  automatic L2 write, or index rebuild
- Permission Memory candidate preview for reusable approval records with scope,
  tool range, permission level, action pattern, expiry, revocation, audit
  reference, and high-risk non-reuse boundaries
- Library Home recoverability policy showing read-only backup index boundaries,
  restore-to-temporary-recovery-area-first behavior, and review/audit requirements
  before cleanup, permanent delete, or original-location restore
- isolated A-share strategy laboratory for bounded pasted `date,close` CSV, explainable moving
  average simulation, insufficient-data stopping, and approved-run research archival
- Agent Harness dry-run for detected Codex, Claude Code, Gemini, and Hermes CLIs with separate
  native/deep context policies, argument-vector preview, four-layer readiness, and no process spawn
- first real Codex CLI adapter with explicit confirmation, ephemeral read-only execution,
  ignored user execution config, credential-like environment filtering, pre-execution rollback
  snapshot, 120-second timeout, bounded capture, quarantine artifact, review checks, and audit
- guarded Python Playwright inspection with exact-host allowlist, per-request route blocking,
  title/text/screenshot capture, dual-tool approval, timeout, quarantine artifact, and no interaction API
- bounded 2-4 member Agent team previews for linear handoff and roundtable synthesis with
  1-3 rounds, explicit call estimates, quarantined handoffs, and no process execution
- guarded local application bridge with canonical descriptors, separate bridge/app allow states,
  approved Task Runs, argument-free launch receipts, and no credential or window-content access
- unified notification gateway with email/Feishu/WeChat contracts and guarded SMTP email delivery;
  SMTP credentials are environment-only and never written to JSON, audit events, or artifacts
- local Zhishu device-sync packages with device identity, SHA-256 integrity checks,
  base-hash conflict preview, explicit replace approval, and relay dry-run readiness checks
- Task Center run request and approval recording without execution
- manual scheduler tick for due Task Center directions
- scheduler safety status preview
- executor contract dry-run preview
- approved local Task Run execution through internal candidate mining
- normalized Task Run lifecycle transitions with legacy record inference
- persisted Task Run running, succeeded, and failed states with execution timing
- guarded Task Run cancellation and archival with durable audit events
- persisted scheduler and candidate-deepening idempotency keys
- Task Run artifact records for generated candidates
- Task Artifacts can be manually promoted into reviewed-before-acceptance L2
  Zhishu candidates with lineage tags and durable audit events
- persistent scheduler lease and recovery state
- configuration-gated scheduler background loop that only creates approval requests
- scheduler failure backoff and interrupted-run recovery
- permission policy preview and dry-run enforcement
- Zhishu synthesis summary and association preview
- reviewed Zhishu write promotion from synthesis previews
- information aggregation preview and source gates
- offline fixture observations with freshness, coverage, conflict, and confidence assessment
- persistent source observation history and source filtering
- local source health report across observation history with source reliability,
  query cross-check readiness, and conflict-review states
- lightweight Baigong/Taiheng data source registry preview with no credentials,
  no heavy data processing, and no live fetch execution
- bounded manual JSON/CSV source observation import without file-path access
- one configured allowlisted read-only HTTP JSON source
- retrieval contract dry-run preview
- Arsenal registry preview
- custom Arsenal tool descriptor loading
- Arsenal local tool discovery preview
- Arsenal allowlist editing without invocation
- built-in `mock-cli` adapter dry-run and approved deterministic execution
- mock adapter audit and Task Artifact output without process or network access
- manual snapshot creation and filtered snapshot history for Zhishu items,
  Task Center directions, and Arsenal allow-state records
- durable audit events for Zhishu review, Task Run approval, Task Candidate
  review, and Arsenal allow-state changes
- automatic pre-review snapshots and rollback for Zhishu item review
- automatic pre-change snapshots for Task Center active-state changes and
  Arsenal allow-state changes
- guarded rollback for Task Center active-state snapshots and Arsenal
  allow-state snapshots, with rollback-before snapshots and durable audit events
- automatic pre-change snapshots and guarded two-way rollback for custom Arsenal
  tool registry create and remove actions
- recent Zhishu restore points in the workbench

Preview-only:

- online information aggregation source selection
- fixture observations, which remain quarantined test data rather than current evidence
- automatic approval or execution of scheduled Task Center runs
- model-backed Plan IR generation
- automatic summary, association, or Zhishu promotion writes without review
- optional relay upload for device sync packages

Disabled until guardrails are implemented:

- arbitrary or multi-source network retrieval outside the configured HTTP source
- browser write automation, form submission, downloads, uploads, and arbitrary scripts
- local app control beyond the guarded canonical launch receipt
- script or agent execution
- Arsenal tool invocation
- invocation of every Arsenal tool except the built-in `mock-cli`
- external executor dispatch
- durable automatic Zhishu self-growth without review gates
- broad rollback for Task Center fields beyond active state and Arsenal fields
  beyond allow state
- unrestricted cross-domain writes without Saga, snapshot, and audit tracing

## Current Status

Verified locally:

- `npm.cmd run build`
- `npm.cmd run preflight`
- `npm.cmd run preflight:static`
- `npm.cmd run smoke:ui`
- `cargo check --offline`
- `cargo test store --offline --quiet`
- `cargo test domains::production_readiness --offline --quiet`
- `npm.cmd run release:evidence` writes JSON/Markdown evidence and blocks
  release claims when evidence is stale or release-machine blockers are present

Near-term next steps:

1. Keep public software version `0.0.0` separate from internal Design V6.6
   iteration notes.
2. Run `npm.cmd run preflight:release` until it passes before publishing to
   GitHub.
3. Produce and verify a release MSI on the target release machine after WiX is
   installed or pre-cached.
4. Keep future real Feishu/WeChat push, direct Agent execution, browser write
   automation, and cloud relay work behind separate guardrail reviews.
5. Add explicit migrations when schema v2 or another changed store schema is
   introduced.
