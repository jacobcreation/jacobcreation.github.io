#!/bin/bash

# Configuration
PROJECTS_FILE="/tmp/projects_list.txt"
APK_DIR="/home/jacob/Desktop/APK"
LOG_DIR="/tmp/cordova_logs"

# Function to get safe name (same as in build_apks.sh)
get_safe_name() {
  echo "$1" | sed 's/[^a-zA-Z0-9]/_/g' | tr '[:upper:]' '[:lower:]' | sed 's/^[0-9]/p&/'
}

# Check if projects file exists
if [ ! -f "$PROJECTS_FILE" ]; then
    echo "Error: Projects list not found. Is the build running?"
    exit 1
fi

TOTAL=$(wc -l < "$PROJECTS_FILE")

while true; do
    DONE=0
    while read -r project; do
        SAFE_NAME=$(get_safe_name "$project")
        if [ -f "$APK_DIR/${SAFE_NAME}.apk" ]; then
            ((DONE++))
        fi
    done < "$PROJECTS_FILE"

    PERCENT=$(( DONE * 100 / TOTAL ))
    REMAINING=$(( TOTAL - DONE ))
    
    # Get currently building project (newest log file)
    CURRENT=$(ls -t "$LOG_DIR" 2>/dev/null | head -n 1 | sed 's/\.log//')
    
    clear
    echo "=========================================="
    echo "       APK BUILD PROGRESS TRACKER"
    echo "=========================================="
    echo "Total Projects:   $TOTAL"
    echo "Completed:        $DONE"
    echo "Remaining:        $REMAINING"
    echo "Percentage:       $PERCENT%"
    
    # Progress Bar
    BAR_SIZE=20
    FILLED=$(( DONE * BAR_SIZE / TOTAL ))
    EMPTY=$(( BAR_SIZE - FILLED ))
    
    printf "["
    for ((i=0; i<FILLED; i++)); do printf "#"; done
    for ((i=0; i<EMPTY; i++)); do printf "-"; done
    printf "] $PERCENT%%\n"
    
    if [ -n "$CURRENT" ] && [ "$DONE" -lt "$TOTAL" ]; then
        echo "Currently processing: $CURRENT"
    fi
    
    if [ "$DONE" -eq "$TOTAL" ]; then
        echo "=========================================="
        echo "        BUILD COMPLETE! 🎉"
        exit 0
    fi
    
    echo "=========================================="
    echo "Updating every 5 seconds... (Ctrl+C to stop)"
    sleep 5
done
