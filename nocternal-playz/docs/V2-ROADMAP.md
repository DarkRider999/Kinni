# Nocternal Play V2 — Premium AI Music + DJ Platform

A plan for the 66-feature expansion: Premium Cyberpunk + Neon Luxury + Audiophile Grade. This is the
planning document requested — it does not implement anything by itself. Nothing below removes or weakens
any feature already shipped (vinyl player, 30 EQ presets, DSP chain, lyrics, Nocternal Bot, DJ auto-mix,
Smart Crossfade); V2 builds on top of the existing module graph in `ARCHITECTURE.md`.

**Reality check, up front.** A few items in the brief are already built (just not badged as "AI"), a few
are genuinely large on-device DSP/ML projects, and a couple don't map onto Android (Dynamic Island is
iPhone-only hardware). Section 1 sorts the 66 into those buckets so effort goes where it's actually needed.
Nothing here is a cloud-dependent black box — true to the app's offline-first principle, every "AI" feature
below is a deterministic or on-device-ML heuristic over data already in the library (BPM, key, energy,
genre, play history), the same approach `GenreDetector`, `MoodDetector`, `AutoMixPlanner` and `CommandParser`
already use. That's what makes "works fully offline wherever possible" achievable instead of a slogan.

---

## 1. Feature audit — what exists, what's new, what's platform-limited

| # | Feature | Status | Notes |
|---|---|---|---|
| 6 | Live BPM Detection | **Partial** | `Track.bpm` already analyzed on import (`library_scanner`). "Live" (continuous, e.g. while scratching) is new — §4. |
| 7 | Live Key Detection | **Partial** | `Track.camelotKey` already analyzed. Live/continuous tracking is new. |
| 8 | Camelot Wheel Support | **Done** | `MusicalKey`, `Harmonic.relation` in `auto_mix_engine` already implement it. V2 adds a *visual* wheel UI (§6). |
| 10 | Harmonic Mixing Detection | **Done** | `AutoMixPlanner.rank()` already scores by `Harmonic.relation`. Exposed today only as DJ auto-mix's picker; V2 surfaces it as its own screen. |
| 9 | Beat Matching Engine | **Partial** | Tempo ratio + time-stretch already exists (`AutoMixPlanner.plan`, `AudioEngine.pendingTempo`). Manual/live beat-match (for scratch mode) is new. |
| 29 | Dynamic Theme Engine (album art / mood / time / genre) | **Partial** | Genre-based theming fully exists (`ThemeSwitcher`). Album-art color extraction and mood/time blending are new (§5). |
| 35 | Loudness Normalization | **Done** | `LoudnessNormalizer`, `AppSettings.normalization`. |
| 36–38 | Smart Intro Skip / Silence / Outro Detection | **New** | Needs a one-time waveform pre-scan per track (§4). |
| 40–42 | Headphone / Speaker / Car Audio optimization | **Partial** | `EqAdvisor.recommend` already picks EQ by `OutputRoute`. V2 adds dedicated per-route presets + auto-apply (§4). |
| 44 | Hearing Protection | **Done** | `speakerSafeMode` already caps gain at 6 dB with a −1 dBFS limiter ceiling. |
| 63 | Dynamic Island Support | **N/A on Android** | iPhone 14 Pro+ hardware only. Android equivalent: Android 14+ "Live Update" rich ongoing notification + widget — scoped as that instead (§6). |
| 64 | Android Auto Support | **Done** | `PlaybackService` (Media3 `MediaSessionService`) already serves Android Auto/Bluetooth controls. V2 adds an Auto-specific simplified layout (large touch targets) — low effort. |
| 45 | Karaoke Mode | **Partial** | Vocal remover FX already exists; pairing it with the existing synced-lyrics view as a dedicated mode is new UI wiring, not new DSP. |
| 1–5, 23–27, 51–57 | AI Mood / Song DNA / Recommendations / FutureCast / Discovery Radar / prompt & context playlists / Analytics | **New** | The bulk of real new work — §2–3. |
| 11–14 | Transition FX, Session Recorder, Auto Set Builder, Crowd Energy Mode | **New** | DJ-grade additions on top of the existing crossfade/auto-mix engine — §4. |
| 15–22 | Vinyl physics, grooves reflection, needle vibration, dust, scratch, turntable gestures, start-up/slow-down | **New** | Visual/haptic polish on `SpinningAlbumArt` — §5. |
| 28, 30–34 | Visualizer modes, animated backgrounds, AMOLED/Glass/Cyberpunk/Minimal modes | **Partial → New** | AMOLED Black theme mode and 9 animated backgrounds already exist (`ThemeMode`, cosmic backgrounds in `FEATURES.md`). Holographic visualizer modes and Glassmorphism/Minimal Luxury are new (§5). |
| 46–50 | Dual lyrics, AI lyrics fixing, translation, lyric search, vocal highlight | **New**, built on the just-shipped Hinglish `Romanizer` (§4). |
| 58–62, 65–66 | Long-press menus, gestures, swipe queue, mini-player, tablet/foldable layouts | **New UX** — §6. |

