# Synapse Architecture

Synapse is moving toward a unified dual-mode cognitive kernel:

- Lite mode: local, quiet, low-friction personal assistant behavior
- Pro mode: traceable, reviewable, policy-heavy cognitive OS behavior
- Zhishu / Intelligence Hub: the long-term knowledge, memory, and reusable skill core
- Task Center: the output, opportunity, scheduling, and self-growth layer
- Arsenal: the extension tool and local automation layer

The current codebase is a working scaffold. It does not execute external tools
yet; it builds a deterministic preview of the planning pipeline and writes local
prototype memory records behind review-oriented metadata.

## Runtime Flow

```text
User intent
  -> Plan IR
  -> Rule policy
  -> Context references
  -> Materialized plan
  -> Permission policy preview
  -> Audit preview
  -> Execution preview
  -> Workbench display
```

## Core Modules

### Frontend workbench

The React workbench keeps orchestration state in `src/App.tsx`, while focused
panels live under `src/components/`.

Current panel boundaries:

- intent input remains in `App.tsx`
- inspiration capture and recent memory
- Task Center direction setup, direction list, and candidates
- Task Center direction active-state controls
- Task Center run requests waiting for approval
- manual scheduler tick for due directions
- scheduler safety status before any background loop is started
- information aggregation and Arsenal previews
- Security Center aggregation of durable audit events, guarded capability
  states, high-risk trails, and recent restore points
- current trace and materialized plan steps
- execution preview
- executor contract dry-run preview
- permission policy preview
- audit review
- decision history

### `config`

Loads `synapse.config.toml`, applies defaults, validates basic values, and
returns warnings for the workbench.

### `kernel`

Defines `PlanIr` and `Plan`.

`PlanIr` is model-facing input. It contains intent, risk, proposed steps, and
soft constraints.

`Plan` is kernel-facing output. It contains route, hard constraints, context
references, audit flags, and bounded steps.

### `rules`

Injects hard constraints:

- mode
- execution level
- failure strategy
- sandbox route
- step budget
- timeout
- mode lock behavior

It also decides whether audit is required for a given risk level.

### `policy`

Builds the first permission and guardrail preview for a materialized plan.

The current policy layer classifies requested action tiers such as:

- read-only observation
- local write or modify
- destructive local change
- network or browser action
- push delivery action
- agent or tool action
- script or local app action
- durable Zhishu write

It does not execute tools yet. It marks whether review or explicit approval is
required, upgrades policy-gated plans into the review path, and exposes the
gates the future executor must honor. Drivers now use the policy enforcement
dry-run before reporting readiness.

### `aggregation`

Models the default information aggregation channel before network retrieval is
enabled.

The current implementation is offline only. It previews:

- whether the query needs fresh information
- whether cross-checking is required
- whether the query itself appears to contain instruction-injection wording
- source trust and quarantine state
- allowlisted, quarantined, disabled, and blocked source gates
- retrieval contract readiness before any real network call
- prompt-injection defense policy
- durable Zhishu admission gate
- fixture-backed observations with captured time, freshness, field coverage,
  fallback state, normalized claims, conflict level, and confidence

Push, email, Feishu, and WeChat wording is treated as a delivery-channel
request, not as source evidence. The current preview marks those channels as
policy-gated and still performs no delivery.
Instruction-bearing queries are marked for manual security review and add a
`query-instruction-risk-review` retrieval gate.

It does not fetch web content yet. Fixture observations are explicitly labeled
as test data and remain quarantined rather than entering Zhishu.
Each preview persists its observations, query, confidence score, conflict
level, and admission state in a capped source history. The workbench can inspect
recent source health without promoting those records into Zhishu.
The source health report is computed only from recorded local observation
history. It groups records by source and query, highlights claim conflicts,
fallback-heavy sources, weak confidence, and cross-check-ready query clusters,
and still performs no retrieval or Zhishu admission.

