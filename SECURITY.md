# Security Policy

Synapse is an early local-first public baseline. Treat automation, Agent,
browser, notification, and data-source behavior as guarded unless the code and
documentation explicitly say otherwise.

## Supported Versions

| Version | Supported |
| --- | --- |
| `0.0.0` | Security reports welcome |

## Security Boundaries

- External delivery is disabled by default.
- Direct Agent execution is disabled by default.
- Feishu and WeChat delivery are preview-only.
- Browser automation is read-only and allowlisted.
- Local app integration is guarded and does not extract session data.
- Data Source Registry does not store credentials.
- Durable L2 knowledge admission requires explicit review.
- Cloud relay is not a source of truth.

## How To Report

Use GitHub private vulnerability reporting if available. If that is not
available, contact the repository owner through GitHub with a minimal
reproduction, impact summary, affected version, and suggested mitigation.

For non-sensitive boundary questions, use the Security Boundary issue template.

## Do Not Include

Do not include secrets.

Do not include any of the following in public issues, pull requests, logs, or
screenshots:

- access tokens, API keys, cookies, private keys, certificates, or webhook URLs;
- SMTP credentials or relay tokens;
- personal documents or private local data;
- sensitive local paths, account names, or machine identifiers;
- internal design documents, private workflows, monetization plans, or
  unpublished module strategies.

## Out Of Scope

Do not use Synapse to bypass permissions, automate third-party accounts without
authorization, exfiltrate local data, evade review gates, or perform destructive
local/system actions.

## Current Disabled Capabilities

The `0.0.0` public baseline does not enable unrestricted Agent execution,
one-click Agent teams, automatic Feishu/WeChat delivery, browser write
automation, automatic cleanup, automatic L2 knowledge writes, or cloud sync as a
source of truth.
