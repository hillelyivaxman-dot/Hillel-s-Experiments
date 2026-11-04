<#
FlowFactory3D installer for Windows (PowerShell 5.1 or 7).

Turns the FlowFactory3D zip (v0.3.1 or newer) into a working Unity 6.3 (Universal 3D) project and then runs the real checks:
Setup Project, EditMode tests, PlayMode tests and (if Android Build Support is installed) an APK build.
It never overwrites an existing project. Everything it ran, and its result, is written to a report file.

NOTE: this PowerShell version could not be run by its author (no PowerShell and no Unity where it was written).
The bash version of the same logic was tested with a simulated editor. Run this one and send back the report.

Usage:
  .\install_flowfactory.ps1 [-Zip FILE] [-Unity Unity.exe] [-Project DIR] [-Update] [-SkipTests] [-SkipApk]
If scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\install_flowfactory.ps1
#>
param(
  [string]$Zip = "",
  [string]$Unity = "",
  [string]$Project = (Join-Path $env:USERPROFILE "UnityProjects\FlowFactory3D"),
  [switch]$Update,
  [switch]$SkipTests,
  [switch]$SkipApk
)

$ErrorActionPreference = "Stop"
$report = "$Project.install_report.txt"
New-Item -ItemType Directory -Force -Path (Split-Path $Project) | Out-Null
Set-Content -Path $report -Value "" -Encoding UTF8

function Say([string]$text) { Write-Host $text; Add-Content -Path $report -Value $text -Encoding UTF8 }
function Step([string]$text) { Say ""; Say "== $text ==" }
function Result([string]$text) { Say "   RESULT: $text" }
function Stop-Install([string]$text, [int]$code = 1) { Say "STOPPED: $text"; Say "Report: $report"; exit $code }

Say "FlowFactory3D install report - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Say "Only steps marked PASSED or FAILED were actually executed."

# ---------------------------------------------------------------- 1. find the zip
Step "1. Find the ZIP"
if (-not $Zip) {
  $dirs = @((Get-Location).Path, (Join-Path $env:USERPROFILE "Downloads"), (Join-Path $env:USERPROFILE "Desktop"), (Join-Path $env:USERPROFILE "Documents"))
  # The newest FlowFactory3D_v0.*.zip wins (so v0.3.1 is preferred over an older v0.3 download).
  $any = $dirs | ForEach-Object { Get-ChildItem -Path $_ -Filter "FlowFactory3D_v0.*.zip" -ErrorAction SilentlyContinue } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($any) { $Zip = $any.FullName }
}
if (-not $Zip -or -not (Test-Path $Zip)) { Stop-Install "The FlowFactory3D zip was not found. Run again with  -Zip C:\full\path\FlowFactory3D_v0.3.1.zip" 2 }
Result "PASSED - $Zip"

# ---------------------------------------------------------------- 2. find Unity
Step "2. Find Unity"
if (-not $Unity) {
  $roots = @("C:\Program Files\Unity\Hub\Editor", "$env:ProgramFiles\Unity\Hub\Editor", "D:\Unity\Hub\Editor")
  $found = @()
  foreach ($r in $roots) {
    if (Test-Path $r) { $found += Get-ChildItem -Path $r -Directory | Where-Object { Test-Path (Join-Path $_.FullName "Editor\Unity.exe") } }
  }
  $found = $found | Sort-Object Name
  $pick = $found | Where-Object { $_.Name -like "6000.3.*" } | Select-Object -Last 1
  if (-not $pick) { $pick = $found | Select-Object -Last 1 }
  if ($pick) { $Unity = Join-Path $pick.FullName "Editor\Unity.exe" }
}
if (-not $Unity -or -not (Test-Path $Unity)) { Stop-Install "Unity editor not found. Install Unity 6.3 LTS with Unity Hub, or run with  -Unity C:\path\Unity.exe" 2 }
$unityVersion = if ($Unity -match "6000\.\d+\.[0-9a-z]+") { $Matches[0] } else { "unknown" }
Result "PASSED - $Unity (version $unityVersion)"
if ($unityVersion -notlike "6000.3.*") { Say "   WARNING: Unity 6.3 LTS (6000.3.x) is the supported version; this one may differ." }

$editorDir = Split-Path $Unity
$templateDir = Join-Path $editorDir "Data\Resources\PackageManager\ProjectTemplates"
$androidDir = Join-Path $editorDir "Data\PlaybackEngines\AndroidPlayer"

