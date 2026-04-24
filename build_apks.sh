#!/bin/bash

# ── Environment ──────────────────────────────────────────────────────────────
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/build-tools/34.0.0:$ANDROID_HOME/platform-tools:/home/jacob/.gradle/wrapper/dists/gradle-8.14.2-bin/2pb3mgt1p815evrl3weanttgr/gradle-8.14.2/bin:$PATH"
export CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL="file:///home/jacob/.gradle/wrapper/dists/gradle-8.14.2-bin.zip"
export SRC="/home/jacob/Desktop/jacobcreation.github.io"
export OUT="$SRC/downloads"
export WORK="/tmp/cordova_build"
export CORDOVA_TELEMETRY_OPTOUT=1

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

# ── Build single project ─────────────────────────────────────────────────────
build_project() {
  local folder="$1"
  local safe_name
  safe_name=$(safe_name_for_folder "$folder")
  local pkg="com.jacobcreation.app_${safe_name}"
  local build_dir="$WORK/$safe_name"
  local real_name="$2"
  local app_name="${real_name:-Project_${safe_name}}"

  echo "==> Started $folder"

  local log_dir="/tmp/cordova_logs"
  mkdir -p "$log_dir"
  local log_file="$log_dir/${safe_name}.log"

  rm -rf "$build_dir"

  if ! cordova create "$build_dir" "$pkg" "$app_name" --quiet > "$log_file" 2>&1; then
    echo "  ✗ FAILED $folder (Create error - see $log_file)"
    return 1
  fi

  rm -rf "$build_dir/www"
  mkdir -p "$build_dir/www"

  # ── COPY PROJECT ───────────────────────────────────────────────────────────
  cp -r "$SRC/$folder/." "$build_dir/www/"

  # ── CLEANUP: Remove unnecessary files for production APK ───────────────────
  # We remove node_modules and hidden folders (.git, .vite, etc.) to avoid
  # Cordova platform-add issues (symlink loops) and keep the APK small.
  find "$build_dir/www" -mindepth 1 -name "node_modules" -exec rm -rf {} +
  find "$build_dir/www" -mindepth 1 -name ".*" -exec rm -rf {} +

  if [ ! -f "$build_dir/www/index.html" ]; then
    echo "  [SKIP] No index.html in $folder"
    return 1
  fi

  cat > "$build_dir/config.xml" <<XML
<?xml version='1.0' encoding='utf-8'?>
<widget id="${pkg}" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>${app_name}</name>
    <description>${folder}</description>
    <author email="jacob@jacobcreation.github.io" href="https://jacobcreation.github.io">Jacob</author>
    <content src="index.html" />
    <preference name="loglevel" value="DEBUG" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <allow-navigation href="*" />
    <access origin="*" />
    <preference name="android-minSdkVersion" value="22" />
    <preference name="android-targetSdkVersion" value="36" />
    <preference name="android-compileSdkVersion" value="36" />
</widget>
XML

  cd "$build_dir" || return 1

  if ! cordova platform add android --quiet >> "$log_file" 2>&1; then
    echo "  ✗ FAILED $folder (Platform error - see $log_file)"
    return 1
  fi

  if cordova build android --release --quiet --buildConfig="$SRC/build.json" -- --packageType=apk >> "$log_file" 2>&1; then

    local apk
    apk=$(find "$build_dir/platforms/android/app/build/outputs/apk/release" -name "*.apk" | head -1)

    if [ -n "$apk" ]; then
      cp "$apk" "$OUT/${safe_name}.apk"
      echo "  ✓ DONE $folder -> ${safe_name}.apk"
      return 0
    fi

    apk=$(find "$build_dir" -name "*.apk" | head -1)
    if [ -n "$apk" ]; then
      cp "$apk" "$OUT/${safe_name}.apk"
      echo "  ✓ DONE $folder -> ${safe_name}.apk"
      return 0
    fi

    echo "  ✗ FAILED $folder (No APK found - check $log_file)"
    return 1
  else
    echo "  ✗ FAILED $folder (Build error - see $log_file)"
    pkill -f GradleDaemon || true
    return 1
  fi
}

export -f build_project
export -f xml_escape
export -f safe_name_for_folder

# ── MAIN ─────────────────────────────────────────────────────────────────────
cd "$SRC" || exit 1

PROJECTS_FILE="/tmp/projects_list.txt"
> "$PROJECTS_FILE"

if [ ! -f "$REAL_NAMES_FILE" ]; then
  echo "Missing $REAL_NAMES_FILE"
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ""|\#*) continue ;;
  esac

  folder=${line%%=*}
  app_name=${line#*=}

  folder=$(echo "$folder" | sed 's/[[:space:]]*$//')
  app_name=$(echo "$app_name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  [ -z "$folder" ] && continue
  [ -z "$app_name" ] && continue

  case "$folder" in
    about|releases|downloads|node_modules|icons) continue ;;
  esac

  if [ -f "$folder/index.html" ]; then
    printf '%s\t%s\n' "$folder" "$app_name" >> "$PROJECTS_FILE"
  else
    echo "  [WARN] Skipping $folder (missing index.html)"
  fi
done < "$REAL_NAMES_FILE"

# ── FILTER (THIS MAKES ./build_apks.sh tanks WORK) ──────────────────────────
TARGET_FOLDER="${1:-}"

if [ -n "$TARGET_FOLDER" ]; then
  grep -E "^${TARGET_FOLDER}[[:space:]]" "$PROJECTS_FILE" > /tmp/projects_filtered.txt || true
  mv /tmp/projects_filtered.txt "$PROJECTS_FILE"
fi

TOTAL=$(wc -l < "$PROJECTS_FILE")
CURRENT=0
BUILT=0
SKIPPED=0
FAILED=0

echo "Found $TOTAL projects. Building sequentially..."

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

echo ""
echo "Summary of APKs in $OUT:"
ls -lh "$OUT/" | grep ".apk" || echo "No APKs built yet."
ls -lh "$OUT/" | grep ".apk" | wc -l | awk '{print $1 " APKs total."}'
echo "Built this run: $BUILT | Skipped: $SKIPPED | Failed: $FAILED"
