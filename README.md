# Synapse

Synapse is a local-first personal cognitive kernel and guarded desktop
automation prototype built with Tauri, React, TypeScript, and Rust.

Current public version: `0.0.0`
Public stage: `Initial Public Baseline`
Internal design alignment: `Synapse Design V6.6`

Synapse `0.0.0` is the Synapse 0.0.0 Public Baseline for guarded local desktop
use, local development, and review. It is a guarded local-first baseline, not a
stable end-user automation release.

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
- Guarded Windows installer packaging path through manual GitHub Releases,
  with SHA-256 verification when a release asset is attached.
- Application-level English / Simplified Chinese language switching with
  synchronized translation-key checks.

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
- a signed public installer release.

See [docs/CLAIM_BOUNDARIES.md](docs/CLAIM_BOUNDARIES.md) for the precise public
claim boundaries.

## Quick Start

For Windows desktop use, download an installer from
[GitHub Releases](https://github.com/xiaoying186/Synapse/releases) only when a
release includes a Windows installer asset and a matching `.sha256` file.
The recommended public preview installer is the NSIS `Synapse_*_x64-setup.exe`
because it installs for the current user without administrator rights. MSI
artifacts, when present, are administrator or enterprise deployment candidates.
Verify the checksum before installing. Current public installers are unsigned
unless the release notes explicitly say otherwise.

For development from source, install Node.js, Rust stable MSVC, WebView2, and
the Tauri prerequisites for Windows.

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
distribution is limited to guarded GitHub Releases and desktop installers.

## Documentation

- [Architecture overview](docs/ARCHITECTURE_OVERVIEW.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Claim boundaries](docs/CLAIM_BOUNDARIES.md)
- [Config capability matrix](docs/CONFIG_CAPABILITY_MATRIX.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Installation guide](docs/INSTALLATION.md)
- [Local data and privacy](docs/LOCAL_DATA_AND_PRIVACY.md)
- [Public baseline status](docs/PUBLIC_BASELINE_STATUS.md)
- [Production gap matrix](docs/PRODUCTION_GAP_MATRIX.md)
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

The repository includes local release evidence tooling:

```powershell
npm.cmd run preflight:release
npm.cmd run release:evidence
npm.cmd run release:status -- --json
npm.cmd run release:doctor -- --json
```

Maintainers can publish a versioned Windows installer with the manual
`Synapse Manual Release` GitHub Actions workflow
(`.github/workflows/manual-release.yml`). Trigger it from the Actions tab, enter
a SemVer-style version such as `0.0.1`, and verify that it creates a
`v{version}` release with installer assets, matching `.sha256` files, installer
smoke-test evidence, and release notes generated from `CHANGELOG.md`. The
workflow builds the NSIS current-user installer as the default distributable.
Unless `allow_unsigned` is explicitly enabled for preview testing, it requires
`WINDOWS_SIGNING_CERT_BASE64` and `WINDOWS_SIGNING_CERT_PASSWORD` repository
secrets before it will publish a Windows installer.

The checked-in source remains on the `0.0.0` public baseline unless a separate
version-bump commit is intentionally made. The manual release workflow
temporarily synchronizes `package.json`, `src-tauri/tauri.conf.json`, and
`src-tauri/Cargo.toml` in the runner workspace before packaging. Debug MSI or
NSIS artifacts must not be distributed as official releases.
