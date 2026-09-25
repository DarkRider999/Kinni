# SubZero — iOS

Swift + SwiftUI implementation. No `.xcodeproj` is committed (it is machine-
generated and noisy); create a target and drop the `SubZero/` group in, or use
the layout below with Xcode's "App" template.

## Requirements
- iOS 16+ (uses `onChange(of:_:)` two-parameter form, CryptoKit, Secure Enclave).
- Xcode 15+.

## Creating the target
1. New Project → App → SwiftUI → name it `SubZero`.
2. Delete the generated `ContentView`/`@main` and add the files under
   `SubZero/` (the `@main` entry is `SubZeroApp.swift`).
3. Link `CryptoKit` and `LocalAuthentication` (both are system frameworks).

## Required Info.plist keys
```xml
<key>NSFaceIDUsageDescription</key>
<string>Unlock SubZero and protect your private messages.</string>

<!-- Alternate app icons for identity switching -->
<key>CFBundleIcons</key>
<dict>
  <key>CFBundleAlternateIcons</key>
  <dict>
    <key>IconCalculator</key><dict><key>CFBundleIconFiles</key><array><string>IconCalculator</string></array></dict>
    <key>IconNotes</key><dict><key>CFBundleIconFiles</key><array><string>IconNotes</string></array></dict>
    <key>IconWeather</key><dict><key>CFBundleIconFiles</key><array><string>IconWeather</string></array></dict>
    <key>IconGallery</key><dict><key>CFBundleIconFiles</key><array><string>IconGallery</string></array></dict>
    <key>IconSystem</key><dict><key>CFBundleIconFiles</key><array><string>IconSystem</string></array></dict>
  </dict>
</dict>
```

## Screenshot protection (note)
iOS has no direct `FLAG_SECURE`. The common technique is a `UITextField` with
`isSecureTextEntry = true` whose secure layer hosts the app content, plus
blanking the UI on `willResignActive` for the app-switcher snapshot. This is
scaffolded as `TODO(subzero)` in the app-switcher blanking; the background
re-lock (in `SubZeroApp`) already hides content behind the lock gate.

## What's implemented
- `Crypto/`: Double Ratchet (Curve25519 + ChaChaPoly + HKDF), Secure Enclave
  identity key, KDF. The crypto mirrors the Android core (validated round-trip).
- `Features/Chat`: RAM-only buffer, chat UI + view model, disappearing timer.
- `Features/SafeZone`: controller, no-repeat picker, Tic-Tac-Toe game, host view
  with hidden return gesture.
- `Features/Decoy`: working Calculator.
- `Identity`: alternate-icon switching + random rotation.

See `../docs/SECURITY.md` for the security model and the deliberately excluded
anti-forensic features.
