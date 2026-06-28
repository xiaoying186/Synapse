# Memory and Task Center Design Notes

This note records the proposed direction for Synapse memory, knowledge,
task-center mining, and inspiration capture. It is a product and architecture
input, not an implementation contract yet. Opportunity mining is now treated as
one Task Center output mode, not the module boundary.

Longer-term naming and module boundaries are tracked in
`STRATEGIC_ROADMAP.md`. In short, the unified memory and knowledge layer should
evolve toward the Intelligence Hub, while directions and candidates now belong
to the Task Center.

## 1. Unified Memory System

Proposal:

- Put session memory, working memory, and knowledge base memory into one unified
  memory system.
- Keep knowledge memory as the lower, more durable layer.
- Add an explicit gate between knowledge memory and the more fluid memory
  layers.
- Let each memory scope have internal levels.
- Route content into the right layer according to content type, confidence,
  verification result, and audit outcome.

Fit with current architecture:

- Strong fit.
- The current code already models `L0 Session`, `L1 Working`, and
  `L2 Knowledge` in `src-tauri/src/context/mod.rs`.
- The current implementation persists local MemoryItems with admission,
  provenance, source-trust, retention, and authority metadata.

Suggested shape:

```text
Unified Memory
  L0 Session
    raw traces
    temporary interaction facts
    unresolved fragments

  L1 Working
    validated short-term facts
    active project state
    candidate summaries
    pending associations

  L2 Knowledge
    durable user preferences
    stable project facts
    reusable decisions
    long-lived task and opportunity maps
    verified insight chains
```

Recommended integration:

- Implement as the next major storage module after the current plan/review/queue
  history.
- Add a `MemoryItem` model with fields such as scope, level, type, source,
  confidence, verification status, links, created time, and last reinforced time.
- Keep L2 writes audit-gated.

## 2. Periodic Summary, Association, and Task Mining

Question:

- Does the current system periodically summarize memory or knowledge?
- Does it automatically associate related content?
- Does it mine opportunities and scheduled task outputs?

Current answer:

- Partially.
- Current code has normalized memory records, Task Center candidates, and a
  manual Hub synthesis preview.
- The synthesis preview exposes dry-run maintenance jobs for recent-memory
  summary candidates, related-item association candidates, and mined Task
  Candidate review queues.
- There is still no background maintenance loop, model-backed enrichment, or
  automatic durable Hub write.

Recommended integration:

- Add a background maintenance loop with dry-run previews first.
- Start with deterministic local jobs before model-backed enrichment:
  - summarize recent L0 traces into candidate L1 notes
  - cluster related MemoryItems by tags, entities, and repeated phrases
  - produce `TaskCandidate` records from repeated needs, unresolved problems,
    high-energy ideas, scheduled output needs, and user-defined directions
  - require review before promoting task summaries into L2

Initial job types:

```text
MemoryMaintenanceJob
  summarize_recent_session
  refresh_working_summary
  associate_related_items
  mine_task_candidates
  decay_stale_candidates
```

Recommended integration:

- Yes, but after the unified memory item store exists.
- Do not build this directly on raw plan history only; it needs a normalized
  memory layer.

## 3. User-Defined Task Directions

Proposal:

- Add a user-facing module where the user can define Task Center directions.
- The background miner should prioritize those directions when scanning memory
  and knowledge.

Fit with current architecture:

- Strong fit.
- This should become a first-class configuration and UI module, not just a
  prompt string.

Suggested model:

```text
TaskDirection
  id
  title
  description
  priority
  active
  constraints
  keywords
  schedule_frequency
  online_enabled
  output_template
  related_memory_scopes
  created_at
  updated_at
```

Examples:

- product ideas that can be shipped quickly
- monetizable writing topics
- automation opportunities in current workflows
- reusable knowledge products from project notes
- collaboration or client opportunity signals

Recommended integration:

- Add after the first Task Center candidate data model exists.
- The UI should allow create, pause, reprioritize, and archive.
- The current UI already captures schedule frequency, online preference, and
  output-template preference as preview metadata. Hourly custom intervals such
  as `custom:6h` are supported. It does not run a real background scheduler or
  online aggregation yet.
- The miner should produce candidates with an explanation of which direction it
  matched and why.

## 4. Inspiration Capture

Proposal:

- Add an inspiration capture module for scattered, low-friction user input.
- Automatically link captured inspiration to memory and knowledge.
- Mine deeper development, task-output, and monetization paths from the
  inspiration stream.

Fit with current architecture:

- Very strong fit.
- This is a natural L0 input path that can later be promoted into L1/L2 through
  audit.

Suggested model:

```text
InspirationNote
  id
  raw_text
  source
  mood_or_energy
  tags
  linked_memory_ids
  candidate_direction_ids
  status
  created_at
```

Suggested flow:

```text
User captures fragment
  -> store as L0 inspiration
  -> extract tags/entities/questions
  -> link to related memory and knowledge
  -> generate deepening prompts
  -> generate task candidates
  -> review for L1/L2 promotion
```

Recommended integration:

- Build this as an early UI feature because it creates the raw material for the
  rest of the memory system.
- Keep capture friction low: one input, optional tags, no required structure.
- Current implementation stores inspiration as L0 memory and supplements empty
  or single-tag notes with conservative local keyword tags so later association
  and Task Center mining have a lightweight link surface. The first extractor
  covers simple English terms and a small Chinese domain-term list; a later
  version should make this vocabulary configurable from the Intelligence Hub.

## Proposed Implementation Order

1. Add normalized memory item storage.
2. Add inspiration capture into L0 memory.
3. Add manual Task Center directions.
4. Add local association and summary jobs.
5. Add task candidate generation.
6. Add review and promotion into L1/L2.
7. Add model-backed summarization and Task Center mining once deterministic
   scaffolding is stable.

## Experience Records

The first success-reuse and error-avoidance path is manual and conservative.

Supported record types:

- success: reusable positive patterns
- failure: caution records for paths to avoid
- allow: context-specific allow rules
- deny: context-specific deny rules

These records enter L1 Working memory with reviewed local provenance. Automatic
harvesting should wait until deduplication, confidence scoring, and promotion
review are stronger.

## Open Design Decisions

- Whether L0/L1/L2 should be separate physical files/databases or one table with
  scope and level columns.
- How strict the L2 gate should be in Lite mode.
- Whether Task Center mining runs on a timer, app startup, or explicit user
  action first.
- Whether inspiration capture should be a sidebar module, quick command, or
  global hotkey later.
- How to show automatic associations without overwhelming the user.