Manual fallback import accepts pasted JSON arrays or bounded CSV records. It
does not accept or read filesystem paths. Imported observations are normalized,
marked as fallback data, quarantined, confidence-assessed, and persisted in the
same source history without entering Zhishu.

One configured read-only HTTP JSON source can be enabled through
`aggregation.http_source_url`. The command accepts no runtime URL. Requests are
GET-only, follow no redirects, reject URL credentials and fragments, require
HTTPS except for localhost tests, use a five-second timeout, cap responses at
256 KB, and require a JSON content type. Results remain quarantined, are written
to source history, and create a durable audit event.

### `synthesis`

Builds reviewed summary and association previews from recent Zhishu
memory and Task Center candidates.

The current implementation previews candidates and supports manual promotion
into reviewed L1 memory. It does not automatically promote summaries, write
links, or mutate Zhishu records without user action. All candidates carry a
review state and admission gate so the promotion path stays explicit.
Maintenance job previews also expose admission gates, keeping Zhishu self-growth
visible before any reviewed write. Maintenance jobs also expose preview cadence
for daily summaries, on-refresh association, and direction-frequency Task Center
review queues.

Deepening a Task Center candidate creates a local follow-up Task Run record in
the approval queue. The follow-up records the source candidate and stays
not-started until the normal run review and executor gates approve it.

### `arsenal`

Models the extension tool registry before local tool execution is enabled.

The current implementation is preview-only. It records:

- tool category, such as agent, browser, script, local app, or Python tool
- registry source, such as built-in or custom
- native or deep invocation mode
- PATH discovery state for known command candidates
- allowlist state
- risk level
- output ingestion policy
- capability tags for future filtering and policy mapping
- gates future executors must honor

It does not launch external processes yet. A detected command can be explicitly
marked allowed or blocked, but allowlisting is only registry state; future
execution still has to pass policy and executor gates.
Tools that are not detected on PATH cannot be marked allowed; this keeps
configuration from drifting ahead of local reality.
Computer cleanup, computer troubleshooting, and local app bridge entries exist
as blocked, not-configured placeholders so the future modules have a registry
anchor before any execution pathway is added.
Linear workflow and roundtable review agent-team entries also exist as blocked
placeholders so orchestration can be designed against explicit registry IDs.
Optional custom tool descriptors can be read from `.synapse/arsenal-tools.json`.
They are merged into the preview registry, normalized, defaulted to `blocked`,
and still require PATH detection before allowlisting.

The built-in `mock-cli` is the sole executable adapter exception. It is an
in-process deterministic test adapter and never spawns a process or accesses
the network. Dry-run records its gates. Execute requires an allowed tool,
an approved waiting Task Run, and explicit execution approval, then writes a
durable audit event and a Task Artifact.

### `context`

Models memory isolation:

- L0 Session: raw interaction, session-bound
- L1 Working: shadow validation and temporary working facts
- L2 Knowledge: durable knowledge and policy

The current implementation returns context references only. Storage is not
used by the preview pipeline yet.

Memory storage now records Zhishu metadata for local items, including
hub area, admission state, admission rule, provenance, source trust, retention
policy, and authority. Legacy memory JSON without those fields remains readable.
No-tag inspiration records receive lightweight `idea` and `inspiration` tags,
then still use content-derived tags when available, giving association previews
a stable hook without overwriting user-provided tags.
Manual Zhishu capture supports knowledge, reference, rule, skill, skill-flow,
and script-interface candidates. These enter L2 as `candidate` records with
captured admission state, not as accepted durable knowledge.
When these captures omit tags, the store adds lightweight type tags such as
`knowledge`, `rule`, `skill`, or `script-interface` so later association and
Task Center mining have a stable hook.
The workbench can review recent Zhishu items. Accepting a candidate marks it as
accepted, moves candidate-level records to reviewed level, reinforces it, and
sets trust to reviewed-local. Rejecting marks it rejected and records
invalidation time. Neither path launches external tools.
Rejected records are excluded from Task Center candidate mining and synthesis
association previews so rejected paths do not continue to feed opportunity,
task, or linking discovery.

