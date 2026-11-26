#!/usr/bin/env bash
# Creates the release upload keystore (run ONCE, then back it up safely).
set -euo pipefail
cd "$(dirname "$0")/.."
KEYSTORE=anjali-release.jks
if [[ -f "$KEYSTORE" ]]; then echo "$KEYSTORE already exists. Refusing to overwrite."; exit 1; fi
keytool -genkeypair -v -keystore "$KEYSTORE" -alias anjali -keyalg RSA -keysize 4096 -validity 10000
cp -n android/key.properties.example android/key.properties
echo "Now fill android/key.properties with the passwords you just chose."
