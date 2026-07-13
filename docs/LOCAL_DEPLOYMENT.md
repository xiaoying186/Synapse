# Local Production Deployment

Synapse development source remains in `S:\My\Synapse2.0`. Local production
releases are staged under `E:\Synapse`, so building and daily use do not share
the same directory.

```text
E:\Synapse\
  app\        # installed Synapse binaries (only changed with -Install)
  releases\   # immutable, versioned installer copies and SHA-256 files
  userdata\   # local knowledge, memory, and application data
  config\     # local deployment configuration
  plugins\    # Baigong extensions
  models\     # local model assets
  logs\       # local logs
  backups\    # user-managed backups
```

`userdata`, `config`, `plugins`, `models`, `logs`, and `backups` are never
deleted or replaced by the release staging command.

## Stage A Verified Release

After a release installer has passed the release acceptance and installer smoke
checks, stage it locally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy-local-release.ps1 `
  -InstallerPath .\src-tauri\target\release\bundle\nsis\Synapse_0.0.3_x64-setup.exe `
  -Version 0.0.3
```

This writes the installer, its SHA-256 sidecar, and `release-manifest.json` to
`E:\Synapse\releases\v0.0.3`. Check the hash before installing:

```powershell
Get-FileHash E:\Synapse\releases\v0.0.3\Synapse_0.0.3_x64-setup.exe -Algorithm SHA256
Get-Content E:\Synapse\releases\v0.0.3\Synapse_0.0.3_x64-setup.exe.sha256
```

## Optional Local Installation

To install a staged NSIS preview package under `E:\Synapse\app`, add
`-Install`. The command refuses to replace an existing application directory
and does not migrate or delete user data.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy-local-release.ps1 `
  -InstallerPath .\src-tauri\target\release\bundle\nsis\Synapse_0.0.3_x64-setup.exe `
  -Version 0.0.3 `
  -Install
```

For an upgrade, first uninstall or deliberately archive the existing
`E:\Synapse\app` application directory, then run the explicit installation
command. Do not delete the separate user data directories as part of an
application upgrade.

The public preview installer can be unsigned. Treat Windows publisher warnings
as a release-boundary signal: verify its SHA-256 and use it only when the
installer came from a release you trust.
