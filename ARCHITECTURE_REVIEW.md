# Architecture Review and Refactor Timing

This note evaluates the larger Synapse ideas against the current implementation.
Its purpose is to keep the product direction ambitious without letting near-term
development become tangled.

## Current Architecture Snapshot

Synapse is currently a working scaffold around a preview-first cognitive
pipeline.

- Frontend: `src/App.tsx` is a single workbench that shows intent planning,
  memory capture, Task Center directions and candidates, review actions, audit,
  execution preview, and history.
- Tauri command layer: `src-tauri/src/lib.rs` exposes commands and still performs
  much of the orchestration directly.
- Kernel: `src-tauri/src/kernel` defines plan input and materialized plans.
- Rules: `src-tauri/src/rules` converts soft intent into hard runtime
  constraints.
- Context: `src-tauri/src/context` models L0/L1/L2 memory references.
- Audit: `src-tauri/src/audit` builds preview-only promotion and trace reports.
- Execution: `src-tauri/src/execution` builds traceable execution-span previews.
- Drivers: `src-tauri/src/drivers` contains dry-run Lite and Pro driver
  placeholders.
- Store: `src-tauri/src/store` persists plan history, review history, execution
  queue records, memory items, Task Center directions, and Task Center
  candidates. It is now split into domain files for history, queue, memory,
  paths, and Task Center state.

The current local data files live under `.synapse/`:

- `plan-history.json`
- `review-history.json`
- `execution-queue.json`
- `memory-items.json`
- `task-center-directions.json`
- `task-center-candidates.json`
- `task-center-runs.json`
- `arsenal-allowlist.json`

## Refactor Difficulty Matrix

| Area | Difficulty | Best Timing | Handling |
| --- | --- | --- | --- |
| Intelligence Hub | High | Start boundary work now; full build later | Memory storage is now separated from the general store. Next add classification, provenance, admission, and retention metadata before durable L2 writes. |
| Task Center | Medium | Already started | Keep the current Task Center refactor. Add scheduling, templates, and richer candidate review incrementally. |
| Permission and Guardrails | High | Driver-level dry-run enforcement added; deepen before real tools | The policy preview now classifies action tiers, approval gates, can force policy-gated plans into review, and blocks driver readiness when review or explicit approval is missing. Real executor enforcement remains deferred until external actions exist. |
| Arsenal | Very high | Registry preview added; execution deferred | The tool registry and allowlist model now exist in preview form. Real scanning and execution remain deferred until policy and ingestion gates are enforceable. |
| Agent Submodule | Very high | After Arsenal and permissions | Later add local agent discovery, native/deep modes, and separate output ingestion policies. Do not connect CLIs before guardrails. |
| Computer Assistant | High | After permissions and Arsenal registry | Start later with dry-run recipes and risk previews. Avoid real cleanup or repair actions until explicit approval tiers exist. |
| Python Tools | High | After tool registry and script policy | Store script metadata and invocation rules in the Intelligence Hub; keep script bodies in the Arsenal. |
| Local App Calling | High | After allowlist and permissions | Require user-configured app allowlists and action risk classification. |
| Experience Reuse | Medium-high | After memory classification | Model success patterns and failure blacklists as reviewed memory items. Require dedupe, scope, confidence, and review. |
| Information Aggregation | High | Offline source model added; retrieval later | Source freshness, cross-check, quarantine, durable-write gate, and prompt-injection defense are modeled. Real network retrieval is still deferred. |
| Browser Automation | Very high | After permissions, Arsenal, and audit trails | Keep observation, proposal, execution, and audit as separate stages. Require approval for submit, purchase, delete, account, and write actions. |

## Immediate Refactor Decisions

1. Task Center can continue now.

   The opportunity module has already been reframed as Task Center. This lowers
   future migration cost. The next additions should be scheduling previews,
   output templates, and richer review states rather than another rename.

2. Intelligence Hub needs a boundary soon, not a full rewrite.

   The current `MemoryItem` shape is a good seed, but the next memory refactor
   should add explicit area and admission metadata. The likely areas are
   `knowledge`, `memory`, and `skill`. Durable L2 writes should remain gated.

3. Permission and guardrails should move earlier.

   Any future workflow that touches tools, agents, browsers, local apps, scripts,
   cleanup, writes, moves, or deletes needs permission classification before it
   executes. A policy review gate and driver-level dry-run enforcement now
   exist; real external executors must reuse this before actions are enabled.

