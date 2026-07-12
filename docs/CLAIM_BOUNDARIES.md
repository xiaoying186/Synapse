# Claim Boundaries

Synapse `0.0.0` is a guarded local-first public baseline. Public descriptions
should be precise about what is usable, preview-only, guarded, or disabled.

| Area | Current state | Public boundary |
| --- | --- | --- |
| Agent execution | Disabled by default / guarded | Adapter smoke and real-execution preflight are path/contract previews only, start no process, and send no task content; backend execution is also blocked unless `[safety].agent_execution_enabled` is explicitly enabled. Do not claim unrestricted or one-click Agent execution |
| Agent teams | Dry-run / fake harness | Budgeted/cancellable local fake receipts only; do not claim real multi-Agent process orchestration |
| Feishu / WeChat | Dry-run / mock-only | Optional loopback mock endpoint testing with retry/error classification only; do not claim automatic or real webhook delivery |
| Email | Guarded | Requires configuration, credentials outside Git, and explicit approval |
| Browser automation | Read-only / allowlisted | Do not claim form submission, uploads, downloads, purchases, or arbitrary scripts |
| Local app bridge | Guarded | Do not claim session extraction or arbitrary app control |
| Computer diagnostics | Read-only | Do not claim cleanup, repair, deletion, registry writes, or system setting changes |
| L2 memory admission | Review-gated | Do not claim automatic durable knowledge writes |
| Data Source Registry | Guarded preview | Do not claim credentials, live fetch, heavy processing, automatic source enablement, or trusted evidence; manual registry approval does not itself authorize an adapter to fetch or retain data |
| Information aggregation | Guarded preview | Do not claim current external facts, automatic trusted summaries, automatic delivery, or durable Zhishu admission |
| Device sync | Guarded local package | Do not claim cloud sync as a source of truth |

When a capability moves between states, update this file, `docs/CAPABILITY_MATRIX.md`,
README, and the release checklist together.
