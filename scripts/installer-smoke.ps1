$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$bundleRoot = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis"
$evidenceRoot = Join-Path $projectRoot ".tmp\release-evidence"
$evidencePath = Join-Path $evidenceRoot "installer-smoke.json"
$windowScreenshotPath = Join-Path $evidenceRoot "installer-window.png"
$installer = Get-ChildItem $bundleRoot -Filter "*setup.exe" -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $installer) {
  throw "No NSIS setup.exe artifact was found under $bundleRoot."
}

New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$startedAt = Get-Date -Format "o"

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class SynapseInstallerSmokeWindow {
  [StructLayout(LayoutKind.Sequential)]
  public struct Rect {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr handle, out Rect rect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr handle);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr handle, int command);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PrintWindow(IntPtr handle, IntPtr deviceContext, uint flags);
}
"@

function Save-SynapseWindowScreenshot {
  param(
    [Parameter(Mandatory = $true)][IntPtr]$Handle,
    [Parameter(Mandatory = $true)][string]$Path
  )

  [void][SynapseInstallerSmokeWindow]::ShowWindow($Handle, 9)
  [void][SynapseInstallerSmokeWindow]::SetForegroundWindow($Handle)
  Start-Sleep -Milliseconds 750

  $rect = New-Object SynapseInstallerSmokeWindow+Rect
  if (-not [SynapseInstallerSmokeWindow]::GetWindowRect($Handle, [ref]$rect)) {
    throw "Synapse main window bounds could not be read for visual smoke evidence."
  }
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -lt 200 -or $height -lt 160) {
    throw "Synapse main window is too small for visual smoke evidence: ${width}x${height}."
  }

  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $deviceContext = $graphics.GetHdc()
    try {
      $printed = [SynapseInstallerSmokeWindow]::PrintWindow($Handle, $deviceContext, 2)
    } finally {
      $graphics.ReleaseHdc($deviceContext)
    }
    if (-not $printed) {
      throw "Synapse main window could not be rendered into a target-window screenshot."
    }
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

    $sampleStepX = [Math]::Max(1, [int]($width / 48))
    $sampleStepY = [Math]::Max(1, [int]($height / 32))
    $sampledColors = [System.Collections.Generic.HashSet[int]]::new()
    for ($x = 0; $x -lt $width; $x += $sampleStepX) {
      for ($y = 0; $y -lt $height; $y += $sampleStepY) {
        [void]$sampledColors.Add($bitmap.GetPixel($x, $y).ToArgb())
      }
    }
    if ($sampledColors.Count -lt 8) {
      throw "Synapse visual smoke detected an effectively blank window ($($sampledColors.Count) sampled colors)."
    }
    return [ordered]@{
      path = $Path
      width = $width
      height = $height
      sampled_color_count = $sampledColors.Count
    }
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$installRootCandidates = @(
  (Join-Path $env:LOCALAPPDATA "Synapse"),
  (Join-Path $env:LOCALAPPDATA "Programs\Synapse")
)

foreach ($candidate in $installRootCandidates) {
  if (Test-Path $candidate) {
    $existingUninstaller = Get-ChildItem $candidate -Filter "uninstall.exe" -File -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($existingUninstaller) {
      & $existingUninstaller.FullName /S
      Start-Sleep -Seconds 5
    }
  }
}

Write-Host "[INFO] Installing $($installer.FullName)"
& $installer.FullName /S
Start-Sleep -Seconds 8

$exe = $null
foreach ($candidate in $installRootCandidates) {
  $candidateExe = Join-Path $candidate "synapse.exe"
  if (Test-Path $candidateExe) {
    $exe = $candidateExe
    break
  }
}

if (-not $exe) {
  $exe = Get-ChildItem $env:LOCALAPPDATA -Recurse -Filter "synapse.exe" -File -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $exe) {
  throw "Installed Synapse executable was not found after NSIS install."
}

