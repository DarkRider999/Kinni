# Release signing and distribution

## Create an upload keystore
Run from a secure directory and keep multiple secure backups. Never commit the keystore or passwords to source control.

```bash
keytool -genkeypair -v \
  -keystore upload-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias upload
```

Move `upload-keystore.jks` into the project root (same level as `pubspec.yaml`). Create `android/key.properties` from `android/key.properties.example`, then update its values:

```properties
storePassword=YOUR_REAL_STORE_PASSWORD
keyPassword=YOUR_REAL_KEY_PASSWORD
keyAlias=upload
storeFile=../upload-keystore.jks
```

Add these to `.gitignore`:
```gitignore
/android/key.properties
/upload-keystore.jks
```

The Gradle release signing configuration uses `android/key.properties` when it exists. Without it, do not treat the output as a signed production release.

## Build release files
```bash
flutter clean
flutter pub get
flutter build apk --release
flutter build appbundle
flutter build apk --split-per-abi
```

## Outputs
- Universal APK: `build/app/outputs/flutter-apk/app-release.apk`
- AAB: `build/app/outputs/bundle/release/app-release.aab`
- ABI-specific APKs under `build/app/outputs/flutter-apk/`

## Play Console
Upload the AAB to Play Console and use Play App Signing unless your release process has a different approved setup. Verify package name, version code, privacy disclosures, permission declarations, target API requirements, and all store listing assets before rollout.

## Production safeguards
- Store keystore backups securely and document who has access.
- Never email keystore passwords with the keystore.
- Test upgrade installation over the previous production build.
- Validate R8 release behavior on physical devices.
- Confirm every permission is justified by a user-facing feature.
