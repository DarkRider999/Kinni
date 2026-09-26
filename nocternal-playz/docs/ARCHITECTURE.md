# Architecture

## Principles

- **Shared core, native shells.** Everything that is logic (genres, themes, switching rules, DSP, auto-mix, playlists, lyrics, backup, AI) lives in platform-free modules: pure Kotlin/JVM on Android, a Swift package on iOS. They carry the same rules and the same tests, and read and write the same backup JSON.
- **One-way data flow.** Engines expose state (`StateFlow` / `@Published`); screens render it and call methods back. The AI assistant never touches the player: it returns *actions* that the app executes.
- **Offline first.** Library, FX, lighting, themes and all assistant commands work without a network. Online features (lyrics download, radio, YouTube Music, Claude chat) degrade gracefully.

## Android module graph

```
app ─┬─ ui_player ──┬─ lighting_effects ─ core:designsystem ─ theme_manager ─ core:model
     │              ├─ audio_engine ──┬─ fx_engine
     │              │                 ├─ auto_mix_engine
     │              │                 └─ theme_manager (implements EQManager)
     │              ├─ lyrics_engine
     │              └─ ai_assistant ──┬─ playlists, auto_mix_engine, fx_engine
     │                                └─ Anthropic Java SDK (optional Claude backend)
     ├─ ui_radio_panel, ui_youtube_panel
     ├─ library_scanner ─ playlists, fx_engine (analysis)
     ├─ offline_manager ─ lyrics_engine
     ├─ backup_manager, plugin_api
```

JVM-only modules: `core:model`, `theme_manager`, `playlists`, `ai_assistant`, `auto_mix_engine`, `lyrics_engine`, `backup_manager`, `fx_engine`, `plugin_api`. They have no Android dependency and are unit-tested on the JVM.

## Audio pipeline

### Android

```
MediaStore / stream URL
   → ExoPlayer (gapless via encoder delay/padding, HLS for radio)
   → DefaultAudioSink
       → FxAudioProcessor (16-bit PCM → float → FxChain → 16-bit)
           normalization → noise reduction → vocal remover → 10-band EQ → bass boost → compressor
           → pitch shift → flanger → phaser → stereo width → 3D surround → reverb
           → speaker HPF → loudness/speaker boost → fader → brick-wall limiter
       → SpectrumAnalyzer (post-FX, feeds lighting)
   → AudioTrack
```

- `FxChain` swaps an immutable `FxSettings` snapshot atomically; the audio thread applies it at the next buffer, so UI changes never lock the audio thread.
- **Crossfade** (Android): `CrossfadeTiming.overlapMs` seconds before a song ends, a second ExoPlayer (own FX chain, no audio focus) starts the next song; the two faders follow equal-power curves so loudness stays constant. When the first song ends, the main player continues the new song at the second player's position (a 150 ms lead covers seek latency) and the second player stops. 0 s = ExoPlayer gapless. The fader stage also carries the sleep-timer fade.
- **Safe mode** caps total added gain (loudness + speaker boost + positive normalization) at 6 dB and sets the limiter ceiling to −1 dBFS.
- `PlaybackService` (Media3 `MediaSessionService`) owns the MediaSession, which provides the notification, lock-screen, Bluetooth and Android Auto controls. `MainActivity` binds a `MediaController` so the service runs while the app is visible, and Media3 keeps it in the foreground while playing.
- **DJ auto-mix** re-queues the best key/tempo match next and time-stretches it (pitch preserved) to the previous tempo when within ±8 %.

### iOS

```
file in Documents → AVAudioFile → (AVAudioConverter) → CustomFxProcessor (0.2 s chunks) → AVAudioPlayerNode
   → AVAudioUnitTimePitch → AVAudioUnitEQ (10 bands + bass shelf) → AVAudioUnitReverb → DynamicsProcessor
   → main mixer (fader) → output          tap on main mixer → SpectrumAnalyzer
radio / Apple Music items → AVPlayer
```