$startMenuRoots = @(
  (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
  (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs")
) | Where-Object { $_ -and (Test-Path $_) }

$shortcut = $null
foreach ($root in $startMenuRoots) {
  $shortcut = Get-ChildItem $root -Recurse -Filter "Synapse*.lnk" -File -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($shortcut) {
    break
  }
}

if (-not $shortcut) {
  throw "Synapse Start menu shortcut was not found after install."
}

$shell = New-Object -ComObject WScript.Shell
$shortcutTarget = $shell.CreateShortcut($shortcut.FullName).TargetPath
if (-not $shortcutTarget -or -not (Test-Path $shortcutTarget)) {
  throw "Synapse Start menu shortcut target is missing or invalid: $shortcutTarget"
}

if ((Resolve-Path $shortcutTarget).Path -ne (Resolve-Path $exe).Path) {
  throw "Synapse Start menu shortcut target '$shortcutTarget' does not match installed executable '$exe'."
}

Write-Host "[INFO] Launching $shortcutTarget"
$process = Start-Process -FilePath $shortcutTarget -PassThru
$startupDeadline = (Get-Date).AddSeconds(5)
$running = $null
$mainWindowHandle = [IntPtr]::Zero
$mainWindowTitle = ""
do {
  $running = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
  if (-not $running) {
    throw "Synapse process exited before the 5-second startup smoke window."
  }
  $running.Refresh()
  if ($running.MainWindowHandle -ne [IntPtr]::Zero) {
    $mainWindowHandle = $running.MainWindowHandle
    $mainWindowTitle = $running.MainWindowTitle
    break
  }
  Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $startupDeadline)

if ($mainWindowHandle -eq [IntPtr]::Zero) {
  throw "Synapse did not create a main window within the 5-second startup smoke window."
}

$windowScreenshot = Save-SynapseWindowScreenshot -Handle $mainWindowHandle -Path $windowScreenshotPath

$runtimeConfigPath = Join-Path $env:APPDATA "com.synapse.local\synapse.config.toml"
$configDeadline = (Get-Date).AddSeconds(5)
do {
  if (Test-Path $runtimeConfigPath) {
    break
  }
  Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $configDeadline)

if (-not (Test-Path $runtimeConfigPath)) {
  throw "Synapse did not create the AppData runtime config template: $runtimeConfigPath"
}

$runtimeConfig = Get-Content -LiteralPath $runtimeConfigPath -Raw
foreach ($requiredSafetyDefault in @(
  "external_delivery_enabled = false",
  "agent_execution_enabled = false",
  "script_execution_enabled = false"
)) {
  if (-not $runtimeConfig.Contains($requiredSafetyDefault)) {
    throw "Synapse runtime config template is missing guarded default: $requiredSafetyDefault"
  }
}

Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$uninstaller = Get-ChildItem (Split-Path $exe -Parent) -Filter "uninstall.exe" -File -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $uninstaller) {
  throw "Synapse uninstaller was not found next to $exe."
}

Write-Host "[INFO] Uninstalling with $($uninstaller.FullName)"
& $uninstaller.FullName /S
Start-Sleep -Seconds 5

if (Test-Path $exe) {
  throw "Synapse executable still exists after uninstall: $exe"
}

$evidence = [ordered]@{
  schema_version = 4
  started_at = $startedAt
  completed_at = Get-Date -Format "o"
  installer = $installer.FullName
  executable = $exe
  start_menu_shortcut = $shortcut.FullName
  start_menu_target = $shortcutTarget
  startup_window_seconds = 5
  main_window_detected = $true
  main_window_handle = $mainWindowHandle.ToInt64()
  main_window_title = $mainWindowTitle
  window_screenshot_path = $windowScreenshot.path
  window_screenshot_width = $windowScreenshot.width
  window_screenshot_height = $windowScreenshot.height
  window_sampled_color_count = $windowScreenshot.sampled_color_count
  window_nonblank_verified = $true
  runtime_config_path = $runtimeConfigPath
  runtime_config_template_created = $true
  uninstall_verified = $true
}
$evidence | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $evidencePath -Encoding UTF8

Write-Host "[PASS] installer smoke passed"
Write-Host "[PASS] installer: $($installer.FullName)"
Write-Host "[PASS] executable: $exe"
Write-Host "[PASS] start-menu-shortcut: $($shortcut.FullName)"
Write-Host "[PASS] main-window: handle=$($mainWindowHandle.ToInt64()) title=$mainWindowTitle"
Write-Host "[PASS] window-screenshot: $($windowScreenshot.path) ($($windowScreenshot.width)x$($windowScreenshot.height), sampled-colors=$($windowScreenshot.sampled_color_count))"
Write-Host "[PASS] runtime-config: $runtimeConfigPath"
Write-Host "[PASS] evidence: $evidencePath"
