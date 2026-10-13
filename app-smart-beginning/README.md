# Smart Beginning — Flutter app (Phase-0 scaffold)

Early-learning app for children aged 0–10. This directory is the Flutter
implementation; the full product/UX/technical blueprint is in
[`../docs/smart-beginning/SPEC.md`](../docs/smart-beginning/SPEC.md).

## What Phase 0 contains

A verifiable foundation (SPEC §13.4, Phase 0):

- **Design system** — tokens (`lib/design/tokens.dart`) and light/dark theme
  (`lib/design/theme.dart`) mirroring SPEC §2.
- **Routing + guards** — `go_router` with the child-mode / parent-mode
  boundary enforced as a redirect guard (`lib/app/router.dart`,
  `lib/app/guards.dart`, SPEC §4.2).
- **Parent gate + session** — in-memory elevation with a 5-minute TTL
  (`lib/core/parent_session.dart`, SPEC §9.3).
- **Shell + screens** — Splash, Age Selection, 7-tab Home shell, Parent Gate,
  Parent Control sections list.
- **Tests** — pure guard logic, parent-session TTL, and an Age Selection
  widget test.

Screens are intentionally minimal placeholders beyond the foundation; the
learning worlds, media, rewards, and full parent dashboard are Phases 1–3.

## Run the gates (what "done" means here)

```bash
cd app-smart-beginning
flutter pub get
flutter analyze        # static analysis, must be clean
flutter test           # unit + widget tests, must pass
```

## Run the app

```bash
flutter run            # on a connected device/emulator
```

## Build an APK (requires a normal Flutter + Android SDK install)

The `android/` platform folder is committed, so on any machine with Flutter
installed the debug build is a single command — no `flutter create` needed:

```bash
flutter pub get
flutter build apk --debug    # → build/app/outputs/flutter-apk/app-debug.apk
```

(iOS and other platform folders are not committed; run
`flutter create --platforms=ios .` if you need them.)

A **signed release** APK/AAB additionally needs a keystore and signing config
(`android/key.properties` + `key.jks`, kept out of git) and Play Billing /
Firebase wiring — see SPEC §13.5 for the full path.

## Conventions

- `domain`/pure logic has no Flutter imports (testable in isolation).
- Nothing uses a raw hex or magic number — only design tokens.
- Fonts (Baloo 2 / Poppins / Nunito) are named in tokens and bundled in
  Phase 1; until then they fall back to the platform default so the build and
  tests stay hermetic.
