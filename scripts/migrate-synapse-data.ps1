[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)]
  [string]$SourceDataRoot,

  [Parameter(Mandatory)]
  [string]$DestinationDataRoot,

  [switch]$ConfirmMigration
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmMigration) {
  throw "Migration only copies data after explicit confirmation. Re-run with -ConfirmMigration."
}

$source = (Resolve-Path -LiteralPath $SourceDataRoot -ErrorAction Stop).Path
$destination = [IO.Path]::GetFullPath($DestinationDataRoot)
if ($source.TrimEnd('\\') -eq $destination.TrimEnd('\\')) {
  throw "Source and destination data roots must be different."
}
if ($destination.StartsWith('\\')) {
  throw "Network and UNC data roots are not supported. Choose a local disk path."
}
$diskRoot = [IO.Path]::GetPathRoot($destination)
if ($diskRoot -and $destination.TrimEnd('\\') -eq $diskRoot.TrimEnd('\\')) {
  throw "Destination must be a dedicated directory below a local disk root."
}
if (Test-Path -LiteralPath $destination) {
  $existing = Get-ChildItem -LiteralPath $destination -Force -ErrorAction Stop | Select-Object -First 1
  if ($existing) {
    throw "Destination must be empty: $destination"
  }
}

$parent = Split-Path -Parent $destination
$leaf = Split-Path -Leaf $destination
$staging = Join-Path $parent ".${leaf}.incoming-$([guid]::NewGuid().ToString('N'))"
$sourceFiles = Get-ChildItem -LiteralPath $source -Recurse -File -Force
$sourceBytes = ($sourceFiles | Measure-Object -Property Length -Sum).Sum

if (-not $PSCmdlet.ShouldProcess($destination, "copy and verify Synapse .synapse data root")) {
  return
}

New-Item -ItemType Directory -Force -Path $staging | Out-Null
foreach ($item in Get-ChildItem -LiteralPath $source -Force) {
  Copy-Item -LiteralPath $item.FullName -Destination $staging -Recurse -Force
}

foreach ($sourceFile in $sourceFiles) {
  $relative = $sourceFile.FullName.Substring($source.Length).TrimStart('\\')
  $targetFile = Join-Path $staging $relative
  if (-not (Test-Path -LiteralPath $targetFile)) {
    throw "Migration verification failed: missing $relative"
  }
  $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash
  $targetHash = (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash
  if ($sourceHash -ne $targetHash) {
    throw "Migration verification failed: hash mismatch for $relative"
  }
}

Move-Item -LiteralPath $staging -Destination $destination

$receipt = [ordered]@{
  schema_version = 1
  state = "copied-and-hash-verified-awaiting-config-switch"
  completed_at = Get-Date -Format "o"
  source_data_root = $source
  destination_data_root = $destination
  file_count = $sourceFiles.Count
  byte_count = $sourceBytes
  source_preserved = $true
  config_changed = $false
  next_step = "Set storage.data_dir to the destination in Synapse Settings, save, then restart."
}
$receiptPath = Join-Path $destination "migration-receipt.json"
$receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receiptPath -Encoding utf8

Write-Host "[PASS] Synapse data copied and hash-verified: $destination"
Write-Host "[INFO] Source was preserved: $source"
Write-Host "[INFO] Update storage.data_dir in Synapse Settings, then restart."
