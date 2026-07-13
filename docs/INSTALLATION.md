# Installation

Synapse `0.0.0` is an early public baseline. Windows users can install guarded
local desktop preview builds from GitHub Releases only when a Windows installer
asset and a matching `.sha256` file are attached. Developers can also run it
from source.

## From GitHub Releases

1. Open the repository's GitHub Releases page.
2. Download the recommended Windows preview installer,
   `Synapse_*_x64-setup.exe`, and the matching `.sha256` file.
3. Verify the installer hash before installing:

```powershell
Get-FileHash .\Synapse_*_x64-setup.exe -Algorithm SHA256
Get-Content .\Synapse_*_x64-setup.exe.sha256
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

## Local Production Deployment

For private local use, keep the source checkout separate from the installed
application. Synapse stages verified local releases beneath `E:\Synapse` by
default, without modifying local knowledge or settings. See
[LOCAL_DEPLOYMENT.md](LOCAL_DEPLOYMENT.md) for the staging and explicit install
commands.

## Installer Status

Windows NSIS packaging is the default public preview route and should only be
distributed after:

- `npm.cmd run preflight:release` passes;
- `npm.cmd run tauri:build:release` creates an NSIS installer matching the
  current public version;
- the installer is code-signed and verified before SHA-256 hash generation;
- `npm.cmd run release:acceptance` verifies the installer and SHA-256 hash;
- `npm.cmd run release:smoke:installer` installs, launches, and uninstalls the
  NSIS installer successfully;
- release notes are generated from `CHANGELOG.md`.

Maintainers can use the manual `Synapse Manual Release` GitHub Actions workflow
at `.github/workflows/manual-release.yml` to package and publish a versioned
installer. The workflow is not triggered by ordinary pushes to `main`; it
requires a manual `workflow_dispatch` version input and refuses to overwrite an
existing tag. Signed releases require Windows code-signing secrets; unsigned
preview releases must be explicitly allowed by the workflow input.

MSI artifacts, when present, are administrator or enterprise deployment
candidates. Debug MSI artifacts and debug NSIS artifacts are packaging
rehearsals and must not be distributed as official releases.

## What This Baseline Does Not Install

Synapse `0.0.0` does not install background services, browser extensions,
system cleanup tools, cloud sync agents, or automatic update services.

## Uninstall And Local Data

Removing the app does not necessarily remove local prototype data. See
[LOCAL_DATA_AND_PRIVACY.md](LOCAL_DATA_AND_PRIVACY.md) for the local data
directory and privacy boundaries.
