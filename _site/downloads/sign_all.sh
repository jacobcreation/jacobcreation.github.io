#!/bin/bash

# Configuration
KEYSTORE="user.keystore"
ALIAS="userkey"
PASS="password123"
DNAME="CN=User, O=Development, C=US"

# Check for apksigner
if ! command -v apksigner &> /dev/null; then
    echo "Error: apksigner not found. Please install android-sdk-build-tools."
    exit 1
fi

# Generate keystore if it doesn't exist
if [ ! -f "$KEYSTORE" ]; then
    echo "Generating new keystore: $KEYSTORE"
    keytool -genkey -v -keystore "$KEYSTORE" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -storepass "$PASS" -keypass "$PASS" -dname "$DNAME"
fi

# Sign all APKs
for apk in *.apk; do
    if [ -f "$apk" ]; then
        echo "Signing $apk..."
        apksigner sign --ks "$KEYSTORE" --ks-pass pass:"$PASS" --ks-key-alias "$ALIAS" --key-pass pass:"$PASS" "$apk"
        if [ $? -eq 0 ]; then
            echo "Successfully signed $apk"
        else
            echo "Failed to sign $apk"
        fi
    fi
done

echo "Done!"
