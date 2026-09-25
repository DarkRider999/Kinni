# NOCTERNAL PLAYZ by Roshan

**Nocternal Play** is a neon-dark music player for Android and iOS: local files, YouTube Music and a Radio Hub in three sliding panels, a full effects chain, genre-aware neon themes, ten music-reactive lighting animations and an AI assistant.

```
nocternal-playz/
├── android/                 Kotlin + Jetpack Compose + Media3/ExoPlayer (Gradle multi-module)
│   ├── core/model           shared data types (Track, presets, settings, Camelot keys)
│   ├── core/designsystem    neon Compose theme + components
│   ├── theme_manager        genres, neon theme presets, EQ presets, genre → theme switching
│   ├── fx_engine            DSP chain + BPM/key/loudness analysis + spectrum (pure Kotlin)
│   ├── audio_engine         ExoPlayer + FX AudioProcessor, MediaSession service, fader, sleep timer
│   ├── auto_mix_engine      DJ auto-mix (Camelot + tempo), crossfade curves, auto-fader
│   ├── playlists            smart playlists, folder tree, history timeline
│   ├── ai_assistant         command parser, mood, recommendations, EQ advice, art, Claude backend
│   ├── lyrics_engine        LRC/enhanced LRC, karaoke sync, offline cache, LRCLIB
│   ├── backup_manager       cross-device backup & restore
│   ├── plugin_api           plugin system (+ scrobbler, pomodoro, beat counter)
│   ├── library_scanner      MediaStore scan + on-device BPM/key analysis
│   ├── lighting_effects     light bar, edge lighting, the 10 animations
│   ├── offline_manager      smart offline mode, auto-download worker
│   ├── ui_player            player, EQ & FX, lyrics, album art
│   ├── ui_youtube_panel     YouTube Music WebView panel
│   ├── ui_radio_panel       Radio Hub + FM dial
│   └── app                  navigation, Home, Lighting, Settings, AI panel, floating bubble
├── ios/
│   ├── NocternalKit/        Swift package mirroring the shared modules (+ tests)
│   ├── NocternalPlayz/      SwiftUI app (AVAudioEngine, ShazamKit, Speech, WKWebView)
│   └── project.yml          XcodeGen project definition
└── docs/                    architecture, feature map, themes & genres
```

## Build

**Android** (Android Studio Ladybug+ or JDK 17 + Android SDK 35):

```bash
cd nocternal-playz/android
./gradlew :app:assembleDebug          # APK in app/build/outputs/apk/debug/
./gradlew test                        # unit tests for the shared modules
```

**iOS** (Xcode 16, iOS 17+):

```bash
cd nocternal-playz/ios
swift test --package-path NocternalKit   # shared-module tests
brew install xcodegen && xcodegen generate
open NocternalPlayz.xcodeproj            # set your team, then run
```

CI (`.github/workflows/nocternal-playz.yml`) runs both on every push and publishes the debug APK as an artifact.

## Optional keys

| Feature | Key | Where |
|---|---|---|
| Free-form AI chat (commands work without it) | Claude API key | Settings → AI. Stored on-device only (Android DataStore / iOS Keychain), never in backups. |
| Song recognition on Android | [AudD](https://audd.io) token | Settings → AI. iOS uses Apple's ShazamKit, no key. |

Lyrics (LRCLIB) and radio (Radio Browser) are free, keyless public services.

For a public release, route AI requests through your own server instead of asking users for a key.

## Docs

- [Architecture](docs/ARCHITECTURE.md): modules, audio pipeline, theme switching, data flow
- [Feature map](docs/FEATURES.md): every item in the product spec and the file that implements it
- [Themes & genres](docs/THEMES.md): the 18 genres, 19 neon presets, EQ presets and the 10 animations
