# Claim Boundaries

Synapse `0.0.0` is a guarded local-first public baseline. Public descriptions
should be precise about what is usable, preview-only, guarded, or disabled.

| Area | Current state | Public boundary |
| --- | --- | --- |
| Agent execution | Disabled by default / guarded | Do not claim unrestricted or one-click Agent execution |
| Agent teams | Preview-only | Do not claim real multi-Agent process orchestration |
| Feishu / WeChat | Preview-only | Do not claim automatic delivery |
| Email | Guarded | Requires configuration, credentials outside Git, and explicit approval |
| Browser automation | Read-only / allowlisted | Do not claim form submission, uploads, downloads, purchases, or arbitrary scripts |
| Local app bridge | Guarded | Do not claim session extraction or arbitrary app control |
| Computer diagnostics | Read-only | Do not claim cleanup, repair, deletion, registry writes, or system setting changes |
| L2 memory admission | Review-gated | Do not claim automatic durable knowledge writes |
| Data Source Registry | Preview-only | Do not claim credentials, live fetch, heavy processing, or trusted evidence |
| Device sync | Guarded local package | Do not claim cloud sync as a source of truth |

When a capability moves between states, update this file, `docs/CAPABILITY_MATRIX.md`,
README, and the release checklist together.
