# Build instructions

## 1. Install tools
1. Install Flutter stable and add `flutter/bin` to PATH.
2. Install Android Studio and Android SDK Platform 35, Build Tools 35, and platform tools.
3. Install/use JDK 17.
4. Run `flutter doctor -v`; accept Android licenses with `flutter doctor --android-licenses`.

## 2. Resolve dependencies
From the project root:
```bash
flutter clean
flutter pub get
flutter analyze
```

## 3. Run on a device/emulator
```bash
flutter devices
flutter run
```

## 4. Build artifacts
```bash
flutter build apk --debug
flutter build apk --release
flutter build appbundle
flutter build apk --split-per-abi
```

Expected outputs:
- `build/app/outputs/flutter-apk/app-debug.apk`
- `build/app/outputs/flutter-apk/app-release.apk`
- `build/app/outputs/bundle/release/app-release.aab`
- Split APKs: `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`, `app-armeabi-v7a-release.apk`, and `app-x86_64-release.apk`

## SDK/build configuration
- compileSdk 35, targetSdk 35, minSdk 24
- Java/Kotlin bytecode target 17
- Android Gradle Plugin 8.6.1 / Gradle 8.7 wrapper
- R8 minification and resource shrinking enabled for release

Toolchain versions should be validated against the installed Flutter stable release before production release.
