#!/usr/bin/env bash

KEYSTORE="my-release-key.jks"
ALIAS="mykey"
OUT_DIR="signed"

mkdir -p "$OUT_DIR"

shopt -s nullglob

for apk in *.apk; do
  if [[ "$apk" == *_signed.apk ]]; then
    continue
  fi

  echo "Signing $apk"

  base="${apk%.apk}"
  output="$OUT_DIR/${base}_signed.apk"

  apksigner sign \
    --ks "$KEYSTORE" \
    --ks-key-alias "$ALIAS" \
    --out "$output" \
    "$apk"

  apksigner verify "$output"

done

echo "DONE"
