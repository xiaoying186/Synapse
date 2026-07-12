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
| Taiheng | English / Simplified Chinese UI switching | usable | Core shell, language setting, high-frequency readiness/home surfaces, and the runtime capability-map identifiers/states/details use synchronized translation keys or dynamic-text mappings |
| Taiheng | Secret Guard source scan | usable | Read-only local scan for obvious tokens, key files, JWTs, private keys, and populated secret assignments; surfaced in preflight, Production Readiness, and Security Center; no automatic mutation |
| Taiheng | Agent repository trust and command safety preview | guarded | Agent Harness dry-runs classify workspace trust, redacted remote-origin metadata, and risky command markers before any guarded execution |
| Taiheng | Cross-domain atomic store/snapshot/audit transaction coverage | guarded | Implemented for current high-risk write paths; broad coverage remains iterative |
| Taiheng | Permission Memory reuse gates | guarded | Reusable approval candidates are preview-only until same scope, same tool scope, fresh audit reference, expiry check, explicit review, and high-risk denial gates pass; no policy-engine auto-grant or durable policy write starts by default |
| Zhishu | Manual memory, inspiration, experience, knowledge/rule/skill capture | usable | Durable local records with admission metadata |
| Zhishu | Search, relation candidates, maintenance findings | usable | Local metadata-aware retrieval and reviewable relation/maintenance outputs |
| Zhishu | Automatic L2 self-growth | guarded-preview | Candidate generation and codebase structural admission preflight exist; durable writes require source scope review, index freshness confirmation, human summary review, and Zhishu admission approval |
| Xingtai | Directions, candidate mining, run requests, scheduler tick | usable | Local task loop with approval records, artifact indexing, review-gated L1 admission, and no background execution by default |
| Xingtai | Daily briefing | guarded | Template, fixture-backed evidence contract, evidence validation, provider-specific live-source gates, source quarantine, and reviewed archive flow are available. Approved configured multi-source HTTP cross-checks now write Saga, Snapshot, and a network-intent audit before fetch, quarantine observations and artifacts, then compensate them on later persistence failures. Zhishu admission and automatic delivery remain blocked pending separate review gates. |
| Xingtai | Real opportunity-to-execution automation | dry-run | Execution stays local and approval-gated |
| Baigong | Arsenal tool registry and allowlist | usable | Registry and allow-state persistence without arbitrary tool invocation |
| Baigong | Module manifest template | preview-only | Public-safe manifest guidance for capabilities, data sources, permissions, safety gates, and Zhishu admission policy |
| Baigong / Zhishu | Skill and script library execution | guarded | Versioned manifests include a built-in read-only system inventory PowerShell adapter compiled into the application and verified against a fixed SHA-256, so installed builds do not depend on source-tree paths. Execution is disabled by default, requires an approved Task Run plus explicit confirmation, accepts no user arguments, enforces a 30-second process-tree timeout, validates no-mutation/no-network JSON output, and records quarantined artifact, snapshot, audit, and Saga receipts. Durable Zhishu admission remains a separate review. |
| Baigong | Data source registry | guarded | Lightweight governance registry with reviewed local enablement, exact configured ID/URL pairing, response identity matching, two-step on-demand health checks through the bounded read-only HTTP adapter, quarantined observations, Taiheng snapshot/audit/Saga receipts, and failure compensation; no credentials, background polling, or trusted evidence admission |
| Baigong | Information aggregation | guarded | Fixture/manual/configured HTTP JSON source behind quarantine, evidence validation, provider adapter loopback receipts, source SHA-256, provider receipt admission preflight, provider receipt review queue preview, local staged review candidates with snapshot/audit/saga evidence, human review decisions, task artifact preflight, isolated task artifact staging, provider artifact Zhishu admission preflight, dedicated admission review, candidate-only Zhishu receipt creation, cross-check/conflict review, and no confirmed knowledge write without a separate final review |
| Baigong | Agent Harness and Agent teams | guarded | Agent Harness dry-runs, denied-by-default preflight, fake/staging receipts, and guarded Codex team execution are local, budgeted, asynchronously executed, operator-cancellable, timeout-terminated, and quarantine-only. Real teams write a Saga and Task Run rollback snapshot before process start, preserve partial quarantined evidence, record a domain audit with the final team artifact, and commit only after all durable evidence succeeds. Execution remains blocked by `[safety].agent_execution_enabled` plus final human approval; non-Codex adapters remain denied until each has a guarded contract. |
| Baigong | Browser automation | guarded | Read-only allowlisted inspection only; browser write actions expose a blocked staging preflight and remain denied by a visible action policy requiring allowlist, explicit approval, anti-injection, audit, quarantine, and rollback before future enablement |
| Baigong | Local app bridge | guarded | App allow/block reviews are snapshotted, audited, Saga-tracked, and compensated on later persistence failure. Canonical launch preview, preflight gates, and receipt-bearing execution require an allowlisted app, approved Task Run, explicit confirmation, artifact plus audit persistence, with no user arguments, credential read, window-content read, or session extraction. If receipt persistence fails after spawn, Synapse removes any provisional artifact and terminates the child process. |
| Baigong | Feishu/WeChat delivery | guarded | Policy/channel preview, loopback staging, and official HTTPS production adapters are approval- and signature-gated. Production delivery reserves a durable idempotency attempt and records a delivery-intent audit before network access, records provider acceptance before artifact/final-audit persistence, blocks duplicate keys in every state, and marks transport errors outcome-uncertain for manual reconciliation instead of automatic resend. No production delivery starts without final approval, external-delivery gate, official endpoint scope, redaction, and audit. |
| Baigong | SMTP email delivery | guarded | Requires config, env credentials, approval, and task-run gates |
| Baigong | Computer diagnostics and cleanup gates | guarded dry-run | Read-only diagnostics, archive, safe-cleanup dry-run candidates, and real-cleanup preflight gates for restore point, approval, audit, rollback, and admin review; no deletion, registry write, process kill, or system mutation |
| Baigong | Device sync import and relay | guarded | Local export/import uses schema, SHA-256 integrity, base-hash conflict detection, explicit replace approval, rollback snapshot, audit, and import-apply preflight; relay remains dry-run and never becomes the source of truth |
| Baigong | Cloud relay as source of truth | disabled | Local export/import remains the source of truth |

This matrix should be updated when a capability moves from preview/dry-run to
real execution.
