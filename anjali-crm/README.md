# Anjali CRM AI

Offline-first Flutter CRM for Android. Package: `com.anjali.crm.ai`, version `1.0.0+1`.

## What the app does today
- Purple Material 3 interface with system dark/light theme
- Local SQLite contacts: create, search, edit, delete, with name/phone/email validation
- Follow-up activities: create, edit, delete, complete, optional due date, linked to a contact
- Deleting a contact keeps its activities and unlinks them (one transaction, foreign keys enforced)
- Dashboard counts (contacts, open activities) with pull-to-refresh
- Every list shows an error with **Retry** if the database cannot be read
- Device biometric check and preference (the preference is stored; an app-wide lock is not enforced yet)
- Customer data is excluded from Google cloud backup and device-to-device transfer

The user guide (`Anjali-CRM-AI-User-Guide.pdf`) describes the full target product (PIN lock,
document vault, loan pipeline, WhatsApp, reports, backup, sync). Most of that is **not built yet**;
treat the guide as the roadmap, not as a description of this build.

## Toolchain
Flutter 3.50.1 stable (Dart 3.12), JDK 17, Android SDK platform 36. `flutter doctor -v` must be clean
for Android.

## Build, test and run
```bash
cd anjali-crm
flutter pub get
flutter analyze          # must report "No issues found"
flutter test             # unit, database and widget tests
flutter run              # on a connected device or emulator
flutter build apk --release
```

Release signing reads `android/key.properties` (see `key.properties.example` and `RELEASE.md`).
Without it the release APK is signed with the local **debug** key and Gradle prints a warning:
that APK installs, but a later build signed with a different key will not install over it.

## Continuous integration
`.github/workflows/anjali-crm-ai.yml` (workflow **Anjali CRM AI**) runs analyze, tests and a release
build on every change under `anjali-crm/`, and uploads the APK as the artifact **anjali-crm-ai-apk**.
To sign CI builds with the real release key, add these repository secrets:

| Secret | Value |
|---|---|
| `ANJALI_KEYSTORE_BASE64` | `base64 -w0 upload-keystore.jks` |
| `ANJALI_KEYSTORE_PASSWORD` | keystore password |
| `ANJALI_KEY_PASSWORD` | key password |
| `ANJALI_KEY_ALIAS` | key alias (for example `upload`) |

Until they are set, CI builds are debug-signed and the run summary says so.

## Permissions policy
The manifest requests only `USE_BIOMETRIC`. Add a permission in the same change as the feature that
uses it, and request sensitive permissions at the point of use.
