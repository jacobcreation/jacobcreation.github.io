#!/bin/bash

set -u

# ── Environment ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
export SRC="${SRC:-$SCRIPT_DIR}"
export OUT="$SRC/downloads"
export WORK="/tmp/cordova_build"
export CORDOVA_TELEMETRY_OPTOUT=1
export ANDROID_MIN_SDK_VERSION="${ANDROID_MIN_SDK_VERSION:-22}"

mkdir -p "$OUT"
mkdir -p "$WORK"

REAL_NAMES_FILE="$SRC/real_names.txt"

xml_escape() {
  local value="$1"
  value=${value//&/&amp;}
  value=${value//</&lt;}
  value=${value//>/&gt;}
  printf '%s' "$value"
}

safe_name_for_folder() {
  local folder="$1"
  echo "$folder" | sed 's/[^a-zA-Z0-9]/_/g' | tr '[:upper:]' '[:lower:]' | sed 's/^[0-9]/p&/'
}

print_progress() {
  local current="$1"
  local total="$2"
  local folder="$3"
  local width=30
  local filled=0
  local empty=0
  local bar=""

  if [ "$total" -gt 0 ]; then
    filled=$(( current * width / total ))
  fi
  empty=$(( width - filled ))

  printf -v bar '%*s' "$filled" ''
  bar=${bar// /#}
  printf -v bar '%s%*s' "$bar" "$empty" ''
  bar=${bar// /-}

  printf '[%s] %d/%d %s\n' "$bar" "$current" "$total" "$folder"
}

print_log_tail() {
  local log_file="$1"
  echo "  --- Last log lines ($log_file) ---"
  tail -n 40 "$log_file" 2>/dev/null || echo "  (log unavailable)"
  echo "  --- end log excerpt ---"
}

detect_latest_sdk_platform() {
  local platforms_dir="$ANDROID_HOME/platforms"
  local latest=""
  local candidate=""

  if [ ! -d "$platforms_dir" ]; then
    return 1
  fi

  while IFS= read -r candidate; do
    candidate="${candidate##*-}"
    case "$candidate" in
      ''|*[!0-9]*) continue ;;
    esac

    if [ -z "$latest" ] || [ "$candidate" -gt "$latest" ]; then
      latest="$candidate"
    fi
  done < <(find "$platforms_dir" -maxdepth 1 -type d -name 'android-*' 2>/dev/null)

  if [ -n "$latest" ]; then
    printf '%s\n' "$latest"
    return 0
  fi

  return 1
}

validate_environment() {
  local fail=0

  if ! command -v cordova >/dev/null 2>&1; then
    echo "Missing required command: cordova"
    fail=1
  fi

  if ! command -v java >/dev/null 2>&1; then
    echo "Missing required command: java (JDK 17+ recommended)"
    fail=1
  fi

  if [ ! -d "$ANDROID_HOME" ]; then
    echo "ANDROID_HOME does not exist: $ANDROID_HOME"
    fail=1
  fi

  if [ -z "${ANDROID_COMPILE_SDK_VERSION:-}" ] || [ -z "${ANDROID_TARGET_SDK_VERSION:-}" ]; then
    local detected_sdk=""
    if detected_sdk="$(detect_latest_sdk_platform)"; then
      export ANDROID_COMPILE_SDK_VERSION="${ANDROID_COMPILE_SDK_VERSION:-$detected_sdk}"
      export ANDROID_TARGET_SDK_VERSION="${ANDROID_TARGET_SDK_VERSION:-$detected_sdk}"
      echo "Using detected SDK platform android-$detected_sdk for compile/target."
    else
      export ANDROID_COMPILE_SDK_VERSION="${ANDROID_COMPILE_SDK_VERSION:-35}"
      export ANDROID_TARGET_SDK_VERSION="${ANDROID_TARGET_SDK_VERSION:-35}"
      echo "Could not detect installed Android platforms; defaulting compile/target SDK to 35."
    fi
  fi

  if [ ! -f "$SRC/real_names.txt" ]; then
    echo "Missing $SRC/real_names.txt"
    fail=1
  fi

  if [ ! -f "$SRC/build.json" ]; then
    echo "Missing $SRC/build.json"
    fail=1
  fi

  if [ "$fail" -ne 0 ]; then
    echo ""
    echo "Tip: set SRC and ANDROID_HOME explicitly if needed, e.g."
    echo "  SRC=\"$(pwd)\" ANDROID_HOME=\"\$HOME/Android/Sdk\" ./build_apks.sh"
    exit 1
  fi
}

# ── Function for building a single project ───────────────────────────────────
build_project() {
  local folder="$1"
  local safe_name
  safe_name=$(safe_name_for_folder "$folder")
  local pkg="com.jacobcreation.app_${safe_name}"
  local build_dir="$WORK/$safe_name"
  local real_name="$2"
  local app_name
  if [ -n "$real_name" ]; then
    app_name="$real_name"
  else
    app_name="Project_${safe_name}"
  fi

  # Skip check disabled to force rebuild with signing
  # if [ -f "$OUT/${safe_name}.apk" ]; then
  #   echo "  [SKIP] $folder (Already built)"
  #   return 0
  # fi

  echo "==> Started $folder"

  # Path for logs
  local log_dir="/tmp/cordova_logs"
  mkdir -p "$log_dir"
  local log_file="$log_dir/${safe_name}.log"

  rm -rf "$build_dir"
  # mkdir -p "$build_dir"  <-- REMOVED: Cordova needs to create this

  # create cordova project
  if ! cordova create "$build_dir" "$pkg" "$app_name" --quiet > "$log_file" 2>&1; then
    echo "  ✗ FAILED $folder (Create error - see $log_file)"
    return 1
  fi



  # copy web files
  rm -rf "$build_dir/www"
  mkdir -p "$build_dir/www"
  cp -r "$SRC/$folder/." "$build_dir/www/"

  if [ ! -f "$build_dir/www/index.html" ]; then
    echo "  [SKIP] No index.html in $folder"
    return 1
  fi

  local escaped_app_name
  local escaped_folder
  escaped_app_name=$(xml_escape "$app_name")
  escaped_folder=$(xml_escape "$folder")

  cat > "$build_dir/config.xml" <<XML
<?xml version='1.0' encoding='utf-8'?>
<widget id="${pkg}" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>${escaped_app_name}</name>
    <description>${escaped_folder}</description>
    <author email="jacob@jacobcreation.github.io" href="https://jacobcreation.github.io">Jacob</author>
    <content src="index.html" />
    <preference name="loglevel" value="DEBUG" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <allow-navigation href="*" />
    <access origin="*" />
    <preference name="android-minSdkVersion" value="${ANDROID_MIN_SDK_VERSION}" />
    <preference name="android-targetSdkVersion" value="${ANDROID_TARGET_SDK_VERSION}" />
    <preference name="android-compileSdkVersion" value="${ANDROID_COMPILE_SDK_VERSION}" />
</widget>
XML

  cd "$build_dir" || return 1
  
  if ! cordova platform add android --quiet >> "$log_file" 2>&1; then
    echo "  ✗ FAILED $folder (Platform error - see $log_file)"
    print_log_tail "$log_file"
    return 1
  fi
  
  if cordova build android --release --quiet --buildConfig="$SRC/build.json" -- --packageType=apk >> "$log_file" 2>&1; then

    local apk
    apk=$(find "$build_dir/platforms/android/app/build/outputs/apk/release" -name "*.apk" | head -1)
    if [ -n "$apk" ]; then
      cp "$apk" "$OUT/${safe_name}.apk"
      echo "  ✓ DONE $folder -> ${safe_name}.apk"
      return 0
    else
      # Try broader find if not in standard path
      apk=$(find "$build_dir" -name "*.apk" | head -1)
      if [ -n "$apk" ]; then
        cp "$apk" "$OUT/${safe_name}.apk"
        echo "  ✓ DONE $folder -> ${safe_name}.apk"
        return 0
      fi
      echo "  ✗ FAILED $folder (No APK found - check $log_file)"
      return 1
    fi
  else
    echo "  ✗ FAILED $folder (Build error - see $log_file)"
    print_log_tail "$log_file"
    echo "  Common causes: missing Android SDK platform/build-tools, incorrect signing config in build.json, or unavailable target/compile SDK versions."
    pkill -f GradleDaemon || true
    return 1
  fi
  pkill -f GradleDaemon || true
}

export -f build_project
export -f xml_escape
export -f print_log_tail
export -f detect_latest_sdk_platform

# ── Main ──────────────────────────────────────────────────────────────────────
cd "$SRC" || exit 1

export PROJECTS_FILE="/tmp/projects_list.txt"
> "$PROJECTS_FILE"

validate_environment

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ""|\#*) continue ;;
  esac

  folder=${line%%=*}
  app_name=${line#*=}
  folder=$(printf '%s' "$folder" | sed 's/[[:space:]]*$//')
  app_name=$(printf '%s' "$app_name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  if [ -z "$folder" ] || [ -z "$app_name" ]; then
    continue
  fi

  case "$folder" in
    about|releases|downloads|node_modules|icons) continue ;;
  esac

  if [ -f "$folder/index.html" ]; then
    printf '%s\t%s\n' "$folder" "$app_name" >> "$PROJECTS_FILE"
  else
    echo "  [WARN] Skipping $folder (missing index.html)"
  fi
done < "$REAL_NAMES_FILE"

TOTAL=$(wc -l < "$PROJECTS_FILE")
TARGET_FOLDER="${1:-}"
CURRENT=0
BUILT=0
SKIPPED=0
FAILED=0

if [ -n "$TARGET_FOLDER" ]; then
  MATCHED=0
  while IFS=$'\t' read -r folder app_name; do
    if [ "$folder" = "$TARGET_FOLDER" ]; then
      MATCHED=1
      print_progress 1 1 "$folder"
      safe_name=$(safe_name_for_folder "$folder")
      if [ -f "$OUT/${safe_name}.apk" ]; then
        echo "  [SKIP] $folder (Already built)"
        SKIPPED=1
      elif build_project "$folder" "$app_name"; then
        BUILT=1
      else
        FAILED=1
      fi
      break
    fi
  done < "$PROJECTS_FILE"

  if [ "$MATCHED" -eq 0 ]; then
    echo "No matching project found in $REAL_NAMES_FILE for folder: $TARGET_FOLDER"
    exit 1
  fi
else
  echo "Found $TOTAL projects. Building sequentially, one at a time..."
  while IFS=$'\t' read -r folder app_name; do
    CURRENT=$((CURRENT + 1))
    print_progress "$CURRENT" "$TOTAL" "$folder"
    safe_name=$(safe_name_for_folder "$folder")

    if [ -f "$OUT/${safe_name}.apk" ]; then
      echo "  [SKIP] $folder (Already built)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi

    if build_project "$folder" "$app_name"; then
      BUILT=$((BUILT + 1))
    else
      FAILED=$((FAILED + 1))
    fi
  done < "$PROJECTS_FILE"
fi



echo ""
echo "Summary of APKs in $OUT:"
ls -lh "$OUT/" | grep ".apk" || echo "No APKs built yet."
ls -lh "$OUT/" | grep ".apk" | wc -l | awk '{print $1 " APKs total."}'
echo "Built this run: $BUILT | Skipped: $SKIPPED | Failed: $FAILED"
