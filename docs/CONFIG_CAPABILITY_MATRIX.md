# Synapse Config Capability Matrix

This matrix records which `synapse.config.toml` areas are active in Synapse
`0.0.0`, which are preview-only, and which are reserved for later work.

| Config area | Status | Effective today | Boundary |
| --- | --- | --- | --- |
| `[app]` | active | yes | App name, instance identity, and local mode metadata |
| `[mode]` | active | yes | Runtime mode, execution level, failure strategy, and step limits |
| `[safety] external_delivery_enabled` | active | yes | Release gates require it off by default |
| `[safety] agent_execution_enabled` | active | yes | Controls Agent Harness/teams capability state |
| `[safety] script_execution_enabled` | active | yes | Independently controls hash-locked Skill Library script execution; release baseline requires false |
| `[storage] data_dir` | active | yes | A non-empty relative path without `..`, or a local absolute disk path such as `E:\Synapse\.synapse`. UNC/network paths and disk roots are rejected. Installed desktop builds resolve relative paths under the current user's AppData, while development fallback resolves them under the project root. Defaults to `.synapse`. The Settings page can preview and save this low-risk field with a synchronized local backup and atomic replacement; restart is required. |
| `[scheduler]` | active | yes | Manual/background lease and safety status; background execution remains gated |
| `[aggregation]` | active | partial | Fixture/manual/configured HTTP JSON source behind quarantine; `http_cross_check_urls` requires independent configured sources before a live Daily Briefing fetch |
| `[browser]` | preview | partial | Read-only allowlist and inspection settings only |
| `[notifications.email]` | guarded | partial | SMTP delivery requires config, env credentials, and approval gates |
| `[notifications.feishu]` | preview | no delivery | Webhook URL must remain empty for the baseline release gate |
| `[notifications.wechat]` | preview | no delivery | Webhook URL must remain empty for the baseline release gate |
| `[sync]` | guarded-local | partial | Local export/import packages; relay upload is dry-run only |
| `[sandbox]` | active | yes | Used by policy/status display and guardrail checks |
| Data source registry entries | preview | no live fetch | Registry is a governance layer; adapters own real retrieval later |

When adding a config field, update this matrix and the production preflight if
the field affects release safety.

The Settings page only edits low-risk local fields: mode, data directory, and
scheduler cadence. External delivery, Agent execution, script execution, and
relay controls remain outside the UI editor and behind their existing Taiheng
gates.
