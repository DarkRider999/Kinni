# Feature map

Every item in the product spec and where it lives. `A:` = Android path under `android/`, `i:` = iOS path under `ios/`.

Status: **✅ implemented**, **◐ implemented with a platform limit** (see [Architecture → Platform limits](ARCHITECTURE.md#platform-limits-and-what-the-app-does-instead)).

## 1. App identity

| Item | Status | Where |
|---|---|---|
| Name “Nocternal Play”, “NOCTERNAL PLAYZ by Roshan” wordmark | ✅ | A: `app/src/main/res/values/strings.xml`, `core/designsystem/.../NeonComponents.kt` (`NeonLogo`) · i: `project.yml`, `UI/Theme.swift` |
| AMOLED backgrounds `#000000`, `#0A0A0F` | ✅ | A: `core/designsystem/.../NeonTheme.kt` · i: `UI/Theme.swift` |
| User-customisable neon accent | ✅ | Settings → Theme (A: `app/.../ui/SettingsScreen.kt`, i: `UI/SettingsView.swift`) |
| Theme modes Light / Dark / Neon / AMOLED | ✅ | `ThemeMode` in `core/model` · `NocternalTheme` |
| Auto theme by genre, mood or time | ✅ | `theme_manager/.../ThemeSwitcher.kt`, `TimeOfDayThemes.kt` · i: `NocternalKit/Sources/ThemeManager` |
| Animated cosmic backgrounds (9 styles) | ✅ | A: `core/designsystem/.../NeonBackground.kt` · i: `UI/Theme.swift` (`NeonBackground`) |

## 2. Core player

| Item | Status | Where |
|---|---|---|
| ExoPlayer (Android) / AVAudioEngine (iOS) | ✅ | A: `audio_engine/.../AudioEngine.kt` · i: `NocternalPlayz/Audio/AudioEngine.swift` |
| 10-band EQ | ✅ | A: `fx_engine/.../dsp/Equalizer.kt` · i: `AVAudioUnitEQ` in `AudioEngine.swift` |
| Bass boost, 3D surround, loudness enhancer | ✅ | A: `Equalizer.kt` (`BassBoost`), `dsp/Spatial.kt` (`Surround3D`), `FxChain.kt` (boost) · i: bass shelf + `CustomFxProcessor` |
| True gapless | ✅ | A: ExoPlayer playlist (encoder delay/padding) · i: back-to-back file chaining in `AudioEngine.swift` |
| Smart audio normalization | ✅ | `fx_engine/.../analysis/TrackAnalyzer.kt` (`LoudnessMeter`, `LoudnessNormalizer`) → normalization stage |
| Reverb, flanger, phaser, compressor, stereo widening, pitch shift | ✅ | A: `dsp/Spatial.kt`, `dsp/Modulation.kt`, `dsp/Dynamics.kt` · i: `AVAudioUnitReverb`, `AVAudioUnitTimePitch`, DynamicsProcessor, `FXEngine/DSP.swift` |
| AI vocal remover | ◐ | `dsp/Dynamics.kt` (`VocalRemover`), `FXEngine/DSP.swift` — centre-cancel DSP; ML model pluggable via `plugin_api` |
| Auto-fader / crossfade duration | ✅ | Android: overlapping crossfade — the next song starts on a second player before the current ends, equal-power blend, then hand-over (`AudioEngine.tickCrossfade`, `CrossfadeTiming`); 0–12 s, default 5 s. iOS: gapless back-to-back scheduling, no dip |
| Background playback, lock-screen + notification controls | ✅ | A: `audio_engine/.../PlaybackService.kt` (Media3 MediaSession) · i: `UIBackgroundModes: audio`, `MPRemoteCommandCenter` |
| Sleep timer (with fade, end-of-track) | ✅ | A: `audio_engine/.../SleepTimer.kt` · i: `AudioEngine.setSleepTimer` |
| Floating mini-player bubble | ◐ | A: `app/.../bubble/FloatingBubbleService.kt` (over other apps) · i: `FloatingBubble` in `UI/RootView.swift` (in-app) |
| Full device scan, metadata incl. genre, BPM, key | ✅ | A: `library_scanner/.../MediaStoreScanner.kt`, `AudioAnalyzer.kt` (on-device BPM/key via `TrackAnalyzer`) · i: `Library/LibraryStore.swift` |
| Auto genre playlists | ✅ | `playlists/.../SmartPlaylists.kt` (`genrePlaylists`) |
| Smart playlists: Favorites, Recently Played, Most Played, Mood | ✅ | `SmartPlaylists.kt` · i: `NocternalKit/Sources/Playlists` |
| Folder player | ✅ | `playlists/.../FolderTree.kt` → Home → Library → Folders |
| Playback history timeline | ✅ | `playlists/.../HistoryTimeline.kt` → Home → Library → History |

## 3. Multi-source sliding interface

| Item | Status | Where |
|---|---|---|
| Three horizontal panels: Local / YouTube Music / Radio Hub | ✅ | A: `app/.../ui/HomeScreen.kt` (`HorizontalPager`) · i: `UI/HomeView.swift` (paged `TabView`) |
| YouTube Music (WebView) | ◐ | A: `ui_youtube_panel/.../YouTubeMusicPanel.kt` · i: `UI/SourcePanels.swift` (`YouTubePanel`) |
| Free music & podcast downloads (Creative Commons / public domain only, licence + credit kept, offline play) | ◐ | A: `free_music/` (`InternetArchiveClient`, `JamendoClient`, `PodcastClient`), `app/.../FreeDownloader.kt`, `app/.../ui/FreeMusicScreen.kt` · i: not yet |
| Radio Hub (internet radio + FM) | ◐ | A: `ui_radio_panel/` (`RadioBrowserClient`, `RadioHubScreen`, `FmDial`) · i: `UI/SourcePanels.swift` |
| Neon transitions, edge lighting between panels, mini-player dock | ✅ | `HomeScreen.kt` (edge glow while swiping, animated neon tab indicator), `NocternalRoot.kt` (`MiniPlayerDock`) |

## 4. AI assistant

| Item | Status | Where |
|---|---|---|
| Playlist suggestions by genre, mood, BPM, time | ✅ | `ai_assistant/.../RecommendationEngine.kt` |
| EQ recommendations | ✅ | `RecommendationEngine.kt` (`EqAdvisor`, speaker vs headphones) |
| Explain audio features | ✅ | `ai_assistant/.../FeatureExplainer.kt` |
| Switch sources | ✅ | `CommandParser` → `AssistantAction.SwitchSource` |
| Voice commands (“Play trance playlist”, “Boost bass”, “Activate meditation theme”) | ✅ | `CommandParser.kt` (tested verbatim) + A: `app/.../voice/VoiceInput.kt` · i: `SpeechInput` in `Services/Services.swift` |
| AI Song Enhancer: clarity, noise removal, bass | ✅ | `fx_engine/.../SongEnhancer.kt` (+ vocal focus, old-recording restore) |
| Smart album art generator (neon) | ✅ | `ai_assistant/.../AlbumArtGenerator.kt` → rendered by `ui_player/.../NeonArt.kt` / `NeonArtView` |
| Music recognition | ◐ | A: `app/.../voice/MusicRecognizer.kt` (AudD, mic) · i: ShazamKit `SongRecognizer` |
| AI mood detection | ✅ | `ai_assistant/.../MoodDetector.kt` → `ThemeEvent.MoodDetected` |
| Free-form chat | ✅ | `ClaudeAssistantLlm.kt` (Anthropic Java SDK) · i: `ClaudeLLM` (Messages API) — optional user key |

## 5–6. Lighting

| Item | Status | Where |
|---|---|---|
| Neon reactive light bar, colour picker, glow slider, animation styles | ✅ | `lighting_effects/.../LightingComposables.kt` (`NeonLightBar`) + Lighting screen |
| Edge lighting: static / gradient / music reactive, thickness, brightness | ✅ | `LightingComposables.kt` (`EdgeLightingOverlay`) · i: `Lighting/Lighting.swift` |
| PulseWave Spectrum, HyperBeam Edge Flow, Aurora Ribbon, BassShock Flash, Prism Cycle, Vortex Spiral, EQ Bar Mirage, Starfall Reactive, Crystal Grid, Infinity Loop | ✅ | A: `lighting_effects/.../LightingAnimations.kt` · i: `Lighting/Lighting.swift` (`LightingCanvas`) |
| Music-reactive input | ✅ | post-FX `SpectrumAnalyzer` (32 log bands, bass/mid/treble, beat detection) |

## 7–9. Genres, presets, switching

| Item | Status | Where |
|---|---|---|
| 18 built-in genres with colour, lighting, EQ, AI suggestions, smart playlist, tiles, radio stations, theme | ✅ | `theme_manager/.../GenreCatalog.kt` — table in [THEMES.md](THEMES.md) |
| 10 spec presets + 9 more for the remaining genres | ✅ | `theme_manager/.../ThemePresets.kt` |
| Switching on song start, playlist open, mood, source change, tile | ✅ | `ThemeSwitcher.kt` (+ time of day, manual lock) — tested in `ThemeSwitcherTest.kt` |
| `ThemeManager / LightingEngine / EQManager / BackgroundManager` application | ✅ | `theme_manager/.../ThemeTargets.kt` (`ThemeApplier`) |

## 10. Screens

| Screen | Android | iOS |
|---|---|---|
| Home | `app/.../ui/HomeScreen.kt` | `UI/HomeView.swift` |
| Player | `ui_player/.../PlayerScreen.kt` | `UI/PlayerView.swift` |
| EQ & FX | `ui_player/.../EqFxScreen.kt` | `EQView` in `UI/PlayerView.swift` |
| Lighting | `app/.../ui/LightingScreen.kt` | `UI/LightingView.swift` |
| AI Assistant | `app/.../ui/AssistantPanel.kt` | `UI/AssistantView.swift` |
| Radio Hub | `ui_radio_panel/.../RadioHubScreen.kt` | `RadioView` in `UI/SourcePanels.swift` |
| Settings | `app/.../ui/SettingsScreen.kt` | `UI/SettingsView.swift` |
| Bottom nav Home / Player / Lighting / Settings | `NocternalRoot.kt` | `UI/RootView.swift` |

## 11. The 20 modern features

| # | Feature | Status | Where |
|---|---|---|---|
| 1 | Smart audio normalization | ✅ | `LoudnessNormalizer` + ReplayGain / measured loudness |
| 2 | True gapless playback | ✅ | ExoPlayer / chained AVAudioFile scheduling |
| 3 | Lyrics engine (online + offline + karaoke) | ✅ | `lyrics_engine/` (LRC + enhanced LRC words, sidecar `.lrc`, cache, LRCLIB exact + fuzzy search); when nothing exists, AI-written lyrics (Claude, or on-device `LyricWeaver`), labelled, replaced once real lyrics appear |
| 4 | AI mood detection | ✅ | `MoodDetector` |
| 5 | Floating mini-player bubble | ◐ | `FloatingBubbleService` / in-app bubble on iOS |
| 6 | Smart offline mode | ✅ | `offline_manager/.../OfflineManager.kt` (`ConnectivityMonitor`), panels show offline state |
| 7 | Advanced audio FX | ✅ | `fx_engine/.../FxChain.kt` |
| 8 | DJ auto-mix (BPM + key match) | ✅ | `auto_mix_engine/` + engine re-queue & time-stretch |
| 9 | AI album art generator | ✅ | `AlbumArtGenerator` |
| 10 | Speaker boost + safe mode | ✅ | `FxSettings.boostDb()` / `limiterCeilingDb()`, `OutputRouteMonitor` |
| 11 | Auto theme switching | ✅ | `ThemeSwitcher` |
| 12 | Folder player | ✅ | `FolderTree` |
| 13 | Playback history timeline | ✅ | `HistoryTimeline` |
| 14 | Plugin system | ✅ | `plugin_api/` (`PluginRegistry`, ServiceLoader discovery, crash isolation, 3 built-in plugins) |
| 15 | Backup & restore | ✅ | `backup_manager/` (cross-device, cross-platform JSON) |
| 16 | Voice commands | ✅ | `VoiceInput` / `SpeechInput` + `CommandParser` |
| 17 | Smart auto-download | ✅ | `AutoDownloadWorker` (WorkManager, Wi-Fi/battery constraints, lyrics for most-played & recent) |
| 18 | Private mode | ✅ | `AppSettings.privateMode` → no history, no scrobbles, history excluded from backups, no online lyrics lookups |
| 19 | Music recognition | ◐ | AudD / ShazamKit |
| 20 | AI song enhancer | ✅ | `SongEnhancer` |

## Tests

| Suite | Covers |
|---|---|
| `theme_manager` `ThemeSwitcherTest`, `GenreDetectorTest` | spec genre→preset map, switching rules, detection |
| `fx_engine` `FxEngineTest` | EQ transparency & gain, shelves, limiter ceiling, compressor curve, vocal remover, pitch shift, FFT, BPM (90–140), key detection, loudness, spectrum beat, Camelot |
| `auto_mix_engine` `AutoMixTest` | key relations, half/double tempo, ranking, bar-aligned transitions, fader envelope, equal-power curve |
| `playlists` `PlaylistsTest` | smart lists, skip filtering, genre playlists, folder tree, timeline |
| `lyrics_engine` `LyricsTest` | LRC parsing, karaoke sync, round trip, offline-first repository |
| `backup_manager` `BackupManagerTest` | cross-device matching, key exclusion, private mode, merge, v1 migration |
| `ai_assistant` `AssistantTest` | spec voice commands, intents, actions, LLM action round trip, mood, EQ advice |
| `plugin_api` `PluginRegistryTest` | crash isolation, commands, private mode |
| iOS `NocternalKitTests` | the same rules in Swift + Android backup JSON compatibility |
