[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)]
  [string]$InstallerPath,

  [Parameter(Mandatory)]
  [string]$Version,

  [string]$DeploymentRoot = "E:\Synapse",

  [switch]$Install
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$') {
  throw "Version '$Version' must use a SemVer-like format, such as 0.0.3."
}

$installer = Get-Item -LiteralPath $InstallerPath -ErrorAction Stop
if ($installer.Extension -notin @(".exe", ".msi")) {
  throw "Installer must be a Windows .exe or .msi file: $($installer.FullName)"
}

$releaseDirectory = Join-Path $DeploymentRoot (Join-Path "releases" "v$Version")
$appDirectory = Join-Path $DeploymentRoot "app"
$dataDirectories = @("userdata", "config", "plugins", "models", "logs", "backups") |
  ForEach-Object { Join-Path $DeploymentRoot $_ }

if ($PSCmdlet.ShouldProcess($releaseDirectory, "stage local release v$Version")) {
  New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
  foreach ($directory in $dataDirectories) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
}

$stagedInstaller = Join-Path $releaseDirectory $installer.Name
if (Test-Path -LiteralPath $stagedInstaller) {
  $sourceHash = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash
  $stagedHash = (Get-FileHash -LiteralPath $stagedInstaller -Algorithm SHA256).Hash
  if ($sourceHash -ne $stagedHash) {
    throw "A different installer is already staged for v${Version}: $stagedInstaller"
  }
} elseif ($PSCmdlet.ShouldProcess($stagedInstaller, "copy verified installer")) {
  Copy-Item -LiteralPath $installer.FullName -Destination $stagedInstaller -Force
}

$sha256 = (Get-FileHash -LiteralPath $stagedInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
$shaPath = "$stagedInstaller.sha256"
if ($PSCmdlet.ShouldProcess($shaPath, "write SHA-256 sidecar")) {
  "$sha256  $($installer.Name)" | Set-Content -LiteralPath $shaPath -Encoding ascii
}

$manifest = [ordered]@{
  schema_version = 1
  product = "Synapse"
  version = $Version
  staged_at = Get-Date -Format "o"
  installer = $installer.Name
  installer_sha256 = $sha256
  source_path = $installer.FullName
  deployment_root = $DeploymentRoot
  application_path = $appDirectory
  data_paths_preserved = $dataDirectories
  installation_requested = [bool]$Install
}
$manifestPath = Join-Path $releaseDirectory "release-manifest.json"
if ($PSCmdlet.ShouldProcess($manifestPath, "write local release manifest")) {
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8
}

if ($Install) {
  if ($installer.Extension -ne ".exe") {
    throw "Local application installation currently supports the NSIS .exe installer only. The package was staged but not installed."
  }
  if (Test-Path -LiteralPath (Join-Path $appDirectory "synapse.exe")) {
    throw "Existing application found at $appDirectory. Uninstall or move it before running again; user data was not touched."
  }
  if ($PSCmdlet.ShouldProcess($appDirectory, "install Synapse v$Version without touching user data")) {
    New-Item -ItemType Directory -Force -Path $appDirectory | Out-Null
    Start-Process -FilePath $stagedInstaller -ArgumentList @("/S", "/D=$appDirectory") -Wait -NoNewWindow
    $installedExe = Join-Path $appDirectory "synapse.exe"
    if (-not (Test-Path -LiteralPath $installedExe)) {
      throw "Installer finished but Synapse executable was not found at $installedExe."
    }
  }
}

Write-Host "[PASS] Local release staged: $releaseDirectory"
Write-Host "[PASS] SHA-256: $sha256"
Write-Host "[INFO] Application directory: $appDirectory"
Write-Host "[INFO] User data directories are separate and were not modified."