---

## 2. AI engine architecture (new `ai_intelligence` module, pure JVM)

Everything here follows the existing `ai_assistant` pattern: deterministic feature extraction over data
already on `Track`, no server round-trip, explainable output (every score/recommendation can say *why*).
No new network dependency — this keeps "offline-first" true, not aspirational.

```
ai_intelligence (new, pure JVM, depends on core:model only)
 ├─ SongDnaAnalyzer      — derives Energy/Danceability/Emotion/Instrumentalness/VocalIntensity/
 │                          Complexity/Groove (0..1 each) from bpm, key, genre tag, spectral
 │                          features captured once at scan time (reuses fx_engine's analysis pass)
 ├─ MoodClassifier        — maps SongDna + genre + existing MoodDetector output → one of the 8 moods
 │                          in the brief (Happy/Energetic/Emotional/Relaxed/Aggressive/Romantic/Dark/
 │                          Uplifting) — a refinement of the existing Mood enum, not a replacement
 ├─ RecommendationEngine2 — successor to ai_assistant's RecommendationEngine; scores candidates on
 │                          BPM/key distance, SongDna similarity, time-of-day fit, recency, favorite
 │                          overlap; returns a ranked list + one-line "why" per track
 ├─ FutureCast            — thin wrapper: RecommendationEngine2 run against "what's playing now" as
 │                          the seed, biased toward tracks never played — this is honestly a framing
 │                          of recommendations-by-continuation, not a separate model
 ├─ DiscoveryRadar        — same engine, inverted recency weight: surfaces high-SongDna-match tracks
 │                          with low/zero play count ("forgotten gems")
 └─ PromptPlaylistParser  — extends ai_assistant's CommandParser grammar: parses mood words, genre
                            words, time words and BPM already present, adds weather words ("sunset",
                            "rainy", "midnight") mapped to a small lookup table — "Techno for midnight
                            drive" decomposes to {genre: techno, time: night, mood: energetic}
```

**On ML vs heuristics:** a true audio-ML mood/DNA model (CNN over mel-spectrograms) is a legitimate
future upgrade path, but it means bundling a multi-MB on-device model (TensorFlow Lite) and a training
pipeline — a separate project. Phase 1 ships the heuristic version (fast, explainable, zero APK-size
cost); the `SongDnaAnalyzer` interface is written so a TFLite-backed implementation can be swapped in
later (§7) without touching any caller.

### Weather Based Playlist Generator (§24-26 group)
Weather needs a data source. Two honest options:
- **On-device only (recommended default):** infer "weather mood" from time + season + user's manual tap
  ("rainy day" chip) — zero permissions, zero network, matches offline-first.
- **Opt-in real weather:** one new Settings toggle + a single free weather API call (e.g. Open-Meteo, no
  key required) gated behind `useWifi`/`useMobileData` exactly like lyrics lookup today. Off by default.

---

## 3. Database / storage changes

The app has no SQL database today — library metadata lives in `LibraryRepository`'s in-memory `Track`
list plus JSON backup (`backup_manager`). V2's analytics and "DNA" caching need durable per-track and
per-event storage that doesn't bloat every backup/restore. Add a small Room database, additive only:

