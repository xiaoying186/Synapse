# Data Source Registry

The Synapse data source registry is a lightweight Baigong/Taiheng governance
layer. It records which data sources are known, which module owns them, and what
safety profile applies before an adapter may use them.

It is not a data warehouse, scraper, crawler, or credential store.

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
  "risk_level": "review-before-enable"
}
```

The bundled example is disabled and preview-only. Domain-specific adapters must
live in their owning Baigong module rather than in the Synapse core.

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

## Forbidden In This Baseline

- background heavy polling.
- Hardcoded domain-specific pipelines in the Synapse core.
- Writing API keys, cookies, tokens, or proxy passwords into registry entries.
- Treating registered sources as trusted evidence without review.
- Bypassing Baigong module ownership or Taiheng policy gates.
