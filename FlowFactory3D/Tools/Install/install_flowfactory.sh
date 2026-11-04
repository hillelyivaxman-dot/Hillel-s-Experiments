#!/usr/bin/env bash
# FlowFactory3D installer for macOS / Linux.
#
# Turns the FlowFactory3D zip (v0.3.1 or newer) into a working Unity 6.3 (Universal 3D) project and then runs the real checks:
# Setup Project, EditMode tests, PlayMode tests and (if Android Build Support is installed) an APK build.
# It never overwrites an existing project. Everything it ran, and its result, is written to a report file.
#
# Usage:
#   ./install_flowfactory.sh [--zip FILE] [--unity EDITOR_EXE] [--project DIR] [--update] [--skip-tests] [--skip-apk]
#
#   --zip      the FlowFactory3D zip (default: searched in ~/Downloads, ~/Desktop, ~/Documents, current folder)
#   --unity    Unity editor executable (default: searched in the usual Unity Hub folders; 6000.3.x preferred)
#   --project  where the Unity project goes (default: ~/UnityProjects/FlowFactory3D)
#   --update   the project already has FlowFactory: back up Assets/Scripts, Resources, Tests and copy the new ones
set -u

ZIP=""; UNITY="${UNITY:-}"; PROJECT="$HOME/UnityProjects/FlowFactory3D"
UPDATE=0; SKIP_TESTS=0; SKIP_APK=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --zip) ZIP="$2"; shift 2;;
    --unity) UNITY="$2"; shift 2;;
    --project) PROJECT="$2"; shift 2;;
    --update) UPDATE=1; shift;;
    --skip-tests) SKIP_TESTS=1; shift;;
    --skip-apk) SKIP_APK=1; shift;;
    *) echo "Unknown option: $1"; exit 64;;
  esac
done

REPORT="${PROJECT}.install_report.txt"
mkdir -p "$(dirname "$PROJECT")"
: > "$REPORT"
say() { echo "$*"; echo "$*" >> "$REPORT"; }
step() { say ""; say "== $* =="; }
result() { say "   RESULT: $*"; }
die() { say "STOPPED: $1"; say "Report: $REPORT"; exit "${2:-1}"; }

say "FlowFactory3D install report - $(date '+%Y-%m-%d %H:%M:%S')"
say "Only steps marked PASSED or FAILED were actually executed."

# ---------------------------------------------------------------- 1. find the zip
step "1. Find the ZIP"
if [[ -z "$ZIP" ]]; then
  # The newest FlowFactory3D_v0.*.zip wins (so v0.3.1 is preferred over an older v0.3 download).
  ZIP="$(ls -t "$PWD"/FlowFactory3D_v0.*.zip "$HOME"/Downloads/FlowFactory3D_v0.*.zip "$HOME"/Desktop/FlowFactory3D_v0.*.zip "$HOME"/Documents/FlowFactory3D_v0.*.zip 2>/dev/null | head -1)"
fi
[[ -n "$ZIP" && -f "$ZIP" ]] || die "The FlowFactory3D zip was not found. Run again with  --zip /full/path/FlowFactory3D_v0.3.1.zip" 2
result "PASSED - $ZIP"

# ---------------------------------------------------------------- 2. find Unity
step "2. Find Unity"
if [[ -z "$UNITY" ]]; then
  candidates=()
  while IFS= read -r line; do candidates+=("$line"); done < <(
    ls -d /Applications/Unity/Hub/Editor/*/Unity.app/Contents/MacOS/Unity \
          "$HOME"/Unity/Hub/Editor/*/Editor/Unity \
          /opt/Unity/Hub/Editor/*/Editor/Unity /opt/unity*/Editor/Unity 2>/dev/null | sort -V)
  for c in "${candidates[@]:-}"; do [[ "$c" == *"/6000.3."* ]] && UNITY="$c"; done
  [[ -z "$UNITY" && ${#candidates[@]} -gt 0 ]] && UNITY="${candidates[${#candidates[@]}-1]}"
fi
[[ -n "$UNITY" && -x "$UNITY" ]] || die "Unity editor not found. Install Unity 6.3 LTS with Unity Hub, or run with  --unity /path/to/Unity" 2
UNITY_VERSION="$(echo "$UNITY" | grep -o '6000\.[0-9]*\.[0-9a-z]*' | head -1)"
result "PASSED - $UNITY (version ${UNITY_VERSION:-unknown})"
[[ "$UNITY_VERSION" == 6000.3.* ]] || say "   WARNING: Unity 6.3 LTS (6000.3.x) is the supported version; this one may differ."

# Locate editor data folders (they differ per platform).
EDITOR_DIR="$(dirname "$UNITY")"
TEMPLATE_DIR=""; ANDROID_DIR=""
for base in "$EDITOR_DIR/Data" "$EDITOR_DIR/.." "$EDITOR_DIR/../.."; do
  [[ -d "$base/Resources/PackageManager/ProjectTemplates" ]] && TEMPLATE_DIR="$base/Resources/PackageManager/ProjectTemplates"
  [[ -d "$base/PlaybackEngines/AndroidPlayer" ]] && ANDROID_DIR="$base/PlaybackEngines/AndroidPlayer"
done
for base in "$EDITOR_DIR/../Resources"; do
  [[ -d "$base/PackageManager/ProjectTemplates" ]] && TEMPLATE_DIR="$base/PackageManager/ProjectTemplates"
done

# ---------------------------------------------------------------- 3. existing project?
step "3. Check for an existing project"
MODE="new"
if [[ -d "$PROJECT" && -n "$(ls -A "$PROJECT" 2>/dev/null)" ]]; then
  if [[ -f "$PROJECT/Assets/Scripts/Core/LevelCatalog.cs" ]]; then
    if [[ $UPDATE -eq 1 ]]; then MODE="update"; else MODE="existing"; fi
  elif [[ -f "$PROJECT/ProjectSettings/ProjectVersion.txt" ]]; then
    die "$PROJECT is another Unity project. Not touching it. Choose a different folder with --project." 3
  else
    die "$PROJECT exists and is not empty. Not touching it. Choose a different folder with --project." 3
  fi
fi
case "$MODE" in
  new) result "PASSED - no project at $PROJECT; a new one will be created";;
  existing) result "PASSED - FlowFactory is already installed at $PROJECT. Nothing is overwritten (use --update to copy newer code with a backup)";;
  update) result "PASSED - existing FlowFactory project; will back up and update scripts";;
