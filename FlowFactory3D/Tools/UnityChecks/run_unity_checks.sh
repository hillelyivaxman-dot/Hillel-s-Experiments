#!/usr/bin/env bash
# Runs the real Unity checks from the command line (macOS / Linux).
# Usage: UNITY=/path/to/Unity ./run_unity_checks.sh [editmode|playmode|levels|tour|apk|all]
# Results are written to ../../Logs/UnityChecks (test XML files, editor logs, screenshots, the APK path).
set -u
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
UNITY="${UNITY:?Set UNITY to the Unity editor executable, e.g. /Applications/Unity/Hub/Editor/6000.3.0f1/Unity.app/Contents/MacOS/Unity}"
OUT="$PROJECT/Logs/UnityChecks"
mkdir -p "$OUT"
WHAT="${1:-all}"
status=0

run() { echo ">>> $*"; "$@" || { echo "FAILED: $*"; status=1; }; }

if [[ "$WHAT" == "levels" || "$WHAT" == "all" ]]; then
  run "$UNITY" -batchmode -nographics -quit -projectPath "$PROJECT" -logFile "$OUT/levels.log" \
      -executeMethod FlowFactory.EditorTools.FlowFactoryMenu.GenerateMissingLevels
fi
if [[ "$WHAT" == "editmode" || "$WHAT" == "all" ]]; then
  run "$UNITY" -batchmode -nographics -projectPath "$PROJECT" -runTests -testPlatform EditMode \
      -testResults "$OUT/editmode.xml" -logFile "$OUT/editmode.log"
fi
if [[ "$WHAT" == "playmode" || "$WHAT" == "all" ]]; then
  run "$UNITY" -batchmode -nographics -projectPath "$PROJECT" -runTests -testPlatform PlayMode \
      -testResults "$OUT/playmode.xml" -logFile "$OUT/playmode.log"
fi
if [[ "$WHAT" == "tour" ]]; then
  # Needs a real graphics device (not -nographics): run on a machine with a display.
  run "$UNITY" -projectPath "$PROJECT" -screen-width 1080 -screen-height 1920 -logFile "$OUT/tour.log" \
      -executeMethod FlowFactory.EditorTools.FlowFactoryMenu.CaptureScreenshotTour
fi
if [[ "$WHAT" == "apk" || "$WHAT" == "all" ]]; then
  run "$UNITY" -batchmode -nographics -quit -projectPath "$PROJECT" -buildTarget Android -logFile "$OUT/apk.log" \
      -executeMethod FlowFactory.EditorTools.FlowFactoryMenu.BuildAndroidBatch
fi
echo "Done. Results in $OUT (exit status $status)"
exit $status