```kotlin
// New module: analytics_store (Android-only, Room)
@Entity data class SongDnaRow(
    @PrimaryKey val trackId: String,
    val energy: Float, val danceability: Float, val emotion: Float,
    val instrumentalness: Float, val vocalIntensity: Float,
    val complexity: Float, val groove: Float, val mood: String,
    val computedAtEpochMs: Long,
)

@Entity data class ListenEventRow(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val trackId: String, val startedAtEpochMs: Long, val listenedMs: Long,
    val completed: Boolean, val hourOfDay: Int, val dayOfWeek: Int,
)

@Entity data class DjSessionRow(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String, val startedAtEpochMs: Long, val durationMs: Long,
    val trackIdsCsv: String, val recordingPath: String?,
)
```

- `SongDnaRow` is a **cache**, recomputed on rescan if the track changed — never part of backup/restore
  (same treatment as spectral analysis today).
- `ListenEventRow` powers the heatmap/monthly report/streaks (§6). Respects `privateMode` exactly like
  today's `PlayEvent` — when private mode is on, nothing is written, and analytics screens show "Private
  mode is on" instead of stale data.
- `DjSessionRow.recordingPath` is local-only (never backed up, never uploaded) — recording your own mix
  for personal listening is fine; the app should not offer in-app sharing/export of a recording that
  contains full copyrighted tracks, to stay on the right side of the licensing stance already documented
  for Free Downloads.
- Everything else (mood, mixes, favorites-weighted recommendations) is **derived at query time** from
  these two tables + the existing `Track` list — no duplication of metadata already in `LibraryRepository`.

---

## 4. Audio engine additions (`audio_engine`, `fx_engine`, `auto_mix_engine`)

| Addition | Where | Approach |
|---|---|---|
| Smart Intro Skip / Silence / Outro Detection | `fx_engine` analysis pass | One-time RMS-envelope scan per file at library-scan time (same pass that already measures loudness/BPM): find the first/last sustained-silence boundary, cache `introEndMs`/`outroStartMs` on `Track`. Playback just seeks past `introEndMs` when "skip intros" is on — no runtime DSP cost. |
| Transition FX (Echo Out, Vinyl Brake, Tape Stop, Reverse Echo, Filter Sweep, Spinback) | `fx_engine` | Each is a short (1–4 s), parameterized automation curve applied to the *outgoing* track's existing filter/delay nodes right before a manual transition — reuses the `FxChain` nodes that already exist (delay→echo, low-pass sweep→filter sweep/vinyl brake via combined pitch+LPF ramp, reverse buffer trick→reverse echo). This is DSP *sequencing* on top of existing primitives, not new primitives. |
| Beat Matching Engine (manual/scratch) | `auto_mix_engine` + new `ScratchController` in `audio_engine` | Builds on the existing tempo-ratio time-stretch; adds a touch-velocity → playback-rate mapping for the turntable gesture (§5) with a "snap back to beat-matched rate" on release. |
| Auto Set Builder (30/60/90 min, Festival) | `auto_mix_engine` | A greedy extension of `AutoMixPlanner.rank`: pick a target duration, repeatedly pick the next best-scoring track (harmonic+tempo+energy-arc) until the running duration hits the target, with an energy-arc shape per set type (Festival = build→peak→cooldown; Road Trip = steady). Pure function, fully testable like the existing planner. |
| Crowd Energy Mode (Gym/Party/Festival/Road Trip/Deep Focus/Late Night Drive) | `ai_intelligence` + existing `RecommendationEngine.Criteria` | Each "mode" is a named preset of `{mood, bpm range, energy-arc}` fed into Auto Set Builder + an EQ preset + a theme — three systems that already exist, bundled under one button. |
| Per-route audio profiles (headphone/speaker/car) | `EqAdvisor` extension | Add `OutputRoute.CAR` (detected via Bluetooth device class/AndroidAuto connection, already observable from `OutputRouteMonitor`) with its own EQ/safe-mode defaults. |
| Dual Lyrics / Translation / Lyric Search / Vocal Highlight | `lyrics_engine` | Dual = render original-script line + `Romanizer` output together (toggle, since Romanizer already exists). Translation = one optional Claude call (same opt-in key as AI lyrics, same "device-only, never required" stance) or an on-device dictionary for common phrases. Lyric search = index already-cached `.lrc` text, trivial. Vocal highlight = reuses karaoke-word timing already in `LyricsLine.words`. |

No change to the existing FX ordering or any shipped preset — all additions are new nodes/screens that
read from the chain, not replacements.

---

## 5. Vinyl, visuals and theming