esac

# ---------------------------------------------------------------- unpack the zip into a temp folder
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if command -v unzip >/dev/null 2>&1; then unzip -q "$ZIP" -d "$TMP/zip"; else python3 -m zipfile -e "$ZIP" "$TMP/zip"; fi
SRC="$TMP/zip/FlowFactory3D"
[[ -d "$SRC/Assets/Scripts" ]] || die "The zip does not contain FlowFactory3D/Assets/Scripts." 4

copy_game_files() {
  mkdir -p "$PROJECT/Assets"
  for part in Scripts Resources Tests; do
    mkdir -p "$PROJECT/Assets/$part"
    cp -R "$SRC/Assets/$part/." "$PROJECT/Assets/$part/"
  done
  mkdir -p "$PROJECT/Tools"; cp -R "$SRC/Tools/." "$PROJECT/Tools/"
  [[ -f "$PROJECT/README_HE.md" ]] || cp "$SRC/README_HE.md" "$PROJECT/README_HE.md"
}

# ---------------------------------------------------------------- 4. create the project
if [[ "$MODE" == "new" ]]; then
  step "4. Create a Unity 6.3 Universal 3D project"
  TEMPLATE="$(ls -t "$TEMPLATE_DIR"/com.unity.template.universal-3d*.tgz 2>/dev/null | head -1)"
  mkdir -p "$PROJECT"
  if [[ -n "$TEMPLATE" ]]; then
    mkdir -p "$TMP/template" && tar -xzf "$TEMPLATE" -C "$TMP/template"
    if [[ -d "$TMP/template/package/ProjectData~" ]]; then
      cp -R "$TMP/template/package/ProjectData~/." "$PROJECT/"
      result "PASSED - project files copied from the editor's Universal 3D template ($(basename "$TEMPLATE"))"
    else
      die "The Universal 3D template has an unexpected layout. Create the project with Unity Hub (template: Universal 3D) and re-run with --project." 5
    fi
  else
    say "   Universal 3D template not found in this editor; creating an empty Built-in-pipeline project instead."
    "$UNITY" -batchmode -nographics -quit -createProject "$PROJECT" -logFile "$PROJECT.createproject.log"
    if [[ -f "$PROJECT/ProjectSettings/ProjectVersion.txt" ]]; then
      result "PASSED - empty project created (NOT Universal 3D; the game uses its own shaders and still works)"
    else
      result "FAILED - Unity could not create a project; see $PROJECT.createproject.log"; die "Project creation failed." 5
    fi
  fi
fi

# ---------------------------------------------------------------- 5. copy files and packages
step "5. Copy game files and check packages"
if [[ "$MODE" == "update" ]]; then
  BACKUP="$PROJECT/Backups/$(date +%Y%m%d_%H%M%S)"; mkdir -p "$BACKUP"
  for part in Scripts Resources Tests; do [[ -d "$PROJECT/Assets/$part" ]] && cp -R "$PROJECT/Assets/$part" "$BACKUP/$part"; done
  say "   Backed up Assets/Scripts, Resources, Tests to $BACKUP"
fi
if [[ "$MODE" != "existing" ]]; then
  copy_game_files
  result "PASSED - Assets/Scripts, Assets/Resources, Assets/Tests copied (existing files with the same name were replaced only in update mode)"
fi

MANIFEST="$PROJECT/Packages/manifest.json"
if [[ -f "$MANIFEST" ]] && command -v python3 >/dev/null 2>&1; then
  python3 - "$MANIFEST" >> "$REPORT" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
deps = data.setdefault("dependencies", {})
wanted = {"com.unity.inputsystem": "1.14.0", "com.unity.test-framework": "1.5.1", "com.unity.ugui": "2.0.0"}
added = []
for name, version in wanted.items():
    if name not in deps:
        deps[name] = version
        added.append(name + "@" + version)
