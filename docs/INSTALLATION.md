# Installation

Synapse `0.0.0` is an early public baseline. Windows users can install the
guarded local desktop build from GitHub Releases when a `Synapse_0.0.0_*.msi`
asset is attached. Developers can also run it from source.

## From GitHub Releases

1. Open the repository's GitHub Releases page.
2. Download `Synapse_0.0.0_x64_en-US.msi` and the matching `.sha256` file.
3. Verify the MSI hash before installing:

```powershell
Get-FileHash .\Synapse_0.0.0_x64_en-US.msi -Algorithm SHA256
Get-Content .\Synapse_0.0.0_x64_en-US.msi.sha256
```

The two SHA-256 values must match.

The initial public baseline installer is unsigned unless the release notes say
otherwise. Windows may show an unknown-publisher warning for unsigned builds.

## From Source

```powershell
git clone https://github.com/xiaoying186/Synapse.git
cd Synapse
npm.cmd ci
npm.cmd run tauri:dev
```

## Installer Status

Windows MSI packaging is configured and should only be distributed after:

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
