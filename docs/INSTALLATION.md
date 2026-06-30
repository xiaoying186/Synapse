# Installation

Synapse `0.0.0` is an early public baseline. It is currently best used by
developers from source.

## From Source

```powershell
git clone https://github.com/xiaoying186/Synapse.git
cd Synapse
npm.cmd ci
npm.cmd run tauri:dev
```

## Installer Status

Windows MSI packaging is configured, but a public installer should only be
distributed after:

- `npm.cmd run preflight:release` passes;
- `npm.cmd run tauri:build` creates an MSI matching the current public version;
- `npm.cmd run release:evidence` records the MSI and SHA-256 hash;
- release notes clearly state whether the installer is signed or unsigned.

Debug MSI artifacts are packaging rehearsals and must not be distributed as
official releases.

## What This Baseline Does Not Install

Synapse `0.0.0` does not install background services, browser extensions,
system cleanup tools, cloud sync agents, or automatic update services.

## Uninstall And Local Data

Removing the app does not necessarily remove local prototype data. See
[LOCAL_DATA_AND_PRIVACY.md](LOCAL_DATA_AND_PRIVACY.md) for the local data
directory and privacy boundaries.
