#!/bin/bash

# Target directories
OUTPUT_BASE="$HOME/Desktop/electric_dist"
TEMP_BUILD_DIR="/tmp/electron_dist_$(date +%s)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check for wine
HAS_WINE=false
if command -v wine >/dev/null 2>&1; then
    HAS_WINE=true
fi

mkdir -p "$OUTPUT_BASE"
mkdir -p "$TEMP_BUILD_DIR"

# Check for real_names.txt in current directory first, then fallback
NAMES_FILE="real_names.txt"
if [ ! -f "$NAMES_FILE" ]; then
    NAMES_FILE="/tmp/test_names.txt"
fi

if [ ! -f "$NAMES_FILE" ]; then
    echo -e "${RED}Error: real_names.txt or /tmp/test_names.txt not found!${NC}"
    exit 1
fi

TOTAL_APPS=$(grep -v '^#' "$NAMES_FILE" | grep '=' | wc -l)
CURRENT_APP=0

draw_progress_bar() {
    local progress=$1
    local total=$2
    local label=$3
    local width=40
    local percent=$(( progress * 100 / total ))
    local filled=$(( progress * width / total ))
    local empty=$(( width - filled ))
    printf "\r${CYAN}[${NC}"
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "${CYAN}]${NC} %d%% (%d/%d) - ${YELLOW}%s${NC}" "$percent" "$progress" "$total" "$label"
}

package_folder() {
    local folder=$1
    local real_name=$2

    ((CURRENT_APP++))
    draw_progress_bar "$CURRENT_APP" "$TOTAL_APPS" "$real_name"
    echo ""

    if [ ! -d "$folder" ] || [ ! -f "$folder/index.html" ]; then
        echo -e "  ${RED}✖ Skip: Invalid folder '$folder'${NC}"
        return
    fi

    local app_dir="$TEMP_BUILD_DIR/$folder"
    mkdir -p "$app_dir"

    rsync -a \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='.vite' \
      --exclude='.codex' \
      "$folder/" "$app_dir/"

    local pkg_name=$(echo "$folder" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

    # package.json
    cat > "$app_dir/package.json" <<EOF
{
  "name": "$pkg_name",
  "productName": "$real_name",
  "version": "1.0.0",
  "main": "main.js",
  "author": {
    "name": "Jacob",
    "email": "jacob@example.com"
  },
  "homepage": "https://jacobcreation.github.io",
  "description": "$real_name",
  "build": {
    "appId": "com.jacob.$pkg_name",
    "asar": true,
    "linux": {
      "target": ["deb", "AppImage"],
      "category": "Game",
      "maintainer": "Jacob <jacob@example.com>"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "$real_name"
    },
    "directories": {
      "output": "dist"
    }
  }
}
EOF

    # main.js
    cat > "$app_dir/main.js" <<EOF
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
EOF

    local build_flags="--linux"
    local build_msg=".deb and .AppImage"

    if [ "$HAS_WINE" = true ]; then
        build_flags="--linux --win"
        build_msg=".deb, .AppImage, and Windows Setup"
    fi

    echo -e "  ${BLUE}→ Building $build_msg...${NC}"

    cd "$app_dir" && npm_config_prefix=$HOME/.npm-global npx electron-builder $build_flags -c.electronVersion=30.0.0 > "$TEMP_BUILD_DIR/build_$folder.log" 2>&1
    local status=$?
    cd - > /dev/null

    if [ $status -eq 0 ]; then
        mkdir -p "$OUTPUT_BASE/$folder"

        find "$app_dir/dist" -name "*.deb" -exec cp {} "$OUTPUT_BASE/$folder/" \;
        find "$app_dir/dist" -name "*.AppImage" -exec cp {} "$OUTPUT_BASE/$folder/" \;

        if [ "$HAS_WINE" = true ]; then
            find "$app_dir/dist" -name "*.exe" -exec cp {} "$OUTPUT_BASE/$folder/" \;
        fi

        echo -e "  ${GREEN}✔ Success! Files moved to $OUTPUT_BASE/$folder/${NC}"
    else
        echo -e "  ${RED}✖ Failed! See $TEMP_BUILD_DIR/build_$folder.log${NC}"
    fi

    rm -rf "$app_dir"
}

echo -e "${YELLOW}===================================================${NC}"
echo -e "${YELLOW} ELECTRON INSTALLER BUILDER (DEB/APPIMAGE/EXE)${NC}"
echo -e "${YELLOW}===================================================${NC}"
echo -e "Reading apps from: $NAMES_FILE"

# ── TASK LIST ─────────────────────────────────────────────
grep '=' "$NAMES_FILE" | grep -v '^#' > "$TEMP_BUILD_DIR/tasks.txt"

TARGET="${1:-}"

if [ -n "$TARGET" ]; then
    grep "^$TARGET *=" "$TEMP_BUILD_DIR/tasks.txt" > "$TEMP_BUILD_DIR/tasks_filtered.txt" || true
    mv "$TEMP_BUILD_DIR/tasks_filtered.txt" "$TEMP_BUILD_DIR/tasks.txt"
fi

TOTAL_APPS=$(wc -l < "$TEMP_BUILD_DIR/tasks.txt")
CURRENT_APP=0

while IFS='=' read -r folder name || [ -n "$folder" ]; do
    folder=$(echo "$folder" | xargs)
    name=$(echo "$name" | xargs)

    [ -z "$folder" ] && continue
    [ -z "$name" ] && continue

    package_folder "$folder" "$name"

done < "$TEMP_BUILD_DIR/tasks.txt"

rm -rf "$TEMP_BUILD_DIR"

echo -e "\n${GREEN}DONE! Check $OUTPUT_BASE for your installers.${NC}"