Zhishu retrieval combines text, tags, hub area, item type, scope, admission
state, minimum confidence, reinforcement age, and result limits. Each result
returns a score, matched fields, and a readable explanation. Rejected memory
items are always excluded.

Relationships are stored separately in `zhishu-relations.json`; original
`MemoryItem` records are not mutated. Search results can generate deduplicated
shared-topic candidates from common tags. Every relation remains a candidate
until explicitly accepted or rejected, and rejected relations are excluded from
the active relation list.

Maintenance findings are stored separately in
`zhishu-maintenance-findings.json`. Scans detect exact normalized duplicates,
accepted L1/L2 items that have exceeded the configured reinforcement age, and
conservative conflict candidates that share type, hub, and tags but differ in
negation signals. Findings require explicit review and never merge, delete, or
rewrite `MemoryItem` records.

The active Zhishu repository is SQLite-backed through a collection repository
boundary. Memory items, relations, and maintenance findings are committed to
`synapse.db`; their former JSON files are imported once and left intact.
Records remain schema-versioned JSON payloads inside SQLite during this
transition, preserving compatibility while providing transactional collection
replacement. A versioned bundle supports explicit JSON export and transactional
import of all three collections.

### `audit`

Builds an `AuditReport` with staged promotion decisions:

- trace capture
- shadow validation
- knowledge promotion

The report is preview-only. No durable write happens yet.

### `domains::daily_briefing`

The first domain plugin reuses aggregation evidence, Task Run approval, source
quarantine history, Task Artifacts, and audit events. Templates define a title,
query, sections, and online intent. Previewing is read-only. Archival requires
an approved, not-started Task Run and a reviewable source-confidence gate, then
persists source observations, creates a `daily-briefing` artifact, and completes
the run. External delivery remains disabled.

### `domains::computer_diagnostics`

The computer assistant pilot performs read-only inspection through Rust standard
library calls and the existing Arsenal registry. It reports runtime path,
temporary-directory visibility, PATH duplication, registered agent discovery,
and configuration warnings. It never launches a process, deletes a file,
writes the registry, or changes a system setting. Reports can be archived only
through an approved Task Run.

### `domains::quant_lab`

The quantitative research pilot is isolated from the core and accepts only
bounded pasted `date,close` CSV data. It runs a versioned, explainable moving
average crossover simulation with no brokerage connection or order generation.
Insufficient samples stop the report before strategy metrics are produced.
Research-ready reports can be archived through an approved Task Run and retain
explicit modeling limitations.

### `domains::agent_harness`

The Agent Harness first stage models Codex, Claude Code, Gemini, and Hermes CLI
invocations without starting a process. Native mode passes no Zhishu context and
quarantines output. Deep mode references only accepted local memory excerpts and
requires review before any memory admission. Readiness separately checks CLI
detection, Arsenal allow state, Task Run approval, and a final explicit
execution approval. Arguments remain a vector preview rather than a shell
command string.

The first real adapter is limited to Codex CLI. It invokes the detected
executable directly with an argument vector, sends the task through stdin, uses
ephemeral read-only mode, ignores user config and local execution policy rules,
enforces a 120-second timeout, drains output with a 256 KB capture ceiling, and
stores successful output only as a quarantined Task Artifact. Claude Code,
Gemini, and Hermes remain dry-run-only.

### `domains::browser_automation`

The first browser adapter reuses the installed Python Playwright runtime and
Chromium. It requires both `browser-playwright` and `python-local` to be
detected and allowed, an approved Task Run, explicit execution confirmation,
and an exact hostname listed in `[browser].allowed_hosts`. Every browser request
is intercepted before dispatch and non-allowlisted hosts are aborted. The
adapter exposes only navigation, title, bounded body text, and optional
screenshot capture; no click, form, credential, upload, download, or arbitrary
script API is available. Results remain quarantined Task Artifacts.