4. Arsenal execution should not be implemented yet.

   The Arsenal is powerful, but it multiplies risk and data-pollution paths. A
   registry preview exists now; real external tool invocation remains deferred.

5. Experience reuse should enter through reviewed memory.

   Successful patterns, failure warnings, and allow/deny behavior should not
   become a separate uncontrolled store. They should be typed memory records with
   strict admission rules.

## Recommended Architecture Direction

### Store Boundary

`src-tauri/src/store/mod.rs` has been split before adding more durable features.

Current shape:

```text
services/
  mod.rs              service module exports
  aggregation.rs      information aggregation command boundary
  arsenal.rs          Arsenal registry and allowlist command boundary
  executor_contract.rs executor readiness command boundary
  history.rs          plan history command boundary
  memory.rs           memory command validation and error mapping
  planning.rs         intent preview and plan-history write boundary
  review.rs           plan review, review-history, and execution-queue boundary
  synthesis.rs        synthesis preview and promotion command mapping
  system.rs           runtime status and capability summary boundary
  task_center.rs      Task Center command orchestration and error mapping

store/
  mod.rs              public re-exports, JSON helpers, StoreError
  history.rs          plan and review history
  queue.rs            execution queue records
  memory.rs           MemoryItem and future Intelligence Hub records
  task_center.rs      TaskDirection, TaskCandidate, candidate review
  paths.rs            shared project data-file paths
```

This keeps the current JSON-file approach while reducing coupling.

### Split Command Orchestration

`src-tauri/src/lib.rs` should stay thin. Move business flows into service-style
modules before it grows further.

Recommended shape:

```text
services/
  planning.rs
  memory_capture.rs
  task_center.rs
  review.rs
  policy.rs
```

The Tauri commands should mostly validate inputs, call services, and return
results.

The Task Center, memory, synthesis, aggregation, Arsenal, executor-contract,
history, planning, review, and system-status command paths have started this
split: Tauri commands now call service modules, while durable state logic
remains in `store`.

### Add an Intelligence Hub Model Layer

Do not rush a new database. First add clearer item metadata.

Recommended fields to add before deeper automation:

- hub area: knowledge, memory, or skill
- admission rule and admission state
- provenance and source trust
- retention policy
- authority level
- related item links with relation type
- last reinforced or last invalidated timestamp

### Add Permission Tiers Before Real Tools

The first policy layer now classifies actions before execution:

- read-only observation
- local write or create
- modify existing content
- delete, move, cleanup, or destructive change
- external network or account action
- agent, script, browser, or local app action
- durable Intelligence Hub write

Each tier should continue to define whether preview, explicit approval, audit,
and rollback or compensation are required. Policy-gated plans now enter review;
the next step is to make these gates enforceable by the future executor itself.

### Keep Preview-First as the System Pattern

Risky flows should follow the same rhythm:

```text
observe -> propose -> approve -> execute -> audit -> store
```

This applies to Task Center mining, Intelligence Hub writes, Arsenal tools,
browser automation, information aggregation, and computer assistant actions.

### Frontend Workbench Boundary

`src/App.tsx` now keeps orchestration state while focused panels live under
`src/components/`.

Current extracted panels include:

- `InspirationPanel`
- `MemoryPanel`
- `DirectionSetupPanel`
- `DirectionListPanel`
- `CandidatePanel`
- `CapabilityPreviewPanel`
- `TracePanel`
- `PlanStepsPanel`
- `ExecutionPanel`
- `PolicyPanel`
- `AuditPanel`
- `HistoryPanel`

The intent input and shell layout are still inline in `App.tsx`. The next
frontend cleanup can extract them and consider grouping panel exports if imports
become noisy.

### Add Schema Versions and Migrations

The `.synapse/*.json` files are now becoming real user state. Add schema version
fields and small migrations before the next durable memory expansion.

## Suggested Implementation Order

1. Add real scheduling, information retrieval, agent, browser, script, local app, and computer assistant execution
   only after guardrails are working.

## Defer Explicitly

Do not implement these yet:

- direct CLI calls to external coding agents
- browser automation that submits or changes web state
- C drive cleanup or repair actions
- online information ingestion into durable memory
- automatic L2 writes without review
- one-click team execution
- local application control

These are still target capabilities, but they should wait until permission
tiers, audit trails, ingestion gates, and schema migration are stable.
