#!/bin/bash

# ── Environment ──────────────────────────────────────────────────────────────
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/build-tools/34.0.0:$ANDROID_HOME/platform-tools:/home/jacob/.gradle/wrapper/dists/gradle-8.14.3-all/10utluxaxniiv4wxiphsi49nj/gradle-8.14.3/bin:$PATH"
export SRC="/home/jacob/Desktop/jacobcreation.github.io"
export OUT="/home/jacob/Desktop/APK"
export WORK="/tmp/cordova_build"
export CORDOVA_TELEMETRY_OPTOUT=1

mkdir -p "$OUT"
mkdir -p "$WORK"

# ── Function for building a single project ───────────────────────────────────
build_project() {
  local folder="$1"
  local safe_name
  safe_name=$(echo "$folder" | sed 's/[^a-zA-Z0-9]/_/g' | tr '[:upper:]' '[:lower:]' | sed 's/^[0-9]/p&/')
  local pkg="com.jacobcreation.app_${safe_name}"
  local build_dir="$WORK/$safe_name"
  local app_name="Project_${safe_name}"
  local log_file="$build_dir/build.log"

  # Skip if already exists
  if [ -f "$OUT/${safe_name}.apk" ]; then
    echo "  [SKIP] $folder (Already built)"
    return 0
  fi

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
  
  if cordova build android --release --quiet -- --packageType=apk >> "$log_file" 2>&1; then

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
    pkill -f GradleDaemon || true
    return 1
  fi
  pkill -f GradleDaemon || true
}

export -f build_project

# ── Main ──────────────────────────────────────────────────────────────────────
cd "$SRC" || exit 1

# Gather projects
export PROJECTS_FILE="/tmp/projects_list.txt"
> "$PROJECTS_FILE"
for d in */; do
  dir_name="${d%/}"
  # Blacklist
  if [[ "$dir_name" == "about" || "$dir_name" == "releases" || "$dir_name" == "downloads" || "$dir_name" == "node_modules" || "$dir_name" == ".git" || "$dir_name" == ".github" || "$dir_name" == ".codex" || "$dir_name" == "icons" ]]; then
    : 
  fi
  
  # Filter for directories with index.html
  if [ -f "$d/index.html" ]; then
    # Exclude root from loops
    if [ "$dir_name" != "." ]; then
       # Additional check to exclude folders that aren't games or were manually excluded
       case "$dir_name" in
         about|releases|downloads|node_modules|icons) continue ;;
       esac
       echo "$dir_name" >> "$PROJECTS_FILE"
    fi
  fi
done

TOTAL=$(wc -l < "$PROJECTS_FILE")
echo "Found $TOTAL projects. Building them in sequence (one by one)..."

# Run in sequence using xargs
cat "$PROJECTS_FILE" | xargs -P 1 -I {} bash -c 'build_project "{}"'



echo ""
echo "Summary of APKs in $OUT:"
ls -lh "$OUT/" | grep ".apk" || echo "No APKs built yet."
ls -lh "$OUT/" | grep ".apk" | wc -l | awk '{print $1 " APKs total."}'

