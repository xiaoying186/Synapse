# Codex Task Backlog

Source alignment:

- Internal design: `Synapse Design V6.6`
- Codex backlog source: `Codex待办清单_v2026-06-30.docx`
- Fusion source: `Synapse待融合清单_v2026-06-30.docx`
- Public software baseline: `0.0.0`

This file contains implementation-ready tasks only. Design ideas that still
need evaluation belong in `TODO-SYNAPSE-FUSION.md`.

## P0 - Stabilize Collaboration And Release Baseline

- [ ] Reconcile local `main` with remote `main` after the GitHub API fallback
      push so future work can use normal branch/PR flow.
- [ ] Commit or explicitly discard the repository collaboration baseline files:
      `AGENTS.md`, `TODO-CODEX.md`, `TODO-SYNAPSE-FUSION.md`,
      `docs/codex/`, `docs/design/`, `.gitignore`, and `CHANGELOG.md`.
- [ ] Prepare a `0.0.1` release plan for the bilingual UI installer after the
      branch state is clean.

## P0 - Taiheng Safety Execution Layer

- [x] Implement a Secret Guard preview scanner for API keys, GitHub tokens, SSH
      keys, JWTs, `.env` files, and signing material before commit/push or
      Agent execution. Initial CLI/static-preflight integration is complete;
      UI surfacing remains pending.
- [x] Add an initial command safety classifier for Agent Harness requests:
      dangerous-command detection, credential markers, network markers, package
      install markers, and Git mutation markers. Path boundary checks and
      durable audit records remain pending.
- [x] Add repository trust levels for Agent execution: known workspace,
      unknown workspace, dirty workspace, public repo, private/local-only repo.
- [x] Run Secret Guard in the public baseline GitHub Actions workflow before
      static preflight.
- [x] Surface Secret Guard and repository trust results in Production Readiness
      and Security Center.

## P1 - Baigong Data And Project Radar

- [x] Harden the Data Source Registry preview with owner module, auth policy,
      proxy/network profile, rate limit, health check, adapter kind,
      observation policy, freshness policy, and storage policy fields.
- [x] Add Project Radar preview sources for GitHub Trending, OSSInsight, and
      Hugging Face Trending as read-only/quarantined observations. Live fetch
      adapters remain disabled.
- [x] Add Baigong module manifest templates for capabilities, data sources,
      permissions, and review/admission policy.

## P1 - Product Surface And Maintainability

- [ ] Expand i18n coverage from the shell and high-frequency panels to all
      user-facing feature panels, keeping English and Simplified Chinese keys
      synchronized with `npm.cmd run i18n:check`.
- [ ] Add focused UI smoke coverage for language switching.
- [ ] Continue reducing `src/App.tsx` by moving domain-specific state and
      invoke operations into focused hooks without changing behavior.
- [ ] Extend production readiness checks to report i18n coverage and release
      artifact freshness.

## P2 - Business/Domain Modules

- [ ] Keep A-share Agent integration as guarded preview until Planner, Rule DSL,
      memory admission, and safety gates are ready.
- [ ] Keep rule self-iteration as review-gated preview with weight changes,
      rollback, and audit records.
- [ ] Keep Feishu/WeChat delivery, unrestricted multi-Agent teams, browser write
      automation, and system cleanup out of the public baseline until guardrails
      are implemented and reviewed.

## Execution Rules

- Handle one P0/P1 task at a time.
- Before editing code, state the minimal patch plan, touched files, risks, and
  smallest useful verification command.
- Do not auto-commit or push unless the user explicitly asks for it.
- For UI text changes, run `npm.cmd run i18n:check`.
- For public baseline changes, run `npm.cmd run preflight:static`.
