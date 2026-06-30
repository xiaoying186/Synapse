# Synapse 0.0.0 Capability Matrix

Status labels:

| Status | Meaning |
| --- | --- |
| usable | Implemented for guarded local use |
| guarded | Implemented only behind explicit review/configuration gates |
| preview-only | Read-only or planning preview; no real external action |
| dry-run | Simulates the action and records contracts/evidence |
| disabled | Intentionally unavailable in this baseline |
| planned | Design direction, not implemented |

| Center | Capability | Status | Current boundary |
| --- | --- | --- | --- |
| Taiheng | Policy preview and dry-run driver enforcement | usable | Plans are classified and risky actions require review |
| Taiheng | Protected snapshots, rollback, audit events, Saga recovery view | guarded | Local state recovery is available for supported objects |
| Taiheng | Release preflight and production readiness | usable | Local Windows release gates are checked before release claims |
| Taiheng | English / Simplified Chinese UI switching | usable | Core shell, language setting, and high-frequency readiness/home surfaces use synchronized translation keys |
| Taiheng | Secret Guard source scan | usable | Read-only local scan for obvious tokens, key files, JWTs, private keys, and populated secret assignments; no automatic mutation |
| Taiheng | Agent repository trust and command safety preview | guarded | Agent Harness dry-runs classify workspace trust, redacted remote-origin metadata, and risky command markers before any guarded execution |
| Taiheng | Cross-domain atomic store/snapshot/audit transaction coverage | guarded | Implemented for current high-risk write paths; broad coverage remains iterative |
| Zhishu | Manual memory, inspiration, experience, knowledge/rule/skill capture | usable | Durable local records with admission metadata |
| Zhishu | Search, relation candidates, maintenance findings | usable | Local metadata-aware retrieval and reviewable relation/maintenance outputs |
| Zhishu | Automatic L2 self-growth | preview-only | Candidate generation exists; durable writes require review |
| Xingtai | Directions, candidate mining, run requests, scheduler tick | usable | Local task loop with approval records and no background execution by default |
| Xingtai | Daily briefing | preview-only | Template and archive flow without live multi-source retrieval |
| Xingtai | Real opportunity-to-execution automation | dry-run | Execution stays local and approval-gated |
| Baigong | Arsenal tool registry and allowlist | usable | Registry and allow-state persistence without arbitrary tool invocation |
| Baigong | Module manifest template | preview-only | Public-safe manifest guidance for capabilities, data sources, permissions, safety gates, and Zhishu admission policy |
| Baigong | Data source registry | preview-only | Lightweight governance registry with disabled Project Radar descriptors; no credentials, no heavy data processing, no live fetch |
| Baigong | Information aggregation | guarded | Fixture/manual/configured HTTP JSON source behind quarantine and review |
| Baigong | Agent Harness and Agent teams | preview-only | Blueprint/dry-run boundaries; real process execution disabled by default |
| Baigong | Browser automation | guarded | Read-only allowlisted inspection only |
| Baigong | Local app bridge | guarded | Canonical app launch receipt only; no arguments or session extraction |
| Baigong | Feishu/WeChat delivery | preview-only | Policy/channel preview only; no webhook delivery |
| Baigong | SMTP email delivery | guarded | Requires config, env credentials, approval, and task-run gates |
| Baigong | Computer diagnostics | preview-only | Read-only diagnostics and archive, no cleanup or system mutation |
| Baigong | Cloud relay as source of truth | disabled | Local export/import remains the source of truth |

This matrix should be updated when a capability moves from preview/dry-run to
real execution.
