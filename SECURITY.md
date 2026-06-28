# Security Policy

Synapse is an early local-first public baseline. Please treat all automation,
Agent, browser, notification, and data-source behavior as guarded unless the
code and documentation explicitly say otherwise.

## Supported Version

| Version | Supported |
| --- | --- |
| `0.0.0` | Security reports welcome |

## Baseline Safety Defaults

- External delivery is disabled by default.
- Direct Agent execution is disabled by default.
- Feishu and WeChat delivery are preview-only.
- Browser automation is read-only and allowlisted.
- Local app integration is guarded and does not extract session data.
- Data Source Registry does not store credentials.
- Durable L2 knowledge admission requires review.

## Reporting A Vulnerability

Please open a private security advisory if available, or contact the repository
owner through GitHub with a minimal reproduction and impact summary.

Do not include secrets, access tokens, private keys, webhook URLs, personal
documents, or sensitive local paths in public issues.

## Out Of Scope

Please do not use Synapse to bypass permissions, automate third-party accounts
without authorization, exfiltrate local data, evade review gates, or perform
destructive local/system actions.
