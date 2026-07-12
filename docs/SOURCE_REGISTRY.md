# Data Source Registry

The Synapse data source registry is a lightweight Baigong/Taiheng governance
layer. It records which data sources are known, which module owns them, and what
safety profile applies before an adapter may use them.

It is not a data warehouse, scraper, crawler, or credential store.

## Guarded Health Checks

Registered sources can run an on-demand health check only after Taiheng enablement review and an exact registry ID/configured URL pairing. Preflight does not start the network. Execution is a separate explicit action and reuses the bounded read-only HTTP adapter: GET only, no redirects, no credentials, five-second timeout, JSON-only response, and a 256 KB limit.

Successful responses become quarantined health observations with Snapshot, Audit, and Saga receipts. They are not trusted facts and cannot enter Zhishu without evidence and admission review. Failed requests create no observation and leave the transaction failed for recovery review.
If final Saga commit fails after an observation is written, Synapse removes that
provisional observation before returning the error, so it cannot appear in the
registry health projection.

The registry projects the newest qualifying health observation back onto each source entry as a recent check timestamp, quarantined-health state, and observation ID. This is operational metadata only; source bodies remain in the quarantined observation store.

When a configured registry ID is supplied to the HTTP adapter, a response may omit `source_id` and inherit that configured identity. If it declares `source_id`, the value must match exactly; mismatches are rejected before any observation, artifact, or knowledge admission is written.

## Minimal Entry Shape

```json
{
  "source_id": "akshare_cn_stock",
  "name": "AkShare A-share data source",
  "type": "financial_market_data",
  "scope": "module_specific",
  "owner_module": "baigong.cn_alphaforge",
  "enabled": false,
  "auth_required": false,
  "network_profile": "default_proxy",
  "rate_limit": "normal",
  "storage_policy": "module_local",
  "shared_config_allowed": true,
  "status": "example-disabled",
  "adapter_kind": "python-adapter-preview",
  "health_check_policy": "on-demand-or-low-frequency",
  "credential_policy": "no-credentials-in-registry",
  "observation_policy": "manual-observation-only",
  "freshness_policy": "review-before-enable",
  "verification_policy": "cross-check-before-use",
  "quarantine_policy": "quarantine-before-zhishu-admission",
  "risk_level": "review-before-enable"
}
```

The bundled example is disabled and preview-only. Domain-specific adapters must
live in their owning Baigong module rather than in the Synapse core.

## Enablement Review

The public baseline exposes a source enablement preflight and an explicit human
review action. The review changes only the local registry approval record; it
does not start a network request, credential read, live fetch, storage write,
or shared-config write. Each review saves the prior approval set as a Taiheng
snapshot, records an audit event, and is tracked by a Saga transaction. If the
approval or audit write fails, the prior approval set is restored.

Before a source can be marked enabled in the registry, the review must require:

- owner module review
- auth policy review
- network profile review
- rate limit review
- storage policy review
- verification plan attachment
- quarantine plan attachment
- anti-injection defense review
- explicit human review

Registry enablement is not a generic network permission. An owning Baigong
adapter must still meet its own allowlist, verification, quarantine, runtime
gate, and task approval requirements before it can retrieve or retain data.

## Project Radar Preview Sources

The public baseline also registers disabled preview descriptors for:

- GitHub Trending project radar
- OSSInsight project radar
- Hugging Face Trending model radar

These entries are read-only governance records. They do not fetch live data,
start crawlers, store credentials, or admit observations into Zhishu without
future quarantine and review gates.

## Guardrails

- No credentials are stored in the registry.
- Authenticated sources require a future Credential Guard integration before
  they can be enabled.
- Health checks are on-demand or low-frequency only.
- Network profiles are references, not embedded proxy secrets.
- Module-local storage is the default.
- Taiheng permission review is required before enabling external or
  authenticated sources.
- Source outputs must pass quarantine, cross-check, and Zhishu admission rules
  before they can influence durable knowledge.
- Every registered source must declare verification and quarantine policy before
  an adapter can use it.

## Forbidden In This Baseline

- background heavy polling.
- Hardcoded domain-specific pipelines in the Synapse core.
- Writing API keys, cookies, tokens, or proxy passwords into registry entries.
- Treating registered sources as trusted evidence without review.
- Bypassing Baigong module ownership or Taiheng policy gates.
