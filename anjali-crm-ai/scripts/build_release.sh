#!/usr/bin/env bash
# Builds signed release APKs (per ABI) and an App Bundle.
# Firebase is optional: if config/firebase.json exists it is injected.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f android/key.properties ]] || { echo "android/key.properties missing: run scripts/gen_keystore.sh first"; exit 1; }
DEFINES=()
[[ -f config/firebase.json ]] && DEFINES=(--dart-define-from-file=config/firebase.json)
flutter pub get
flutter test
flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/symbols "${DEFINES[@]}"
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols "${DEFINES[@]}"
echo "APKs:   build/app/outputs/flutter-apk/"
echo "Bundle: build/app/outputs/bundle/release/app-release.aab"
