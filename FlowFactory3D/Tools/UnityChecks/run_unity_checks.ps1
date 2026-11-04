# Runs the real Unity checks from the command line (Windows PowerShell).
# Usage:  .\run_unity_checks.ps1 -Unity "C:\Program Files\Unity\Hub\Editor\6000.3.0f1\Editor\Unity.exe" -What all
# What: editmode | playmode | levels | apk | all   (the screenshot tour needs a graphics device: use the menu
#       Flow Factory > Capture Screenshot Tour inside the editor)
param(
  [Parameter(Mandatory = $true)][string]$Unity,
  [string]$What = "all"
)
$project = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$out = Join-Path $project "Logs\UnityChecks"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$status = 0

function Run-Unity([string[]]$arguments) {
  Write-Host ">>> Unity $($arguments -join ' ')"
  $p = Start-Process -FilePath $Unity -ArgumentList $arguments -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { Write-Host "FAILED (exit $($p.ExitCode))"; $script:status = 1 }
}

if ($What -in "levels", "all") {
  Run-Unity @("-batchmode", "-nographics", "-quit", "-projectPath", $project, "-logFile", "$out\levels.log", "-executeMethod", "FlowFactory.EditorTools.FlowFactoryMenu.GenerateMissingLevels")
}
if ($What -in "editmode", "all") {
  Run-Unity @("-batchmode", "-nographics", "-projectPath", $project, "-runTests", "-testPlatform", "EditMode", "-testResults", "$out\editmode.xml", "-logFile", "$out\editmode.log")
}
if ($What -in "playmode", "all") {
  Run-Unity @("-batchmode", "-nographics", "-projectPath", $project, "-runTests", "-testPlatform", "PlayMode", "-testResults", "$out\playmode.xml", "-logFile", "$out\playmode.log")
}
if ($What -in "apk", "all") {
  Run-Unity @("-batchmode", "-nographics", "-quit", "-projectPath", $project, "-buildTarget", "Android", "-logFile", "$out\apk.log", "-executeMethod", "FlowFactory.EditorTools.FlowFactoryMenu.BuildAndroidBatch")
}
Write-Host "Done. Results in $out (status $status)"
exit $status