json.dump(data, open(path, "w"), indent=2)
print("   Packages already present kept as they are; added: " + (", ".join(added) if added else "nothing"))
PY
  cat "$REPORT" | tail -1
  result "PASSED - manifest checked (Unity resolves the packages on first open; if a version is rejected, use Package Manager)"
else
  result "SKIPPED - python3 or manifest missing; in Unity install Input System and Test Framework from Window > Package Manager"
fi

# ---------------------------------------------------------------- 6. setup project in Unity
LOGS="$PROJECT/Logs/Install"; mkdir -p "$LOGS"
step "6. Unity: import, compile and Flow Factory > Setup Project (batch mode)"
"$UNITY" -batchmode -nographics -quit -projectPath "$PROJECT" -logFile "$LOGS/setup.log" \
  -executeMethod FlowFactory.EditorTools.FlowFactoryMenu.SetUpProjectBatch
UNITY_EXIT=$?
COMPILE_ERRORS="$(grep -c 'error CS' "$LOGS/setup.log" 2>/dev/null || true)"
LEVEL_ASSETS="$(ls "$PROJECT"/Assets/Resources/Levels/*.asset 2>/dev/null | wc -l | tr -d ' ')"
if [[ $UNITY_EXIT -eq 0 && "${COMPILE_ERRORS:-0}" == "0" && -f "$PROJECT/Assets/Scenes/Main.unity" && "$LEVEL_ASSETS" == "36" ]]; then
  result "PASSED - exit 0, 0 compile errors, Assets/Scenes/Main.unity exists, 36 level assets"
else
  result "FAILED - exit=$UNITY_EXIT, compile errors=${COMPILE_ERRORS:-?}, Main.unity=$([[ -f $PROJECT/Assets/Scenes/Main.unity ]] && echo yes || echo no), level assets=$LEVEL_ASSETS. See $LOGS/setup.log"
  grep -m5 'error CS' "$LOGS/setup.log" 2>/dev/null | sed 's/^/     /' | tee -a "$REPORT"
fi

# ---------------------------------------------------------------- 7-8. tests
parse_xml() { # file -> "total=.. passed=.. failed=.."
  local f="$1"
  [[ -f "$f" ]] || { echo "no result file"; return; }
  local line; line="$(grep -o '<test-run [^>]*>' "$f" | head -1)"
  echo "total=$(echo "$line" | grep -o ' total="[0-9]*"' | grep -o '[0-9]*') passed=$(echo "$line" | grep -o ' passed="[0-9]*"' | grep -o '[0-9]*') failed=$(echo "$line" | grep -o ' failed="[0-9]*"' | grep -o '[0-9]*')"
}
if [[ $SKIP_TESTS -eq 0 ]]; then
  for platform in EditMode PlayMode; do
    step "7/8. Unity Test Runner: $platform"
    "$UNITY" -batchmode -nographics -projectPath "$PROJECT" -runTests -testPlatform "$platform" \
      -testResults "$LOGS/$platform.xml" -logFile "$LOGS/$platform.log"
    code=$?
    summary="$(parse_xml "$LOGS/$platform.xml")"
    errs="$(grep -c -E '^\[?(Exception|Error)|NullReferenceException' "$LOGS/$platform.log" 2>/dev/null || true)"
    if [[ $code -eq 0 ]]; then result "PASSED - $summary (Unity exit 0; Console error-like lines in log: ${errs:-0})"
    else result "FAILED - Unity exit $code, $summary. See $LOGS/$platform.log and $LOGS/$platform.xml"; fi
  done
else
  step "7/8. Tests"; result "SKIPPED (--skip-tests)"
fi

# ---------------------------------------------------------------- 9. APK
step "9. Android APK"
if [[ $SKIP_APK -eq 1 ]]; then
  result "SKIPPED (--skip-apk)"
elif [[ -z "$ANDROID_DIR" ]]; then
  result "SKIPPED - Android Build Support is not installed in this editor. Unity Hub > Installs > (gear) > Add modules > Android Build Support (with OpenJDK and Android SDK & NDK Tools)"
else
  "$UNITY" -batchmode -nographics -quit -projectPath "$PROJECT" -buildTarget Android -logFile "$LOGS/apk.log" \
    -executeMethod FlowFactory.EditorTools.FlowFactoryMenu.BuildAndroidBatch
  code=$?
  APK="$PROJECT/Builds/Android/FlowFactory3D-dev.apk"
  if [[ $code -eq 0 && -f "$APK" ]]; then result "PASSED - $APK ($(du -h "$APK" | cut -f1))"
  else result "FAILED - exit $code, APK present: $([[ -f $APK ]] && echo yes || echo no). See $LOGS/apk.log"; fi
fi

say ""
say "Not covered by this script: the screenshot tour (needs a graphics window: in Unity use Flow Factory > Capture Screenshot Tour),"
say "touch input and FPS on a real phone. Project: $PROJECT"
say "Report: $REPORT"