### `domains::agent_team`

Team orchestration is currently a preview-only execution graph. A team contains
2-4 distinct detected Agent tools and at most three rounds. Linear mode passes
only the previous participant's quarantined output forward. Roundtable mode
collects each round's quarantined outputs into a separate synthesis node. Call
counts are estimated before execution, every output remains isolated, and no
participant can write directly to Zhishu.

### `domains::local_app_bridge`

The first local application bridge supports only a canonical Windows Notepad
descriptor. The executable path, capabilities, argument policy, and session
policy are rebuilt from code on every read; the JSON store preserves only the
allow decision and cannot redirect an approved descriptor to another
executable. Launch requires separate bridge-tool allowance, app allowance,
Task Run approval, and explicit confirmation. No arguments, credentials,
application profile data, or window content are read. A launch receipt is
recorded, but the Task Run is not marked complete.

### `domains::notification_gateway`

Notification requests share one channel contract and must reference an approved,
not-started Task Run whose push metadata explicitly enables the selected
channel. Email delivery uses the configured SMTP host/from/to values and reads
credentials only from `SYNAPSE_SMTP_USERNAME` and
`SYNAPSE_SMTP_PASSWORD`. Credentials and message bodies are not copied into
audit events or artifacts. Subjects reject line breaks to prevent header
injection, message sizes are bounded, delivery requires explicit confirmation,
and the Task Run remains open after a receipt is recorded. Feishu and WeChat
remain non-executing adapter contracts.

### `domains::device_sync`

Device sync is a local Zhishu bundle exchange boundary. It exports memory,
relation, and maintenance collections as a versioned package with source device
identity, base hash, and SHA-256 content hash. Import first verifies schema and
payload integrity, then classifies the package as already synchronized,
fast-forward-ready, conflict-local-and-remote-changed, initial-import-ready, or
initial-import-requires-replace. Non-empty initial replacement requires an
explicit replace flag, conflicts do not auto-merge, and no credentials or
environment data are included.

The optional relay configuration is contract-only in this stage. It validates
that relay is enabled, the endpoint is HTTPS without credentials or fragments,
and `SYNAPSE_RELAY_TOKEN` exists, but reports readiness without starting any
network upload.

### `execution`

Builds an execution span preview. Spans can be:

- ready
- waiting-audit
- blocked

This is not the real executor. It is the trace model the executor can later
produce while running real steps.

### `executor_contract`

Checks recent Task Center run records against the gates a future executor must
honor. The preview also reads current Task Center directions so inactive
directions block otherwise-ready runs in the contract view. `direction-active`
is part of the required executor gate list.

The current implementation is a contract preview. Approved local run records can
be marked `ready-local-execution`, online run records stay blocked behind source
gates, and candidate-deepening runs get a dedicated lane that requires a source
candidate before they are marked `ready-local-deepening`.

### Local Task Executor

Task Center has a minimal local executor path for approved, local-only run
records.

Task Run records now carry a normalized lifecycle state. New records begin at
`awaiting-approval`, then move through the centralized transition guard to
`approved`, `running`, `blocked`, `succeeded`, or `failed`. The local executor
persists `running` before internal work begins. Successful work records start
and completion times; execution errors record a failure time and compact error
summary. Legacy records without the lifecycle
field are inferred from their existing approval and execution fields when read.
Invalid transitions, such as approving an already rejected run, are rejected.
The older approval and execution fields remain as compatibility projections
while the state machine is introduced incrementally.

Users can cancel runs that have not started or have failed. Running, succeeded,
and policy-blocked runs cannot be falsely cancelled. Blocked, succeeded, failed,
or cancelled runs can be archived; archival preserves their execution result
fields so completed schedule intervals remain visible. Cancel and archive
actions record timestamps and durable audit events.