Files are chained back-to-back on the player node for true gapless playback. Apple Music items with DRM can't be decoded by third-party apps, so they play through AVPlayer without custom FX, as do radio streams.

## Genre-based theme switching

`ThemeSwitcher` (Kotlin + Swift) implements spec §9:

```
genre = detectGenre(currentSong)            // GenreDetector: tag → keywords → podcast → tempo/energy
theme = genreThemeMap[genre]                // GenreCatalog.genreThemeMap
applyTheme(theme)                           // ThemeApplier →
    ThemeManager.setAccentColor / setGlowIntensity
    LightingEngine.setEdgeMode / setLightBarAnimation
    EQManager.applyPreset
    BackgroundManager.setStyle
```

Triggers: song start, genre playlist opened, AI mood detected, source changed, genre tile selected, time of day, manual choice. The rules on top:

| Rule | Why |
|---|---|
| A manual theme locks auto switching until "Resume automatic themes" | the user's choice wins |
| A genre tile/playlist sets a context that per-song detection does not override | a Meditation playlist stays emerald even if a track is tagged "Electronic" |
| Mood only switches when the song's genre is unknown | tags are stronger evidence than audio heuristics |
| Time of day only applies while nothing more specific is active | it's a fallback, not an override |
| Re-applying the same preset is a no-op | no flicker between songs of one genre |
| A custom accent from Settings overrides the preset accent | personalisation |
| `eqFollowsTheme = false` keeps the user's EQ | power users |

## AI assistant

```
text / voice ──► CommandParser ──► intent ──► AssistantEngine.execute ──► reply + actions ──► ActionExecutor
                     │ unknown
                     ├─► plugins (e.g. "start pomodoro")
                     └─► Claude (optional): short answer, may end with "ACTION: <command>", parsed back into actions
```

On-device components: `MoodDetector` (transparent scoring over genre, tempo, energy, key mode, time), `RecommendationEngine` (genre/mood/BPM/time + favourites + play counts), `EqAdvisor` (genre preset corrected for phone speaker vs headphones), `FeatureExplainer`, `AlbumArtGenerator` (deterministic neon cover spec rendered natively, plus a prompt for an optional image model).

Claude backend: Android uses the official Anthropic Java SDK (`claude-opus-5`, low effort, server-side refusal fallbacks); iOS calls the Messages API over URLSession, since there is no official Swift SDK.

## Data & persistence

| Data | Android | iOS |
|---|---|---|
| Settings | DataStore (JSON of `AppSettings`) | UserDefaults (same JSON) |
| API keys | DataStore, excluded from backups | Keychain |
| Library, favourites, history, playlists, analysis | `library.json` in app files | `library.json` in Application Support |
| Lyrics cache | `files/lyrics/*.lrc` | `Caches/lyrics/*.lrc` |
| Backup | `nocternal-playz-backup` v2 JSON via SAF | same format via Files |

Backups store portable track keys (normalised artist | title | duration/2 s) instead of device media IDs, so a backup moves between phones, including Android ↔ iOS.

## Platform limits (and what the app does instead)

| Spec item | Limit | Approach |
|---|---|---|
| FM Radio | No public FM-tuner API on Android or iOS | FM dial tunes local FM stations' internet streams (Radio Browser) |
| YouTube Music | No public playback API; ToS forbids extracting streams | Official web app in a WebView/WKWebView; theme switches to the YouTube preset |
| AI vocal remover | On-device source separation models are large | Mid/side centre-cancel DSP with bass preserved; the plugin API can plug in an ML model |
| Floating bubble on iOS | iOS forbids drawing over other apps | In-app floating bubble + system Now Playing (lock screen, Dynamic Island) |
| Cross-app recognition | Needs audio from other apps | Microphone listening (AudD on Android, ShazamKit on iOS) hears any app or speaker |
| FX on Apple Music DRM items | DRM audio can't be decoded by apps | Plays via AVPlayer; imported files get the full FX chain |
