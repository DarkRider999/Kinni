# SubZero — Android

Kotlin + Jetpack Compose, MVVM. Standalone Gradle project.

## Build
```
cd subzero/android
./gradlew :app:assembleDebug      # or open in Android Studio
./gradlew :app:testDebugUnitTest  # runs the crypto round-trip tests
```
Requires Android SDK (compileSdk 35), JDK 17. minSdk 31 (for JCA XDH/Ed25519 +
StrongBox). Add a Gradle wrapper with `gradle wrapper` on first checkout.

## Highlights
- `crypto/` — X3DH + Double Ratchet (AES-256-GCM, HKDF-SHA256), Keystore master
  key. Round-trip verified (`RatchetTest`).
- `data/` — RAM-only `RamMessageBuffer`, `ChatRepository` (transport injected).
- `identity/` — launcher-alias icon/name switching.
- `security/` — biometric `AppLock`, `ScreenSecurity` (FLAG_SECURE), root
  *awareness* (warns, never wipes).
- `ui/safezone/` — quick-hide controller, no-repeat picker, games (2048,
  Tic-Tac-Toe complete; others scaffolded).
- `ui/decoy/` — working Calculator.

See `../docs/SECURITY.md`.
