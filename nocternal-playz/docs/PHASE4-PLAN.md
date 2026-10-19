# Nocternal Play — Phase 4 Plan: AI Journey + Smart Queue + Discovery + DJ Pro + Audiophile

Scope: the 24-feature Phase 4 request. This is a planning document, produced before any Phase 4
code is written — same process as `V2-ROADMAP.md` before Phase 1. Nothing existing is touched by
this document; it only decides what to build, in what order, and flags what needs extra care.

No current functionality is affected by anything below: every item is additive (new files, new
screens, new optional toggles) on top of the existing audio engine, FX chain, library, lyrics and
AI modules from Phases 1–3.

---

## 1. Feature audit — safe-now vs. needs-care vs. defer

| # | Feature | Risk | Why |
|---|---|---|---|
| 1 | AI Journey Mode | Safe | Pure composition of existing `AutoSetBuilder` + `FutureCast` + `CrowdEnergyBuilder` + `PromptPlaylistParser`. New screen + one orchestrating function. |
| 2 | Queue Intelligence (Keep Vibe / Build Energy / Cool Down / More Vocals / More Instrumental / Surprise Me) | Safe | `SongDna` field filters (`vocalIntensity`, `energy`) + `RecommendationEngine2.forProfile`. Pure logic, acts on the in-memory queue only. |
| 3 | Recommendation Explanations | Safe | Extends the `reason` string already returned by `Recommendation`/`MoodClassification` with BPM/key/artist/time-of-day checks — all data already on `Track`/`SongDna`. |
| 4 | Song Relationship Graph | Safe (UI) | Edges = `RecommendationEngine2.distance` + `Harmonic.relation`, already computed. New Canvas-based graph view, same technique as the Phase 3 Camelot wheel (positioned nodes, no new DSP). |
| 5 | Smart Collections (10 auto playlists) | Safe | Pure functions over `PlayEvent` history + `SongDna`/`MoodClassifier`/`GenreDetector`, same pattern as `AnalyticsEngine`/`DiscoveryRadar`. "Most Skipped" needs a skip signal — see §2. |
| 6 | Listening Memories ("On This Day") | Safe | `PlayEvent.startedAtEpochMs` grouped by day-of-year across years. Pure function. |
| 7 | Harmonic Compatibility Engine (BPM/Key/Energy/Mood % + tier label) | Safe | Thin wrapper normalizing `Harmonic.relation`, `Tempo.match`, `SongDna` distance, `MoodClassifier` into 0–100% + a tier enum. |
| 8 | Set Energy Curve Visualizer | Safe (UI) | Reads `AutoSetBuilder`'s planned `SetStep`s; same chart technique as the Phase 1 Analytics timeline. |
| 9 | Auto Cue Point Detection (intro/verse/chorus/break/drop/outro) | **Defer** | Needs real audio-structure analysis across the *whole* file. The existing `AudioAnalyzer` only decodes the middle third (this is exactly why Smart Intro/Outro was deferred in Phase 1). Verse/chorus/drop segmentation is a much harder MIR problem than a boundary. Needs its own on-device-tuned pass; placeholder below. |
| 10 | Transition Preview (simulation only) | Safe (UI) | Request explicitly says "no audio rendering changes… simulation only" — an animated preview of the `TransitionPlan` curve, no real playback. |
| 11 | Audio Inspector (bitrate/codec/sample rate/bit depth/channels, + loudness/dynamic range) | Safe | Format fields (bitrate/codec/sample rate/bit depth/channels) come from `MediaExtractor`/`MediaMetadataRetriever` — read-only container metadata, no DSP. Loudness is already computed (`loudnessDb`); dynamic range needs one extra pass of the existing decode-and-measure pipeline. |
| 12 | Headphone Profiles (6 presets + user-created) | Safe | Pure data: curated `EqPreset`s, reusing the existing EQ apply path (`c.audio.updateFx`/`applyPreset`) and the existing custom-band editor already in `EqFxScreen`. No new DSP node. |
| 13 | Smart Silence Removal | **Needs care** | Detecting dead air requires scanning full-track amplitude (more decode work than today's middle-third sample) — moderate analysis cost, but the *action* is just a seek-skip over a stored marker (reuses `seekTo`), not new real-time DSP. Buildable, but only as an opt-in, clearly scoped follow-up after Journey/Queue/Discovery ship — not blocking. |
| 14 | Karaoke Mode (word-by-word highlight) | **Already shipped** | `LyricsView`'s `SyncedLyrics` already does per-word highlighting when `KaraokeWord` timing exists (confirmed in Phase 1). Nothing to build — only worth a toggle if the product wants to allow turning it off. |
| 15 | Lyric Bookmarking | Safe | A `Set<LyricBookmark(trackId, lineStartMs)>` persisted the same way favorites are; small UI addition to `LyricsView`. |
| 16 | Lyric Share Cards | Safe (UI) | Compose-to-bitmap of a card (lyric + art + neon background), using `AlbumArtGenerator`'s existing `NeonArtSpec`. Android's `graphicsLayer`/`ImageBitmap` capture, no new audio/DSP surface. |
| 17 | Nocternal Bot 2.0 — conversational intent | Safe | Extends `CommandParser`'s existing deterministic phrase matching (already handles "play something happy", "suggest a workout playlist…") with a few more intent shapes ("darker", "more energetic", "generate a deep house journey"). Routes into the new Journey/Queue-Intelligence functions. |
| 18 | Music Coach (explain recommendations/mixes/EQ/mood) | Safe | Assembles existing explanation strings (`TransitionPlan.explanation`, `Recommendation.reason`, `EqAdvisor.Advice.reason`, `MoodClassification.reason`) into assistant replies — no new intelligence, just surfacing what's already computed. |
| 19 | Vinyl Collection Room | Safe (UI) | A grid/shelf view of albums as vinyl sleeves, reusing `AlbumArtGenerator` + the existing vinyl/tonearm art assets. Pure UI. |
| 20 | Audiophile Vinyl Mode (crackle/needle noise/surface wear) | **Needs care** | The only *real-time audio* item in this batch besides #9/#13. An additive, pre-rendered noise-bed mixed at low, user-controlled gain is far lower-risk than the live playback-rate ramping the Transition FX pad would have needed (no seek/handoff timing interaction) — but it still touches `FxChain.process()`, the same hot path the crossfade bug lived in. Ship it in its own commit, default OFF, with a conservative fixed-gain implementation only (no dynamic "wear simulation" curve) for the first pass. |
| 21 | Personal Music DNA Dashboard | Safe | New aggregation over `AnalyticsEngine.genreDistribution`/`moodDistribution`, already built in Phase 1 — just needs a % breakdown view and an "energy profile"/"listening behaviour" extension. |
| 22 | Advanced Streaks (daily/weekly/monthly/genre) | Safe | Extends `AnalyticsEngine.streak()` (already daily) with week/month bucketing and a per-genre variant. |
| 23 | Adaptive Home Screen | Safe | `c.hour()` + `GenreDetector.forMood`/`TimeOfDayThemes` already exist; this reorders/relabels existing Home sections by time of day — no new data model. |
| 24 | Quick Mood Launcher | Safe | 6 buttons → `RecommendationEngine.suggest(mood=…)` (already shipped) or the new Queue Intelligence filters → `playQueue`. |

**Net: 21 of 24 items are safe to build now with existing building blocks. 3 need explicit care**
**(#9 deferred outright, #13 and #20 scoped conservatively, each its own isolated commit).**

### "Most Skipped" needs a new signal
`PlayEvent` has no skip flag today — only `listenedMs`/`completed`. Smallest safe addition:
compare `listenedMs` against `Track.durationMs`; a play with `listenedMs < 15s` and the track
not finishing is treated as a skip for this one smart collection. No new persisted field,
no migration — computed from data already recorded.

---

## 2. Architecture

### New module boundaries (no existing module changes its public shape)

- **`ai_intelligence`** (pure JVM, already exists) gains:
  - `JourneyPlanner` — Journey Mode's orchestration (wraps `AutoSetBuilder` + `FutureCast` + `CrowdEnergyBuilder` + `PromptPlaylistParser`).
  - `QueueIntelligence` — the 6 queue actions as pure `List<Track> -> List<Track>` transforms.
  - `HarmonicCompatibility` — BPM/Key/Energy/Mood % + tier (`PERFECT`/`STRONG`/`GOOD`/`EXPERIMENTAL`).
  - `SmartCollections` — the 10 auto-playlist builders.
  - `ListeningMemories` — "On this day".
  - `MusicDnaDashboard` — genre/mood/energy % rollups (built on `AnalyticsEngine`).
  - `SongGraph` — nearest-neighbour edges for the Relationship Graph (built on `RecommendationEngine2.distance`).
- **`auto_mix_engine`** gains nothing new structurally; `AutoSetBuilder` is reused as-is by `JourneyPlanner`.
- **`fx_engine`** gains `VinylNoise` (new DSP unit, §1 item 20) — added to `FxChain.all` like every other effect, default bypassed.
- **`library_scanner`** gains an `AudioFormat` reader (bitrate/codec/sample rate/bit depth/channels via `MediaExtractor`) for the Audio Inspector — read-only, no change to the scan/analysis pipeline.
- **`app`** gains the new screens (Journey, Relationship Graph, Smart Collections list, DNA Dashboard, Audio Inspector, Vinyl Collection Room, Headphone Profiles) and wires everything into `AppContainer`/`NocternalRoot`, exactly like Phases 1–3.
- **`ai_assistant`** gains intent parsing for the new natural-language shapes and Music Coach replies — extends `CommandParser`/`AssistantEngine`, doesn't replace them.

### Data model additions (no migration needed — everything is either computed or additive with defaults)

```kotlin
// core/model — additive, @Serializable, all with defaults so existing JSON keeps loading
data class LyricBookmark(val trackId: String, val lineStartMs: Long, val note: String? = null)
data class SilenceMarker(val trackId: String, val startMs: Long, val endMs: Long)
data class HeadphoneProfile(val id: String, val name: String, val eqPresetId: String, val isUserCreated: Boolean = false)

// library_scanner — new, optional, keyed by trackId; absent = "not analyzed yet"
data class AudioFormatInfo(val bitrateKbps: Int?, val codec: String?, val sampleRateHz: Int?, val bitDepth: Int?, val channels: Int?, val dynamicRangeDb: Float?)
```

All of these are *new* top-level JSON keys in the existing settings/library stores — exactly how
`history`, `analysis`, and `lyricsOffsetsMs` were added previously. No existing field changes
shape, so no migration step is needed beyond "a key that doesn't exist yet defaults to empty",
which `kotlinx.serialization` already gives for free.

### AI recommendation engine design (Journey Mode, the headline feature)

```
PromptPlaylistParser.parse(prompt)             // "90 minute Progressive House Journey"
  -> PlaylistPrompt(genreId, mood, energyRange, durationMinutes?)   // + new optional duration field
JourneyPlanner.plan(prompt, library, history, hourOfDay):
  1. seed = best genre/mood match in library (or FutureCast's top pick if prompt is vague)
  2. arc  = CrowdEnergyPresets match closest to requested "energy goal", or a custom-length arc
            scaled to fill `durationMinutes / avgTrackLength` slots
  3. ordering = AutoSetBuilder.build(seed, filteredPool, length = slotCount, wantEnergyRise = arc.rising)
  4. returns JourneyPlan(steps, energyCurve, moodTransitions, estimatedDurationMs)
```
This is a *composition* of four engines that already exist and are already unit-tested — no new
scoring math, just a new orchestration layer and a duration-aware slot count.

---

## 3. Compose screens (new)

| Screen | Entry point |
|---|---|
| AI Journey Mode | New card on Home, above Discover |
| Song Relationship Graph | From Track Details (long-press a track → "View connections") |
| Smart Collections | New section on Home, or a tab in the existing Library view |
| Listening Memories ("On This Day") | Card on Home, shown only when there's a match |
| Music DNA Dashboard + Advanced Streaks | New tab inside the existing Analytics screen (not a new nav route) |
| Audio Inspector | From Track Details |
| Headphone Profiles | New section in Settings, next to the existing EQ settings |
| Vinyl Collection Room | New library view mode toggle (next to Songs/Playlists/Folders/History) |
| Set Energy Curve Visualizer + Transition Preview | Added into the existing DJ Deck screen (Phase 3), not a new route |

Navigation: every item above is reached by extending an existing NavHost `composable(...)` graph
in `NocternalRoot.kt`, the same additive pattern used in Phases 1–3 — no existing route changes.

---

## 4. Sub-phase backlog (priority order)

**Phase 4A — AI Journey + Queue Intelligence + Explanations (highest value, lowest risk).**
`JourneyPlanner`, Journey Mode screen, `QueueIntelligence` (6 actions wired into the Player/queue
UI), Recommendation Explanations surfaced everywhere a `Recommendation`/`Candidate` already
appears (Discover, DJ Deck).

**Phase 4B — Discovery Engine.** `SmartCollections` (10 playlists) + their Home section,
`ListeningMemories` card, Song Relationship Graph screen, `HarmonicCompatibility` + its badges on
Discover/DJ Deck.

**Phase 4C — DJ Pro + Audiophile (safe subset).** Set Energy Curve Visualizer + Transition
Preview in DJ Deck, Audio Inspector, Headphone Profiles (presets + custom).

**Phase 4D — Lyrics Premium+ + Nocternal Bot 2.0 + Vinyl Room.** Lyric Bookmarking, Lyric Share
Cards, Bot intent/Music Coach extensions, Vinyl Collection Room.

**Phase 4E — Analytics Pro + Adaptive Home.** Music DNA Dashboard, Advanced Streaks, Adaptive
Home Screen, Quick Mood Launcher.

**Phase 4F — Needs-care items, each its own reviewed commit, default-off.** Smart Silence
Removal, Audiophile Vinyl Mode (crackle/needle, fixed-gain first pass).

**Deferred (own future pass, not in Phase 4).** Auto Cue Point Detection — needs a real
music-structure-analysis pass (verse/chorus/drop segmentation), which is a different scale of
problem from everything else here and deserves dedicated design + on-device tuning, same as the
Transition FX pad in Phase 3.

---

## 5. Production notes

- **Offline-first / battery / RAM**: every new engine is a pure function over data already in
  memory (`Track`, `PlayEvent`, `SongDna`) — no network calls, no new background services, no
  continuous polling. Smart Collections/DNA Dashboard recompute on demand (cheap over a typical
  library size), not on a timer.
- **Material 3 / AMOLED / 60fps**: all new screens reuse the existing `designsystem` components
  (`GlowCard`, `NeonChip`, `SectionTitle`, `Neon.palette`) already AMOLED-tuned from Phase 1–3;
  new Canvas visuals (Relationship Graph, Energy Curve) follow the same lightweight drawing
  approach already used for the Camelot wheel and Analytics heatmap.
- **No regressions**: nothing in this plan edits an existing function's signature in a
  breaking way or removes a route; every change is additive, matching how Phases 1–3 landed.

## 6. Recommendation

Start with **Phase 4A** (AI Journey Mode + Queue Intelligence + Recommendation Explanations) —
it's the headline feature, the highest leverage, and entirely built from engines that already
shipped and are already tested. Say "Start phase 4A" (or "start phase 4") to begin.
