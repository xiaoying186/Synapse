# Development

This guide is for developers running Synapse from source.

## Requirements

- Windows 10/11.
- Node.js 22 or newer.
- Rust stable MSVC toolchain.
- Microsoft WebView2 Runtime.
- Tauri CLI through the checked-in npm scripts.
- WiX v3/v4 only when building MSI installers.

## Install Dependencies

```powershell
npm.cmd ci
cd src-tauri
cargo fetch
```

If Cargo is used offline, make sure the Rust target and crate cache are already
available:

```powershell
rustup show
rustup target list --installed
cargo check --offline
```

## Run Locally

```powershell
npm.cmd run tauri:dev
```

The frontend dev server is started by the Tauri dev command.

## Useful Checks

```powershell
npm.cmd run preflight:static
npm.cmd run secret:scan
npm.cmd run i18n:check
npm.cmd run build
npm.cmd run preflight
npm.cmd run smoke:ui
cd src-tauri
cargo fmt --check
cargo check --offline
```

## Windows Release Tooling

Run the WiX diagnostic before attempting MSI packaging:

```powershell
npm.cmd run wix:diagnose
```

If WiX is installed outside the normal PATH, add it for the current shell:

```powershell
$env:PATH = "F:\WiX\wix314;" + $env:PATH
```

Tauri may still require its own cached WiX bundle for MSI packaging. If
`npm.cmd run tauri:build` tries to download `wix314-binaries.zip`, pre-cache the
bundle in a network-enabled release environment before claiming MSI readiness.

## Common Boundaries

- Do not enable external delivery by default.
- Do not enable direct Agent execution by default.
- Do not add browser write automation without explicit guardrail review.
- Keep user-facing UI copy bilingual. Add English and Simplified Chinese keys
  together under `src/i18n/translations.ts`, use the design-document names
  Taiheng / 太衡, Zhishu / 智枢, Xingtai / 行台, and Baigong / 百工, and run
  `npm.cmd run i18n:check` before committing UI text changes.
- Do not commit `.synapse/`, `.tmp/`, `dist/`, `target/`, local databases, MSI
  artifacts, or secrets.
