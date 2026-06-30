# Synapse

Synapse is a local-first personal cognitive kernel and guarded desktop
automation prototype built with Tauri, React, TypeScript, and Rust.

Current public version: `0.0.0`
Public stage: `Initial Public Baseline`
Internal design alignment: `Synapse Design V6.6`

Synapse `0.0.0` is the Synapse 0.0.0 Public Baseline for local development and
guarded review. It is a guarded local-first baseline, not a stable end-user
automation release.

## Architecture

Synapse is organized around one governing core and three product centers:

- Taiheng / Governance Core: mode, permission, safety, recovery, release gates,
  audit, and cross-domain coordination.
- Zhishu / Intelligence Hub: knowledge, memory, reusable skills, admission
  rules, experience, and project/user self-image material.
- Xingtai / Action Desk: task directions, scheduling, planning previews,
  opportunity mining, project progress, and reviewable outputs.
- Baigong / Arsenal: tools, agents, local automation, browser automation, data
  source registration, information aggregation, and extension modules.

Some code paths still use compatibility names such as `task_center` and
`arsenal`. Public documentation should treat them as implementation labels under
Xingtai and Baigong.

## What Works Today

- Local plan preview, policy preview, audit preview, and guarded review flows.
- Local memory and Zhishu capture with review/admission metadata.
- Xingtai task directions, candidate mining, scheduler preview, and local run
  records.
- Baigong tool registry and allowlist previews.
- Read-only information/source health previews with quarantine boundaries.
- Library Home, Production Readiness, Saga Recovery, and Security Center panels.
- Preview-only Data Source Registry governance metadata.

See [docs/CAPABILITY_MATRIX.md](docs/CAPABILITY_MATRIX.md) for the full public
capability matrix.

## Do Not Claim In This Baseline

Synapse `0.0.0` does not ship:

- unrestricted Agent execution;
- one-click real multi-Agent teams;
- automatic Feishu or WeChat delivery;
- browser write automation, form submission, uploads, downloads, or arbitrary
  scripts;
- automatic cleanup, file deletion, registry writes, or system maintenance;
- automatic durable L2 knowledge admission without review;
- cloud sync as a source of truth;
- a signed or verified public installer release.

See [docs/CLAIM_BOUNDARIES.md](docs/CLAIM_BOUNDARIES.md) for the precise public
claim boundaries.

## Quick Start

Install Node.js, Rust stable MSVC, WebView2, and the Tauri prerequisites for
Windows.

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run tauri:dev
```

Useful checks:

```powershell
npm.cmd run preflight:static
npm.cmd run preflight
npm.cmd run smoke:ui
cd src-tauri
cargo check --offline
```

Synapse is not published as an npm package. `package.json` keeps
`"private": true`; npm scripts are development/build entry points. Public
distribution should happen through GitHub releases and desktop installers once
release evidence is ready.

## Documentation

- [Architecture overview](docs/ARCHITECTURE_OVERVIEW.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Claim boundaries](docs/CLAIM_BOUNDARIES.md)
- [Config capability matrix](docs/CONFIG_CAPABILITY_MATRIX.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Installation guide](docs/INSTALLATION.md)
- [Local data and privacy](docs/LOCAL_DATA_AND_PRIVACY.md)
- [Public baseline status](docs/PUBLIC_BASELINE_STATUS.md)
- [Public roadmap](docs/PUBLIC_ROADMAP.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Release distribution notes](docs/RELEASE_DISTRIBUTION_NOTES.md)
- [Source registry boundary](docs/SOURCE_REGISTRY.md)
- [Versioning policy](VERSIONING.md)
- [Changelog](CHANGELOG.md)

## Public Repository Policy

- Issues are welcome for bugs, public feature requests, documentation fixes,
  and security-boundary questions.
- Pull requests should stay small and pass the checklist in
  [.github/pull_request_template.md](.github/pull_request_template.md).
- Contribution expectations are documented in [CONTRIBUTING.md](CONTRIBUTING.md).
- Security-sensitive reports should follow [SECURITY.md](SECURITY.md).
- Do not submit secrets, webhook URLs, SMTP credentials, private workflows,
  generated local data, internal design documents, monetization plans, or local
  path notes.

## Release Status

The repository includes release evidence tooling:

```powershell
npm.cmd run preflight:release
npm.cmd run release:evidence
npm.cmd run release:status -- --json
npm.cmd run release:doctor -- --json
```

At the current baseline, a public GitHub release should wait until a release MSI
matching `0.0.0` is built, reviewed, hashed, and documented. Debug MSI artifacts
must not be distributed as official releases.