Task Runs also persist an idempotency key. Scheduled runs use a stable key for
the direction and current schedule interval. Candidate-deepening runs use the
source candidate ID, so repeating the same deepening request reuses the original
run even after completion. Legacy records receive a stable key derived from
their existing run ID when read.

Successful local execution indexes each generated candidate as an independent
Task Artifact with its run ID, direction ID, type, reference ID, summary, and
metadata. The run retains generated candidate IDs as a compatibility
projection. If artifact indexing fails, the executor compensates by removing
the candidates generated by that attempt and records the run as failed.
Task Artifacts can also be manually promoted into L2 Zhishu candidates. The
promotion preserves artifact, run, direction, and reference lineage in content
and tags, creates only a candidate record, and records a durable audit event;
accepting it as reviewed knowledge remains a separate Zhishu review action.

It does one thing: run internal keyword matching for that run's direction and
write resulting Task Center candidates. It blocks online runs, unapproved runs,
inactive directions, and already-finished runs. It does not call Arsenal tools,
scripts, browsers, agents, or network retrieval. Completed runs store generated
candidate IDs and completion time so the UI can show what happened and prevent
accidental repeated execution.
Generated candidates also record the direction output-template preference as
evidence. When the direction uses `auto`, candidates add a conservative
resolved output-template hint such as `brief`, `report`, `checklist`, or
`opportunity`. Skill, flow, script, and interface candidates bias toward
checklist outputs; real template-specific document generation remains deferred.
Directions can store preview-only push preferences for Email, Feishu, or
WeChat. These preferences are metadata for future multi-device delivery; the
current executor does not call any push interface. Task Run records snapshot
the direction's push preferences when they are requested or scheduled, and the
executor contract exposes `push-delivery-if-enabled` / `push-delivery` gates so
future delivery work remains auditable at run creation time.
Schedule previews expose the same preview-only push metadata. Schedule previews
and the manual scheduler both treat recently completed daily, weekly, and
configured hourly custom directions as already satisfied for the current
interval, then allow a new run once that interval has expired.
Candidate-deepening follow-ups are excluded from this interval accounting.

Approved candidate-deepening runs use the same local executor boundary. They
derive a new candidate from the recorded source candidate, preserve source
evidence, and still avoid tools, scripts, browsers, agents, and network calls.
The derived candidate stores explicit source-candidate lineage so later review
and Zhishu promotion can distinguish it from memory-derived matches.
When a deepened candidate is accepted, that lineage is copied into the promoted
L1 memory content and tags.

Task candidates include structured score components and memory evidence so the
user can see which keywords, priority, confidence, and memory metadata
contributed to a result. Weak matches below the minimum internal quality
threshold are filtered before they are stored.

### `drivers`

Defines Lite and Pro driver placeholders. The trait boundary is present, but
the drivers currently return success without executing external tools.

### `store`

Persists local prototype state in capped JSON files under `.synapse/`.
All current domain files use schema envelope v1 for new writes. Legacy arrays,
schema v0 envelopes, and envelopes with a missing schema version remain
readable. A future schema version is rejected until an explicit migration is
implemented.

Writes are staged in a unique temporary file beside the destination, flushed
and synced, then atomically replaced. Replacement failures clean up the
temporary file and preserve the last valid destination.

The storage boundary is split by domain:

- `history`: plan and review history
- `audit_event`: durable state-change events with hashed inputs and compact
  result summaries
- `queue`: execution queue records
- `memory`: L0/L1/L2 memory items and inspiration capture
- `task_center`: directions, candidates, and candidate review
- `task_artifact`: outputs linked to their Task Run and Task Center direction
- `zhishu_relation`: reviewable links between Zhishu items
- `scheduler_state`: single-instance lease, heartbeat, tick health, and recovery
- `snapshot`: versioned object baselines for Zhishu items, Task Center
  directions, and Arsenal allow-state records
