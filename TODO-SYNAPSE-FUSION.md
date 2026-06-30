# Synapse Fusion Backlog

This file tracks design ideas that may later become implementation work. It is
separate from `TODO-CODEX.md`.

Source alignment:

- Internal design: `Synapse Design V6.6`
- Fusion source: `Synapse待融合清单_v2026-06-30.docx`
- Public design summary: `docs/ARCHITECTURE_OVERVIEW.md`

## Current Design Baseline

Synapse V6.6 is organized as one governing core and three centers:

- Taiheng / 太衡: governance, permission, safety, audit, recovery, release gates.
- Zhishu / 智枢: knowledge, memory, reusable skills, admission rules, experience.
- Xingtai / 行台: task directions, planning, schedules, opportunity mining.
- Baigong / 百工: tools, agents, automation, browser, local apps, data sources.

Design principle: low-risk paths may move quickly; high-risk boundaries require
preview, approval, audit, storage rules, and rollback.

## Pending Fusion Items

### 1. Agent Safety Execution Framework

Status: observed, high value

Value: unify unknown-repository detection, command safety, sandbox policy,
credential filtering, safety logs, and rollback around Agent Harness.

Fusion rule: belongs primarily to Taiheng, with execution adapters in Baigong.
No external Agent may bypass permission, credential, path, audit, or rollback
boundaries.

### 2. Repository Trust Level

Status: observed, high value

Value: support automatic decisions for whether Codex/Claude/Gemini/Hermes style
agents can read, write, test, or execute commands in a workspace.

Fusion rule: trust level is an input to Taiheng permission decisions, not a
standalone feature.

### 3. OSSInsight / Project Radar Data Source

Status: observed, high value

Value: feed Xingtai opportunity mining and Baigong information aggregation with
open-source project trend signals.

Fusion rule: implement first as read-only, source-registered, quarantined
observations. Do not add credentials or heavy data processing to the core.

### 4. Baigong Module Templates

Status: pending evaluation

Value: standardize capability manifests, data-source declarations, permissions,
and output admission rules for future tool modules.

Fusion rule: templates should reduce module drift without turning Synapse core
into a plugin-heavy runtime.

### 5. A-Share Agent And Rule Self-Iteration

Status: pending guarded preview

Value: domain-specific planning, Rule DSL, memory linkage, weight learning, and
rollback.

Fusion rule: keep it outside the public baseline until safety, audit, data
source, and admission boundaries are mature.

## Fusion Rules

1. Evaluate design updates separately from code implementation.
2. Do not merge private local paths, credentials, account details, or personal
   workflow records into public docs.
3. Prefer public summaries in `docs/` over full internal documents.
4. Move items into `TODO-CODEX.md` only after they are implementation-ready.
