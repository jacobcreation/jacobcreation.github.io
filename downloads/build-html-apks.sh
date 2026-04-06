#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/apk-output}"
BUILD_ROOT="${2:-$ROOT_DIR/.apk-build}"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Android/Sdk}}"

if [[ "$OUTPUT_DIR" != /* ]]; then
  OUTPUT_DIR="$ROOT_DIR/$OUTPUT_DIR"
fi

if [[ "$BUILD_ROOT" != /* ]]; then
  BUILD_ROOT="$ROOT_DIR/$BUILD_ROOT"
fi

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  value="${value//\"/&quot;}"
  value="${value//\'/&apos;}"
  printf '%s' "$value"
}

slugify() {
  local value="$1"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  value="$(printf '%s' "$value" | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/__+/_/g')"
  if [[ -z "$value" ]]; then
    value="app"
  fi
  if [[ "$value" =~ ^[0-9] ]]; then
    value="app_$value"
  fi
  printf '%s' "$value"
}

pick_latest_dir() {
  local base="$1"
  find "$base" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort -V | tail -n 1
}

need_cmd javac
need_cmd keytool
need_cmd jar
need_cmd zip

[[ -d "$SDK_ROOT" ]] || fail "Android SDK not found at $SDK_ROOT"

BUILD_TOOLS_VERSION="$(pick_latest_dir "$SDK_ROOT/build-tools")"
PLATFORM_VERSION="$(pick_latest_dir "$SDK_ROOT/platforms")"

[[ -n "$BUILD_TOOLS_VERSION" ]] || fail "No Android build-tools found in $SDK_ROOT/build-tools"
[[ -n "$PLATFORM_VERSION" ]] || fail "No Android platforms found in $SDK_ROOT/platforms"

BUILD_TOOLS_DIR="$SDK_ROOT/build-tools/$BUILD_TOOLS_VERSION"
ANDROID_JAR="$SDK_ROOT/platforms/$PLATFORM_VERSION/android.jar"
AAPT2="$BUILD_TOOLS_DIR/aapt2"
D8="$BUILD_TOOLS_DIR/d8"
ZIPALIGN="$BUILD_TOOLS_DIR/zipalign"
APKSIGNER="$BUILD_TOOLS_DIR/apksigner"

[[ -f "$ANDROID_JAR" ]] || fail "android.jar not found at $ANDROID_JAR"
[[ -x "$AAPT2" ]] || fail "aapt2 not found at $AAPT2"
[[ -x "$D8" ]] || fail "d8 not found at $D8"
[[ -x "$ZIPALIGN" ]] || fail "zipalign not found at $ZIPALIGN"
[[ -x "$APKSIGNER" ]] || fail "apksigner not found at $APKSIGNER"

mkdir -p "$OUTPUT_DIR" "$BUILD_ROOT"

KEYSTORE="$BUILD_ROOT/debug.keystore"
if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" \
    >/dev/null 2>&1 || fail "Failed to create debug keystore"
fi

JAVA_SOURCE_TEMPLATE() {
  cat <<'EOF'
package __PACKAGE__;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
EOF
}

build_one() {
  local html_file="$1"
  local base_name label slug package_name app_dir src_dir package_dir java_file manifest_file unsigned_apk aligned_apk final_apk
  local escaped_label dex_output_dir stage_dir classes_jar

  base_name="${html_file%.html}"
  label="$base_name"
  slug="$(slugify "$base_name")"
  package_name="com.jacobcreation.offline.${slug}"
  app_dir="$BUILD_ROOT/$slug"
  src_dir="$app_dir/src"
  package_dir="$src_dir/$(printf '%s' "$package_name" | tr '.' '/')"
  java_file="$package_dir/MainActivity.java"
  manifest_file="$app_dir/AndroidManifest.xml"
  unsigned_apk="$app_dir/${slug}-unsigned.apk"
  aligned_apk="$app_dir/${slug}-aligned.apk"
  final_apk="$OUTPUT_DIR/${slug}.apk"
  dex_output_dir="$app_dir/dex"
  stage_dir="$app_dir/stage"
  classes_jar="$app_dir/classes.jar"
  escaped_label="$(xml_escape "$label")"

  rm -rf "$app_dir"
  mkdir -p "$package_dir" "$app_dir/assets" "$dex_output_dir" "$stage_dir/assets"

  cp "$ROOT_DIR/$html_file" "$app_dir/assets/index.html"
  cp "$ROOT_DIR/$html_file" "$stage_dir/assets/index.html"

  cat >"$manifest_file" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="$package_name">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:hardwareAccelerated="true"
        android:label="$escaped_label"
        android:theme="@android:style/Theme.DeviceDefault.Light.NoActionBar"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:configChanges="keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

  JAVA_SOURCE_TEMPLATE | sed "s/__PACKAGE__/$package_name/g" >"$java_file"

  javac \
    -source 8 \
    -target 8 \
    -bootclasspath "$ANDROID_JAR" \
    -d "$app_dir/classes" \
    "$java_file" \
    >/dev/null 2>&1 || return 1

  (
    cd "$app_dir/classes" || exit 1
    jar cf "$classes_jar" .
  ) >/dev/null 2>&1 || return 1

  "$D8" \
    --lib "$ANDROID_JAR" \
    --output "$dex_output_dir" \
    "$classes_jar" \
    >/dev/null 2>&1 || return 1

  "$AAPT2" link \
    --manifest "$manifest_file" \
    -I "$ANDROID_JAR" \
    --min-sdk-version 24 \
    --target-sdk-version 34 \
    -o "$unsigned_apk" \
    >/dev/null 2>&1 || return 1

  cp "$dex_output_dir/classes.dex" "$stage_dir/classes.dex"
  (
    cd "$stage_dir" || exit 1
    zip -qur "$unsigned_apk" classes.dex assets
  ) || return 1

  "$ZIPALIGN" -f 4 "$unsigned_apk" "$aligned_apk" >/dev/null 2>&1 || return 1

  "$APKSIGNER" sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:android \
    --key-pass pass:android \
    --ks-key-alias androiddebugkey \
    --out "$final_apk" \
    "$aligned_apk" \
    >/dev/null 2>&1 || return 1

  printf 'Built %s -> %s\n' "$html_file" "$final_apk"
}

shopt -s nullglob
html_files=("$ROOT_DIR"/*.html)
(( ${#html_files[@]} > 0 )) || fail "No HTML files found in $ROOT_DIR"

success_count=0
failed_files=()

for html_path in "${html_files[@]}"; do
  html_name="$(basename "$html_path")"
  if build_one "$html_name"; then
    success_count=$((success_count + 1))
  else
    failed_files+=("$html_name")
    printf 'Failed to build %s\n' "$html_name" >&2
  fi
done

printf '\nBuilt %d APK(s) into %s\n' "$success_count" "$OUTPUT_DIR"

if (( ${#failed_files[@]} > 0 )); then
  printf 'Failed files:\n' >&2
  for item in "${failed_files[@]}"; do
    printf '  - %s\n' "$item" >&2
  done
  exit 1
fi