# ---------------------------------------------------------------- 3. existing project?
Step "3. Check for an existing project"
$mode = "new"
if ((Test-Path $Project) -and (Get-ChildItem -Path $Project -Force -ErrorAction SilentlyContinue | Select-Object -First 1)) {
  if (Test-Path (Join-Path $Project "Assets\Scripts\Core\LevelCatalog.cs")) {
    $mode = if ($Update) { "update" } else { "existing" }
  } elseif (Test-Path (Join-Path $Project "ProjectSettings\ProjectVersion.txt")) {
    Stop-Install "$Project is another Unity project. Not touching it. Choose a different folder with -Project." 3
  } else {
    Stop-Install "$Project exists and is not empty. Not touching it. Choose a different folder with -Project." 3
  }
}
switch ($mode) {
  "new" { Result "PASSED - no project at $Project; a new one will be created" }
  "existing" { Result "PASSED - FlowFactory is already installed at $Project. Nothing is overwritten (use -Update to copy newer code with a backup)" }
  "update" { Result "PASSED - existing FlowFactory project; will back up and update scripts" }
}

# ---------------------------------------------------------------- unpack the zip
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("flowfactory_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Expand-Archive -Path $Zip -DestinationPath (Join-Path $tmp "zip") -Force
$src = Join-Path $tmp "zip\FlowFactory3D"
if (-not (Test-Path (Join-Path $src "Assets\Scripts"))) { Stop-Install "The zip does not contain FlowFactory3D\Assets\Scripts." 4 }

function Copy-GameFiles {
  foreach ($part in "Scripts", "Resources", "Tests") {
    $dest = Join-Path $Project "Assets\$part"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Path (Join-Path $src "Assets\$part\*") -Destination $dest -Recurse -Force
  }
  $tools = Join-Path $Project "Tools"
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  Copy-Item -Path (Join-Path $src "Tools\*") -Destination $tools -Recurse -Force
  if (-not (Test-Path (Join-Path $Project "README_HE.md"))) { Copy-Item (Join-Path $src "README_HE.md") $Project }
}

function Invoke-Unity([string[]]$unityArgs) {
  $p = Start-Process -FilePath $Unity -ArgumentList $unityArgs -Wait -PassThru -NoNewWindow
  return $p.ExitCode
}

# ---------------------------------------------------------------- 4. create the project
if ($mode -eq "new") {
  Step "4. Create a Unity 6.3 Universal 3D project"
  New-Item -ItemType Directory -Force -Path $Project | Out-Null
  $template = Get-ChildItem -Path $templateDir -Filter "com.unity.template.universal-3d*.tgz" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($template) {
    $extract = Join-Path $tmp "template"
    New-Item -ItemType Directory -Force -Path $extract | Out-Null
    & tar.exe -xzf $template.FullName -C $extract
    $data = Join-Path $extract "package\ProjectData~"
    if (Test-Path $data) {
      Copy-Item -Path (Join-Path $data "*") -Destination $Project -Recurse -Force
      Result "PASSED - project files copied from the editor's Universal 3D template ($($template.Name))"
    } else {
      Stop-Install "The Universal 3D template has an unexpected layout. Create the project with Unity Hub (template: Universal 3D) and re-run with -Project." 5
    }
  } else {
    Say "   Universal 3D template not found in this editor; creating an empty Built-in-pipeline project instead."
    $null = Invoke-Unity @("-batchmode", "-nographics", "-quit", "-createProject", "`"$Project`"", "-logFile", "`"$Project.createproject.log`"")
    if (Test-Path (Join-Path $Project "ProjectSettings\ProjectVersion.txt")) {
      Result "PASSED - empty project created (NOT Universal 3D; the game uses its own shaders and still works)"
    } else {
      Result "FAILED - Unity could not create a project; see $Project.createproject.log"
      Stop-Install "Project creation failed." 5
    }
  }
}

# ---------------------------------------------------------------- 5. copy files and packages
Step "5. Copy game files and check packages"
if ($mode -eq "update") {
  $backup = Join-Path $Project ("Backups\" + (Get-Date -Format "yyyyMMdd_HHmmss"))
  New-Item -ItemType Directory -Force -Path $backup | Out-Null
  foreach ($part in "Scripts", "Resources", "Tests") {
    $from = Join-Path $Project "Assets\$part"
    if (Test-Path $from) { Copy-Item -Path $from -Destination (Join-Path $backup $part) -Recurse }
  }
  Say "   Backed up Assets\Scripts, Resources, Tests to $backup"
}
if ($mode -ne "existing") {
  Copy-GameFiles
  Result "PASSED - Assets\Scripts, Assets\Resources, Assets\Tests copied"
}

$manifestPath = Join-Path $Project "Packages\manifest.json"
if (Test-Path $manifestPath) {
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  $wanted = [ordered]@{ "com.unity.inputsystem" = "1.14.0"; "com.unity.test-framework" = "1.5.1"; "com.unity.ugui" = "2.0.0" }
  $added = @()
  foreach ($name in $wanted.Keys) {
    if (-not ($manifest.dependencies.PSObject.Properties.Name -contains $name)) {
      $manifest.dependencies | Add-Member -NotePropertyName $name -NotePropertyValue $wanted[$name]
      $added += "$name@$($wanted[$name])"
    }
  }
  $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath -Encoding UTF8
  Say ("   Packages already present kept as they are; added: " + $(if ($added.Count) { $added -join ", " } else { "nothing" }))
  Result "PASSED - manifest checked (Unity resolves the packages on first open; if a version is rejected, use Package Manager)"
} else {
  Result "SKIPPED - Packages\manifest.json missing; in Unity install Input System and Test Framework from Window > Package Manager"
}

# ---------------------------------------------------------------- 6. setup project in Unity
$logs = Join-Path $Project "Logs\Install"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
Step "6. Unity: import, compile and Flow Factory > Setup Project (batch mode)"
$exit = Invoke-Unity @("-batchmode", "-nographics", "-quit", "-projectPath", "`"$Project`"", "-logFile", "`"$logs\setup.log`"",
  "-executeMethod", "FlowFactory.EditorTools.FlowFactoryMenu.SetUpProjectBatch")
$setupLog = Join-Path $logs "setup.log"
$compileErrors = if (Test-Path $setupLog) { @(Select-String -Path $setupLog -Pattern "error CS").Count } else { -1 }
$levelAssets = @(Get-ChildItem -Path (Join-Path $Project "Assets\Resources\Levels") -Filter "*.asset" -ErrorAction SilentlyContinue).Count
$sceneExists = Test-Path (Join-Path $Project "Assets\Scenes\Main.unity")
if ($exit -eq 0 -and $compileErrors -eq 0 -and $sceneExists -and $levelAssets -eq 36) {
  Result "PASSED - exit 0, 0 compile errors, Assets\Scenes\Main.unity exists, 36 level assets"
} else {
  Result "FAILED - exit=$exit, compile errors=$compileErrors, Main.unity=$sceneExists, level assets=$levelAssets. See $setupLog"
  if (Test-Path $setupLog) { Select-String -Path $setupLog -Pattern "error CS" | Select-Object -First 5 | ForEach-Object { Say ("     " + $_.Line) } }
}

# ---------------------------------------------------------------- 7-8. tests
function Get-TestSummary([string]$file) {
  if (-not (Test-Path $file)) { return "no result file" }
  $head = (Select-String -Path $file -Pattern "<test-run " | Select-Object -First 1).Line
  $total = if ($head -match ' total="(\d+)"') { $Matches[1] } else { "?" }
  $passed = if ($head -match ' passed="(\d+)"') { $Matches[1] } else { "?" }
  $failed = if ($head -match ' failed="(\d+)"') { $Matches[1] } else { "?" }
  return "total=$total passed=$passed failed=$failed"
}
if (-not $SkipTests) {
  foreach ($platform in "EditMode", "PlayMode") {
    Step "7/8. Unity Test Runner: $platform"
    $code = Invoke-Unity @("-batchmode", "-nographics", "-projectPath", "`"$Project`"", "-runTests", "-testPlatform", $platform,
      "-testResults", "`"$logs\$platform.xml`"", "-logFile", "`"$logs\$platform.log`"")
    $summary = Get-TestSummary (Join-Path $logs "$platform.xml")
    if ($code -eq 0) { Result "PASSED - $summary (Unity exit 0)" }
    else { Result "FAILED - Unity exit $code, $summary. See $logs\$platform.log and $logs\$platform.xml" }
  }
} else {
  Step "7/8. Tests"; Result "SKIPPED (-SkipTests)"
}

# ---------------------------------------------------------------- 9. APK
Step "9. Android APK"
if ($SkipApk) {
  Result "SKIPPED (-SkipApk)"
} elseif (-not (Test-Path $androidDir)) {
  Result "SKIPPED - Android Build Support is not installed in this editor. Unity Hub > Installs > (gear) > Add modules > Android Build Support (with OpenJDK and Android SDK & NDK Tools)"
} else {
  $code = Invoke-Unity @("-batchmode", "-nographics", "-quit", "-projectPath", "`"$Project`"", "-buildTarget", "Android", "-logFile", "`"$logs\apk.log`"",
    "-executeMethod", "FlowFactory.EditorTools.FlowFactoryMenu.BuildAndroidBatch")
  $apk = Join-Path $Project "Builds\Android\FlowFactory3D-dev.apk"
  if ($code -eq 0 -and (Test-Path $apk)) { Result ("PASSED - $apk (" + [math]::Round((Get-Item $apk).Length / 1MB, 1) + " MB)") }
  else { Result "FAILED - exit $code, APK present: $(Test-Path $apk). See $logs\apk.log" }
}

Say ""
Say "Not covered by this script: the screenshot tour (needs a graphics window: in Unity use Flow Factory > Capture Screenshot Tour),"
Say "touch input and FPS on a real phone. Project: $Project"
Say "Report: $report"
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
