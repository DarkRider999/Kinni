# Installation

## Install debug APK
1. Build with `flutter build apk --debug`.
2. Transfer `build/app/outputs/flutter-apk/app-debug.apk` to your Android device.
3. Allow installation from the file manager if Android asks.
4. Open Anjali CRM AI.

## Install release APK
1. Configure release signing using `RELEASE.md`.
2. Run `flutter build apk --release`.
3. Transfer `build/app/outputs/flutter-apk/app-release.apk` to the device.
4. Install and perform the smoke tests in `QA_CHECKLIST.md`.

Do not distribute a debug-signed build as a production release.