- `device_sync`: local device identity, last exported/imported timestamps, and
  last accepted Zhishu bundle hash
- Task Center run requests are stored separately; approval or rejection updates
  their state but does not start execution
- Inactive Task Center directions cannot accept new run requests, and any
  already-approved run is blocked again if its direction is disabled before
  local execution.
- Repeated manual requests for the same direction reuse an existing open
  direction run. Completed runs and candidate-deepening follow-ups do not count
  as open direction runs for scheduler gating.
- The manual scheduler tick can record due run requests, but no background loop
  or executor is active yet
- Persistent scheduler state prevents a second instance from taking an active
  lease. Expired leases can be taken over, and tick success/failure health is
  retained across restarts.
- When enabled by configuration, a dedicated scheduler thread acquires the
  lease, heartbeats, and invokes the same guarded scheduler tick used by the
  workbench. It only creates `awaiting-approval` Task Runs. It never approves or
  executes them, and application shutdown stops the thread and releases the
  lease.
- Consecutive tick failures apply exponential backoff up to sixteen polling
  intervals while lease heartbeats continue at the base interval. Losing the
  lease stops the loop. After acquiring a lease on startup, the runtime marks
  any Task Run left in `running` as failed, records an interruption summary,
  and writes a recovery audit event instead of silently retrying execution.
- `scheduler` reports whether the background loop is disabled or only
  configured, plus the gates required before real scheduling can run
- `paths`: shared project data-file paths

Snapshot records contain the protected object type, object ID, per-object
version, reason, timestamp, and JSON payload. They can currently be created and
queried through Tauri commands. Zhishu item review now creates a snapshot before
the review mutation. The workbench can restore a recent Zhishu snapshot; the
rollback operation first protects the current item in a new snapshot.
Task Direction active-state changes and Arsenal allow-state changes also create
pre-change snapshots before mutation. The Security Center can restore those
Task Direction active-state and Arsenal allow-state snapshots. Rollback first
snapshots the current object state, then restores the selected payload and
records a durable audit event. Broader field-level rollback remains deferred,
and Zhishu memory still uses its dedicated restore path.

Audit events now cover Zhishu item review, Task Run approval, Task Candidate
review, and Arsenal allow-state changes. Events record the local actor, action,
target, risk, decision, an input hash, and a compact result summary without
copying the raw input. The protected Zhishu review and rollback flow compensates
the memory write if audit persistence fails. Other domain files and the audit
file are still separate writes; broader transactional compensation remains a
next reliability step.

## Security Model

The design separates thought from execution:

- model output is Plan IR only
- rules convert soft preferences into hard constraints
- permission policy classifies action tiers before any future real execution
- policy-gated plans must pass review before execution queue promotion
- driver readiness is blocked by policy enforcement when review or explicit
  approval is missing
- online information is modeled as quarantined source context before any future
  Zhishu write
- Arsenal tools are registry previews until allowlist, policy, and ingestion
  gates are enforceable
- context promotion is one-way and audit-gated
- execution preview exposes route, risk, and compensation before real work

## Near-Term Work

1. Add protected-object snapshots and rollback.
2. Unify durable audit events across review, approval, and allowlist changes.
3. Formalize the Task Center lifecycle and state transitions.
4. Start the background scheduler only after idempotency and recovery gates.
5. Implement a controlled adapter executor behind the policy boundary.
6. Add real information retrieval behind source-confidence gates.
7. Add explicit store migrations when schema v2 is introduced.
8. Replace template icons and prepare release branding after execution hardens.

See `MEMORY_OPPORTUNITY_DESIGN.md` for the memory and Task Center direction.
See `STRATEGIC_ROADMAP.md` for the longer-range Zhishu, Task Center,
Arsenal, permission, experience-reuse, and built-in-tool direction.
See `ARCHITECTURE_REVIEW.md` for refactor difficulty, timing, and architecture
optimization recommendations.
