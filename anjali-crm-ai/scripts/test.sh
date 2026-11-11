#!/usr/bin/env bash
# Static analysis + full unit/widget test suite. Exit code is non-zero on any failure.
set -euo pipefail
cd "$(dirname "$0")/.."
flutter pub get
flutter analyze --fatal-infos
flutter test --coverage
echo "All checks passed. Coverage: coverage/lcov.info"