### Vinyl player (`ui_player` — extends `NeonArt.kt`'s `SpinningAlbumArt`)
- **Start-up acceleration / slow-down**: replace the current instant `spinning` boolean with an
  `animateFloatAsState`-driven RPM curve (0→33⅓ RPM over ~1.2s on play, 33⅓→0 over ~1.8s on pause) —
  same infinite-rotation technique already in place, just with an eased RPM ramp instead of an on/off flag.
- **Needle vibration**: a tiny (`±0.3dp`, high-frequency) jitter on the tonearm tip Canvas draw, amplitude
  driven by `spectrum.bass` (already streamed to the UI for the light bar — reusing the existing
  `SpectrumFrame`, not a new sensor).
- **Groove reflection / dust**: a static pre-rendered overlay (radial gradient highlight sweep + a sparse
  dust-speckle `Canvas` layer, seeded so it doesn't re-randomize every frame) — cosmetic, cheap, no new
  animation loop.
- **Scratch / turntable gestures**: `pointerInput` drag on the disc → maps angular drag velocity to
  `ScratchController` (new, in `audio_engine`) which temporarily overrides playback rate/direction, snapping
  back to normal on release. This is the one genuinely new interaction system in this group — budget it
  its own phase (§7).

### Theme & visual modes
- **Dynamic theme from album art**: Android's `Palette` API (AndroidX, no new dependency) extracts a
  dominant/vibrant color from `track.artworkUri` once per track, blended with the existing genre-theme
  accent rather than replacing it — keeps genre theming's intentional design intact, adds nuance per song.
- **Holographic visualizer** (Neon Tunnel, Cyber Waves, Galaxy, Audio Particles, Plasma Spectrum,
  Futuristic City): six new `Canvas`-based renderers behind the player, each consuming the same
  `SpectrumFrame` the light bar already uses — architecturally a sibling to `LightingCanvas`/`NeonLightBar`,
  not a new audio-analysis path. Ship 2 modes in Phase 1 (Neon Tunnel, Audio Particles — cheapest to render
  well), the rest in Phase 2.
- **Glassmorphism / Cyberpunk Neon / Minimal Luxury**: three new `ThemeMode` entries alongside the
  existing Light/Dark/Neon/AMOLED, each a different `NeonPalette` + surface-blur/opacity recipe — additive
  to the existing theme system, zero risk to current modes.

---

## 6. Screen-by-screen changes

| Screen | Change |
|---|---|
| **Player** | Add: intro-skip indicator, karaoke-mode toggle (next to existing vocal-remover), turntable scratch gesture, needle vibration, dual-lyrics toggle. Everything currently there (transport, EQ/sleep/DJ-mixer/bot buttons, tooltips) stays. |
| **New: DJ Deck** | Camelot wheel visual, live BPM/key readout, transition-FX pad (6 buttons: Echo Out / Vinyl Brake / Tape Stop / Reverse Echo / Filter Sweep / Spinback), Auto Set Builder launcher, session recorder start/stop. |
| **New: Discover** | FutureCast queue, Discovery Radar ("forgotten tracks"), Prompt Playlist input box (routes through `PromptPlaylistParser` → existing `RecommendationEngine2`), mood/weather/time/activity quick-pick chips. |
| **New: Analytics** | Listening heatmap (calendar grid), monthly report, genre pie, mood breakdown, daily timeline, top artists, streak counter. All reads from `analytics_store`; shows "Private mode is on" placeholder when applicable. |
| **Home** | Add a "Crowd Energy Mode" row (6 mode chips) above or alongside existing genre tiles. |
| **Settings** | New sections: *Smart audio* (intro skip, silence/outro trim, per-route profiles), *Visuals* (visualizer mode, theme mode incl. new Glassmorphism/Cyberpunk/Minimal), *DJ* (session recording on/off, storage location), *Weather playlists* (opt-in + API toggle). Existing sections untouched. |
| **Mini-player / lock screen** | Render the same `SpinningAlbumArt` (small) instead of a static square; lock-screen already gets Media3's standard artwork — upgrading it to the vinyl render means a custom `MediaStyle` artwork bitmap generated from the Compose vinyl (snapshot) rather than the raw album art, a well-scoped new renderer. |
| **Android Auto** | Already functional (Media3 session); add a simplified large-button layout variant via Media3's browsable-tree `MediaItem` metadata — no new engine work. |
| **Tablet / foldable** | `WindowSizeClass`-driven two-pane layout (library list + player side-by-side on expanded width) — standard Compose adaptive pattern, additive to existing single-pane screens. |

---

## 7. Phased roadmap

Each phase is independently shippable and testable; nothing in a later phase is required for an earlier
one to work. Effort is relative (S/M/L/XL), not calendar time — that depends on how much of this you want
built by this agent vs your own team.

**Phase 1 — Foundations (M).** `ai_intelligence` module + `SongDnaAnalyzer`/`MoodClassifier` (heuristic),
`analytics_store` (Room) wired to existing `PlayEvent`s, Listening Analytics screen (heatmap, monthly
report, streaks — pure read of data already flowing today once the table exists), Smart Intro/Silence/Outro
detection, dual lyrics + lyric search + vocal highlight (all build directly on shipped code).

**Phase 2 — Discovery & Playlists (M).** `RecommendationEngine2`, FutureCast, Discovery Radar,
`PromptPlaylistParser` + Discover screen, mood/weather/time/activity playlists, Crowd Energy Mode presets.

**Phase 3 — DJ Deck (L).** Camelot wheel UI + live BPM/key readout, Transition FX pad, Auto Set Builder,
DJ Session Recorder (local-only). All built on the existing `AutoMixPlanner`/`Harmonic`/`FxChain`.

**Phase 4 — Vinyl & Visual polish (L).** RPM ramp, needle vibration, groove reflection/dust, 2 visualizer
modes, Glassmorphism/Cyberpunk/Minimal theme modes, album-art-driven dynamic accent.

**Phase 5 — Scratch & remaining visualizers (XL).** `ScratchController` + turntable gesture (the one
real-time-input-to-audio-latency problem in the whole list — needs on-device profiling to get feel right),
remaining 4 visualizer modes, dynamic island-equivalent Live Update notification.

**Phase 6 — Platform reach (M).** Tablet/foldable adaptive layout, Android Auto large-button variant,
lock-screen vinyl artwork render, gesture controls / swipe queue / long-press menus pass across all lists.

---

## 8. Production-ready recommendations

- **Test each phase the same way the codebase already does**: pure-JVM unit tests for everything in
  `ai_intelligence`/`auto_mix_engine` additions (deterministic, fast, already the house style — see
  `AutoMixTest`, `AssistantTest`), since none of it needs Android. Audio/UI pieces get verified on a real
  device before merging — CI compiling is necessary but not sufficient for anything touching `AudioEngine`
  or gesture timing, as the last two bug reports showed.
- **Perf budget**: every new Canvas animation (needle jitter, visualizers, groove dust) should be profiled
  with the Compose layout inspector / GPU overdraw tool on a mid-tier device before shipping — "60 FPS" is
  a real constraint, not a slogan, especially with the light bar, visualizer and spinning disc all
  animating at once.
- **Battery**: `SongDnaAnalyzer` and intro/silence detection should run as a batched background pass
  (WorkManager, already a dependency) during library scan/idle charging, never per-play.
- **Backup/restore**: keep `SongDnaRow` and analytics tables out of the JSON backup (cache-only,
  recomputed) so `backup_manager`'s cross-platform contract doesn't grow new fields iOS can't produce yet.
- **Rollout**: ship phases behind `AppSettings`-style feature flags the same way `enabledPlugins` already
  works, so each phase can go out and be toggled off instantly if something's off, without a release.
- **iOS parity**: the brief is Android-specific, but per `ARCHITECTURE.md`'s "shared core, native shells"
  principle, everything in `ai_intelligence` is pure Kotlin and should get a Swift-package twin eventually,
  same as `theme_manager`/`auto_mix_engine` do today — flagged here so it's a conscious decision, not drift.

---

## 9. What I'd build first if you give the word

Phase 1 is the highest value-to-risk ratio: it's almost entirely new code reading data the app already
collects, fully unit-testable, and it unlocks the Analytics screen and better lyrics immediately — nothing
in it depends on solving the one genuinely hard problem in the list (scratch-gesture audio latency, Phase 5).

Tell me which phase (or specific features within one) to start on, and I'll scope it the same way the last
several rounds of work went: implement, test what's testable on the JVM, push, and confirm CI + walk you
through what changed.
