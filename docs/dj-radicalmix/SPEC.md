# DJ RadicalMix — SplitFire Production: Product & Technical Specification

> Mobile (Android + iOS), Desktop (Windows + macOS) and a browser companion dashboard.
> A next-generation DJ mixing ecosystem: an AI co-pilot that plans lineups and calls transitions,
> a 10,000+ free sampler/plugin library, and a neon club-console UI built for real gigs in dark rooms.
> Version 1.0 · Status: Blueprint, with a real working slice built — see §0.1
> Companion doc in this repo: [`docs/dj-nexus-pro/SPEC.md`](../dj-nexus-pro/SPEC.md) (shares the C++ audio
> core and AI training approach — see §0).

---

## Table of Contents

0. [Scope & Relationship to Existing Projects](#0-scope--relationship-to-existing-projects)
1. [Brand Identity](#1-brand-identity)
2. [Top 30 Issues with Older DJ Software](#2-top-30-issues-with-older-dj-software)
3. [DJ RadicalMix Solution Overview](#3-dj-radicalmix-solution-overview)
4. [AI DJ Agent ("RadicalAI") & Auto Lineup](#4-ai-dj-agent-radicalai--auto-lineup)
5. [Samplers, Plugins & FX Ecosystem (10,000+ Free)](#5-samplers-plugins--fx-ecosystem-10000-free)
6. [Vocal Remover & Stem Separation](#6-vocal-remover--stem-separation)
7. [UI/UX System](#7-uiux-system)
8. [Technical Architecture](#8-technical-architecture)
9. [Data Models & Storage](#9-data-models--storage)
10. [Monetization & Roadmap](#10-monetization--roadmap)
11. [User Accounts, Entitlements & Master Access](#11-user-accounts-entitlements--master-access)

---

## 0. Scope & Relationship to Existing Projects

### 0.1 Implementation status

This spec was written as a blueprint; a first real slice of it has since been implemented directly in
`dj-nexus-pro/engine/` (the shared audio core, §8.1), on the reasoning that duplicating that engine instead
of extending it would be wasted work:

| Blueprint item | Status |
|---|---|
| §3.11 Precision Analysis Engine (BPM/key detection) | **Implemented and tested** — `djn_analyze_pcm`/`djn_analyze_file`, `dj-nexus-pro/engine/src/core/analysis.cpp` |
| §4 AI Next-Track Radar scoring | **Implemented and tested** — `djn_advisor_score`, `dj-nexus-pro/engine/src/core/advisor.cpp` (the harmonic/tempo/energy/genre/recency formula from §4.3, minus the cloud-LLM set-planning and "why" explanations, which need an online model call) |
| §7 UI/UX System, §8 Technical Architecture (web companion) | **Implemented and working** — `dj-radicalmix-web/`, a real browser app: two decks, mixer, beat/colour FX, macros and a sampler all running the actual compiled engine (not a simulation), plus a local library with BPM/key detection and the RadicalAI advisor (JS ports of the two C++ modules above, kept in sync via a shared test-fixture contract). Built, type-checked, unit-tested and browser-verified (Playwright) — see `dj-radicalmix-web/README.md` |
| §7/§8 Flutter mobile + desktop app (Android/iOS/Windows/macOS) | **Not implemented.** No Flutter SDK is available to build or verify one in this environment; the web app above covers the same engine/UI surface on desktop browsers in the meantime |
| §5 the 10,000+ sampler/plugin library and store | **Not implemented** (needs licensed audio content). `dj-radicalmix-web` ships 8 synthesized placeholder one-shots so the sampler screen is real and playable today |
| §6 Vocal remover & stem separation | **Not implemented** (needs a trained ML model) |
| §9/§11 RadicalSync backend, master-access entitlement server, billing | **Not implemented** (needs a deployed database/backend and app-store developer accounts) |

See `dj-nexus-pro/engine/README.md` for what the engine verifies today (80 unit/integration tests, ASan/UBSan
clean) and `dj-radicalmix-web/README.md` for the web app's architecture, tests and known limitations.



This repo already has two adjacent projects, and DJ RadicalMix is designed to sit on top of them rather
than duplicate them:

| Existing project | What it is | What DJ RadicalMix reuses from it |
|---|---|---|
| `dj-nexus-pro/` (`docs/dj-nexus-pro/SPEC.md`) | A two/four-deck AI DJ app with a real C++17 audio engine (`dj-nexus-pro/engine/`), already compiled for Android/iOS/web (WASM "Deck Lab") | The **audio engine core** (mixer graph, time-stretch, beat grid, FX chain) is extended rather than rewritten — see §8.1. DJ RadicalMix is the next major version of that product line, under the new SplitFire Production brand |
| `splitfire-production/` (`docs/splitfire-production/SPEC.md`) | A neon motion-graphics/branding app (intros, posters, reels) for the DJAY RadicalMix brand | The **brand assets** (`assets/brand-logo-square.png`, `assets/brand-hero.png`, icon set) and the **neon stage renderer** (`MotionStagePreview`) are reused for DJ RadicalMix's splash screen, Brand Kit panel and shareable set-recap videos (§7.1, §10.3) |
| `expertprompter/` | A web app with an existing "master login" pattern (`isMaster` flag, `MASTER_EMAILS`) | The **entitlement and master-access model** (§11) follows the same security rules already reviewed and shipped in that project, and the one proven in `dj-nexus-pro` §8 |

DJ RadicalMix is therefore a **blueprint-level deliverable**: this spec, the problem/solution mapping, the
AI agent design, the sampler/FX ecosystem design, the UI/UX screens, the architecture, data models and
monetization plan — implementation-ready for an engineering team, building on code that already exists in
this repo instead of ignoring it.

---

## 1. Brand Identity

| Item | Value |
|---|---|
| Product name | **DJ RadicalMix** |
| Studio / label | **SplitFire Production** |
| Tagline | *Mix Beyond Reality* (carried over from the existing SplitFire brand) |
| Platforms | Android, iOS, Windows, macOS, + web companion dashboard |
| Personality | Futuristic, neon, holographic, cyberpunk-club. Built for techno/trance/psy/house/EDM performers, but approachable for a bedroom beginner |

**Logo** (already produced as real assets in `splitfire-production/app/assets/`): a glossy red **R**
integrated with headphones, wrapped in a neon red/blue/purple ring, in front of a DJ silhouette wearing
headphones and sunglasses, with "DJAY RadicalMix" / "SplitFire Production" wordmarks beneath. This is the
visual foundation for every splash screen, app icon, loading state and marketing asset described in §7.

**Color palette** (shared with the existing SplitFire Production brand, see `docs/splitfire-production/SPEC.md §4`):

| Token | Hex | Role |
|---|---|---|
| Radical Red | `#FF1744` | Primary brand, the "R", active-deck glow |
| SplitFire Purple | `#7C3AED` | Secondary glow, AI agent accent |
| Hologram Blue | `#00E5FF` | Tertiary glow, waveform accent, link/active states |
| Stage Void | `#05050A` | Base background (true near-black, OLED-friendly — see Issue #27) |
| Stage White | `#F5F5FA` | High-contrast text/icons on dark surfaces |

---

## 2. Top 30 Issues with Older DJ Software

Each entry: the problem, in plain terms, and why it actually costs a DJ something in a club, at a festival,
or on a livestream.

1. **Lag & Audio Dropouts** — Legacy software buffers unpredictably and spikes the CPU under load, producing
   clicks, glitches or full audio dropouts mid-track. In a live set this isn't a bug report, it's a dead
   floor: a dropout during a drop can end a DJ's booking.

2. **Cluttered, Tiny-Button UI** — Desktop-ported layouts cram dozens of small, similarly-styled controls
   onto one screen. In a dark club, lit only by stage lighting, missing a tiny button by a few pixels means
   hitting the wrong one — often a cue point instead of a loop.

3. **Poor Library Management** — Tracks pile up with inconsistent tags, no BPM/key, duplicate imports and no
   real crate system. A DJ with 20,000 tracks can't find "the one" fast enough to keep a transition smooth.

4. **Weak Search & Filtering** — Search is usually a single text box with no facets. There's no way to ask
   "uplifting progressive house, 124–128 BPM, not played in the last 3 sets" — so DJs fall back on muscle
   memory and repeat themselves.

5. **No Smart Recommendations** — The software has all the metadata it needs (BPM, key, energy, history) and
   does nothing with it. Every next-track decision is 100% manual, every time, even under pressure.

6. **Limited Sampler Banks** — A handful of pads with no categorization and no bulk import path. DJs who
   want a specific riser or vocal tag end up switching apps or hunting through folders live.

7. **Fragmented Plugin/FX Ecosystem** — Effects live in different plugin formats from different vendors with
   no shared preset format. Installing, updating and chaining them is a manual, breakage-prone process that
   has nothing to do with mixing.

8. **Poor or No AI Features** — No auto-mix, no intelligent transition suggestions, no vocal isolation, no
   mastering assist. DJs do by hand what modern ML has solved in adjacent tools (stem separation, mastering)
   for years.

9. **Bad Performance on Mid-Range Hardware** — Flagship DJ software assumes a maxed-out laptop. On a
   mid-range machine it overheats, throttles and crashes — exactly the hardware most working/touring DJs
   actually carry.

10. **Slow or Inaccurate Waveform Rendering** — Waveforms lag behind playback, zooming stutters, and the beat
    grid drawn on top doesn't line up with the audio. Beatmatching by eye becomes guesswork.

11. **Inaccurate BPM & Key Detection** — Autodetected BPM is off by a half/double-time error, or key
    detection is simply wrong. A DJ trusts it, mixes two "compatible" tracks, and gets a clash in front of a
    crowd.

12. **No Crowd-Aware Adaptation** — The software has no concept of how the night is going. It can't nudge a
    DJ toward a more energetic or more chill next track based on how the set has trended so far.

13. **Limited Recording & Export Options** — Recording a set often means a raw, unmastered WAV dump with no
    metadata and a fixed format. Getting a clean, loud, shareable file out requires a second app.

14. **Weak Streaming Platform Integration** — Little to no (legal) connection to streaming catalogs for
    research, pre-listening or building a wishlist, forcing DJs to context-switch between apps just to plan.

15. **Poor Backup & Cross-Device Sync** — Crates, cues, loops and settings live only on one machine. A
    reinstall, a dead laptop, or switching to the club's house rig wipes years of curation.

16. **No Vocal Remover / Stem Separation** — No way to isolate vocals, drums or bass from a track for
    creative remixing or acapella mashups — DJs have to leave the app entirely for this.

17. **Rigid Customization** — Skins, layouts and controller mappings are fixed or require editing raw config
    files. A DJ can't adapt the surface to their own workflow or a specific controller without a struggle.

18. **Complex External Gear Setup** — Wiring up a controller, mixer and audio interface usually means manual
    MIDI mapping and manual audio-routing configuration before a single track can play — brutal at load-in
    with 10 minutes before doors.

19. **Bad Beginner Onboarding** — No guided first run, no interactive tutorial, no safe sandbox. New DJs are
    dropped into a professional console UI with zero context and bounce off the product.

20. **No Performance Analytics** — After a set, there's no data: which tracks held the floor, where people
    left, what the actual crowd response was. DJs can't learn from their own gigs.

21. **Poor Offline Capabilities** — Some features silently require an internet connection, which fails
    exactly where DJs need reliability most: basements, warehouses and festival fields with no signal.

22. **Buggy, Breaking Updates** — An update changes a mapping, a plugin API or a file format and breaks a
    DJ's existing setup the night before a gig, with no way to roll back.

23. **No Collaborative Features** — Crates, sets and sampler packs can't be shared with a b2b partner, a crew
    or a student without manual file exports and re-imports.

24. **Limited Automation** — No automated transition modes, no scheduled playback, nothing to lean on during
    a bathroom break or a technical hiccup at a long event.

25. **Weak Mastering & Output Quality** — The mixed output is flat and quiet compared to commercially
    mastered tracks, with no built-in limiting/EQ chain to bring it up to a competitive loudness and clarity.

26. **No AI-Assisted Set Planning** — Planning an entire set — warm-up through peak-time through closer — is
    100% manual track-by-track work, every single time, with no help structuring the arc of the night.

27. **Bad Dark-Mode / Club-Mode UI** — Interfaces built for a bright studio monitor are low-contrast and hard
    to read under club lighting; backlit buttons and bright white panels also kill night vision and battery.

28. **No Multi-Device Continuity** — A set planned or started on a phone can't be picked up on a laptop at
    the venue; everything has to be redone or manually re-exported.

29. **Licensing & Content Confusion** — DJs aren't sure which tracks/samples they're legally allowed to use,
    remix, record or stream, and software gives no guidance — risking takedowns or stream bans mid-broadcast.

30. **Poor Support & Documentation** — Sparse FAQs, outdated guides and slow support mean a DJ troubleshoots
    alone, often live, with no fast path to an answer.

---

## 3. DJ RadicalMix Solution Overview

Every issue above maps to one feature inside a single coherent system — not a grab-bag of unrelated tools.
Most AI-flavored features (5, 8, 11, 12, 16, 20, 24, 26) are different faces of one shared brain, the
**SplitFire AI Core** (§4), so the product feels like one intelligence, not five separate "AI" buttons.

**1. Lag & Audio Dropouts → Ultra-Stable Audio Engine ("SplitCore")**
- How it works: lock-free real-time audio thread (no allocation, no I/O, no logging on the hot path), 2+
  second decode lookahead on worker threads, adaptive buffer sizing, and a built-in latency/stress test run
  on first launch and after every OS/driver update.
- UX entry point: Settings → Audio → Performance; a persistent health badge (green/amber/red) in the deck
  header shows live buffer headroom during a set.
- Technical notes: extends `dj-nexus-pro/engine`'s existing C++17 core (Oboe on Android, AVAudioEngine on
  iOS, WASAPI/CoreAudio on desktop); a one-tap **Performance Mode** disables non-essential visuals (waveform
  detail, particle FX) the instant CPU headroom drops below a threshold.

**2. Cluttered, Tiny-Button UI → Neon Console with Beginner/Pro/Club Layout Modes**
- How it works: three layout densities sharing one design system — Beginner (large, guided, fewer controls
  visible), Pro (full control surface), Club (Pro's layout at 1.4× hit-target size, maximum contrast, for
  dark-room use with gloves or sweaty fingers).
- UX entry point: a single toggle in the deck header; the app also auto-suggests Club Mode when ambient
  light sensors (mobile) or a manual "I'm playing a gig" toggle (desktop) are triggered.
- Technical notes: one shared component library (§7) with size/density tokens, not three separate UIs to
  maintain.

**3. Poor Library Management → Smart Library & Crates ("RadicalSort")**
- How it works: on import, every track gets automatic BPM/key/energy/mood tagging (§3.11's engine), waveform
  thumbnailing and duplicate detection (audio fingerprint, not just filename). Crates can be manual, or
  **Smart Crates** defined by a filter ("124-128 BPM, Progressive House, energy ≥ 7, not played in 30 days")
  that update live as the library grows.
- UX entry point: Library tab, with a persistent "Smart Crates" rail pinned above manual crates.
- Technical notes: SQLite (mobile/desktop) with a `tracks` + `tags` + `smart_crate_rules` schema (§9);
  duplicate detection via Chromaprint-style fingerprinting on import.

**4. Weak Search & Filtering → Instant Faceted Search ("RadicalSearch")**
- How it works: a single search bar that understands natural filters typed inline (`house 126-130 energy>6
  key:8A`) plus a facet panel (genre, BPM range, key/Camelot wheel, mood, energy slider, last-played window).
  Results update per keystroke against a local index.
- UX entry point: top of every Library/Crates screen; also reachable from the AI panel ("find me...").
- Technical notes: an in-process search index (SQLite FTS5 or a small embedded index) over tag/metadata
  fields; the natural-language parser is a lightweight on-device grammar, not a network round trip.

**5. No Smart Recommendations → AI Next-Track Radar**
- How it works: while a track plays, the AI Core continuously ranks the rest of the library for "what mixes
  well next," shown as a ranked shortlist with a one-line reason each ("+2 harmonic shift, same energy, not
  played tonight").
- UX entry point: a collapsible rail on the right edge of the Deck screen; tap a suggestion to load it to the
  idle deck.
- Technical notes: see §4 for the scoring model (BPM distance, Camelot-wheel harmonic compatibility, energy
  delta, recency, genre affinity, explicit user feedback).

**6. Limited Sampler Banks → MegaPad Sampler**
- How it works: 4 banks × 16 pads on mobile (expandable to 64 pads across banks on desktop/tablet), backed
  by the 10,000+ item library in §5, with per-pad color, velocity sensitivity, loop/one-shot mode and a
  quick-swap "load pack to bank" action.
- UX entry point: dedicated Sampler tab, and a collapsible pad strip docked under the mixer during a live set.
- Technical notes: pads reference sample IDs, not duplicated audio; triggered samples are pre-decoded into
  memory on bank-load to guarantee zero-latency triggering.

**7. Fragmented Plugin/FX Ecosystem → Unified FX Rack ("RadicalFX")**
- How it works: one chainable rack (EQ, compressor, limiter, reverb, delay, filter, flanger, phaser,
  distortion, chorus, plus genre-flavored macro FX) per deck and on the master bus, with drag-to-reorder and
  a single preset format shared across the whole rack.
- UX entry point: FX tab per deck, and a Master FX rack in the mixer view.
- Technical notes: each FX is a self-contained DSP node behind one internal plugin interface (own format, no
  third-party VST/AU dependency on mobile); desktop can additionally host a sandboxed VST3/AU wrapper for
  power users who want their own plugins.

**8. Poor or No AI → SplitFire AI Core**
- How it works: one AI layer (on-device for latency-critical scoring, cloud for heavy jobs) backs next-track
  suggestions, set planning, transition coaching, vocal/stem separation, mastering and analytics — described
  fully in §4.
- UX entry point: a persistent "RadicalAI" tab/chat bubble, plus AI affordances embedded contextually (next-
  track rail, transition hints, "Master this" button).
- Technical notes: see §8.3 — real-time path stays deterministic and on-device; heavy ML runs ahead of time
  or in the cloud and caches its results per track.

**9. Bad Performance on Mid-Range Hardware → Adaptive Performance Scaling**
- How it works: a device-capability probe on first launch sets a quality tier (visual fidelity, FX
  oversampling, max concurrent stems); the app re-probes live during a set and drops a tier automatically
  before audio is affected, never after.
- UX entry point: automatic; visible as the same health badge from Issue #1, with a manual override in
  Settings → Performance for users who want to force a tier.
- Technical notes: thermal/CPU telemetry (Android `PowerManager`, iOS thermal state API, desktop OS APIs)
  feeds the same scaling policy used by Performance Mode.

**10. Slow/Inaccurate Waveform Rendering → GPU Waveform Engine ("RadicalWave")**
- How it works: waveforms are pre-computed at import (multi-resolution peak data) and rendered on the GPU,
  so zoom and scroll stay at 60 fps regardless of track length; the beat grid is drawn from the same analysis
  pass that sets BPM, so grid and audio never disagree.
- UX entry point: every deck and the Editor's timeline.
- Technical notes: peak data stored once per track (§9) and reused across every screen that shows that
  track's waveform.

**11. Inaccurate BPM & Key Detection → Precision Analysis Engine**
- How it works: a neural BPM/key/downbeat model (trained on a wide tempo/genre spread to avoid half/double-
  time errors) analyzes every imported track once, with a one-tap manual override and a visual confidence
  score so DJs know when to double-check.
- UX entry point: Track Info panel shows BPM/key with a small confidence indicator; a "Recheck" button
  re-runs analysis if a DJ disagrees.
- Technical notes: on-device TFLite/Core ML model for instant results on import; flagged low-confidence
  tracks get a second pass from a larger cloud model when online.

**12. No Crowd-Aware Adaptation → Crowd Energy Radar**
- How it works: an opt-in energy tracker that infers set trajectory from DJ behavior (track energy ratings
  picked, skip/extend patterns, optional ambient mic-level trend as a rough proxy) and offers "crowd wants
  more / crowd wants less" nudges with alternate next-track suggestions for each direction.
- UX entry point: a small energy-trend sparkline above the Next-Track Radar, with two quick-filter chips
  ("more hype" / "more chill").
- Technical notes: entirely optional and privacy-respecting — mic input (if enabled) is processed for a
  coarse loudness/energy trend only, locally, and is never recorded or uploaded.

**13. Limited Recording & Export → One-Tap Recording with Auto-Mastered Export**
- How it works: record any set in the background at full quality; stop to get a tagged file (title, date,
  tracklist pulled from deck history) in WAV/FLAC/MP3, with an optional one-tap mastering pass (§3.25).
- UX entry point: a record button always visible in the mixer header; Export screen for format/mastering
  choices.
- Technical notes: recording taps the master bus post-limiter into a ring buffer written to disk on a
  background thread, so it can't itself cause a dropout.

**14. Weak Streaming Integration → Licensed Streaming Bridge**
- How it works: where a platform's DJ-use terms and API allow it (e.g., SoundCloud Go+ style catalogs, or a
  user's own uploaded/owned library via a Drive/Dropbox connector), tracks can be browsed and pre-listened
  for planning; actual deck playback always uses locally licensed/owned files to stay compliant.
- UX entry point: a "Streaming Sources" section in Library, clearly labeled "preview/plan only" vs.
  "playable."
- Technical notes: each streaming connector is an isolated adapter behind a `MusicSource` interface so one
  partner's terms changing doesn't touch the core library model.

**15. Poor Backup & Sync → RadicalSync Cloud**
- How it works: crates, cue points, loops, beat-grid edits, FX presets, sampler pack assignments and
  settings sync automatically across every signed-in device (Premium/Master); audio files themselves are
  never required to re-sync, only fingerprints + metadata, so re-linking a library on a new machine is fast.
- UX entry point: automatic once signed in; a Sync Status row in Settings shows last-synced time and lets a
  DJ force a sync before a gig.
- Technical notes: last-writer-wins per field with a vector clock per object, matching the approach already
  specced in `dj-nexus-pro/SPEC.md §8.4`.

**16. No Vocal Remover / Stem Separation → AI Vocal Remover & Stem Decks**
- How it works: see §6 in full — isolate or remove vocals, and split any track into drums/bass/vocals/other
  for live remixing across decks.
- UX entry point: track context menu → "Isolate Stems"; a dedicated Stem Mixer panel per deck once stems are
  ready.
- Technical notes: pre-processed and cached per track (cloud job) for library tracks; a lighter on-device
  2-stem model covers instant, offline vocal/instrumental separation.

**17. Rigid Customization → Theme Studio & Custom Mapping Editor**
- How it works: a visual editor for color themes (swap the neon palette, keep the layout) and for MIDI/
  controller mappings (drag a control, press the hardware button, done — no config file editing).
- UX entry point: Settings → Appearance (themes) and Settings → Controllers → Edit Mapping.
- Technical notes: mappings stored as a portable JSON profile (shareable — ties into Issue #23's Collab Hub).

**18. Complex External Gear Setup → Auto-Detect Gear Wizard**
- How it works: on connecting a controller/interface, the app fingerprints the device (USB/MIDI descriptor),
  auto-loads a matching mapping and audio-routing profile from a built-in device database, and walks through
  any remaining manual step with plain-language prompts.
- UX entry point: a "Connect Gear" wizard launched automatically when new hardware is detected.
- Technical notes: a community-extensible device-profile JSON format (§9), so support for a new controller
  ships as a data update, not an app update.

**19. Bad Beginner Onboarding → Guided First Set + Beginner Mode with AI Copilot**
- How it works: first launch offers an interactive 5-minute tutorial using real (safe, sandboxed) decks, then
  defaults new accounts into Beginner layout mode (Issue #2) with the AI Copilot proactively explaining each
  control the first time it's touched.
- UX entry point: launched automatically on first sign-in; replayable anytime from Settings → Help → Replay
  Tutorial.
- Technical notes: tutorial steps are a declarative script overlaying the real UI (highlight + tooltip + wait
  for input), not a separate fake screen — so what's taught matches what's shipped.

**20. No Performance Analytics → Set Analytics Dashboard**
- How it works: after each recorded/logged set, a report shows tempo/energy arc over time, longest-held
  tracks, transition smoothness scores, and (if crowd-energy tracking was on) where energy rose or dropped.
- UX entry point: a Sets History tab; tapping a past set opens its report.
- Technical notes: computed from the same deck-event log used for recording tracklists — no extra
  instrumentation needed.

**21. Poor Offline Capabilities → Full Offline Mode**
- How it works: the entire mixing/sampling/FX experience works with no network at all; only cloud-only jobs
  (HQ stem separation, cloud set-planning fallback) queue and resume automatically once back online.
- UX entry point: an "Offline" badge replaces the sync status indicator when disconnected; queued cloud jobs
  show a clear pending state.
- Technical notes: on-device models cover BPM/key detection, basic vocal/instrumental split and next-track
  scoring, so the core "DJ at a signal-dead warehouse" case needs zero connectivity.

**22. Buggy, Breaking Updates → Staged Rollout & Safe Update System**
- How it works: updates roll out to a small percentage first, with automatic crash/err-rate monitoring that
  halts rollout on a regression; mapping/preset/pack formats are versioned and migrated automatically, never
  silently broken.
- UX entry point: a changelog shown pre-update with a "what changed for your setup" summary; a one-tap
  "revert to previous version" where app-store policy allows it.
- Technical notes: feature flags gate any behavior change that could affect an in-progress mapping or preset
  format.

**23. No Collaborative Features → Collab & Share Hub**
- How it works: share a crate, a full set plan, a sampler pack, an FX preset chain or a controller mapping
  via a link or in-app to another RadicalMix user, with read-only or editable (b2b co-planning) permissions.
- UX entry point: a Share icon available anywhere a crate/set/pack/preset is shown.
- Technical notes: shared objects are versioned snapshots (not live documents) by default, with an optional
  "live co-edit" mode for b2b set planning built on the same sync primitives as §3.15.

**24. Limited Automation → Auto-Mix & Smart Transition Automation**
- How it works: an Auto-Mix toggle that queues the AI's next-track pick and executes a chosen transition
  style (echo-out, filter sweep, tempo-matched blend) automatically — for bathroom breaks, b2b handoffs, or
  as a full "set it and forget it" background-music mode.
- UX entry point: a toggle in the mixer header; transition style and crossfade length are configurable
  presets.
- Technical notes: Auto-Mix reuses the exact same scoring and transition-timing logic as the manual AI
  suggestions (§4), just executed without a tap.

**25. Weak Mastering & Output Quality → Built-In Mastering Chain ("RadicalMaster")**
- How it works: a one-tap mastering pass (multiband EQ, compression, true-peak limiting tuned per genre)
  applied to recorded sets or exported mixes, bringing output to competitive streaming loudness without
  needing a separate mastering app.
- UX entry point: Export screen → "Master this mix" toggle with a before/after loudness meter.
- Technical notes: implemented as a specific RadicalFX chain preset run on the recorded master bus render,
  not a separate audio path.

**26. No AI-Assisted Set Planning → AI Set Planner**
- How it works: generate a full lineup (warm-up / peak-time / closing, any target duration) from a prompt,
  a starting BPM/genre, or a handful of favorite tracks — see §4 for the full design and example prompts.
- UX entry point: "Plan a Set" inside the RadicalAI panel.
- Technical notes: shares the same scoring model as the Next-Track Radar, run iteratively across a target
  duration with an energy-arc template (§4.3).

**27. Bad Dark-Mode / Club UI → Club Mode (True-Black OLED UI)**
- How it works: a true near-black (`#05050A`) base with neon accents only on *active* elements (a playing
  deck glows, an idle one doesn't), maximizing contrast and readability under stage lighting while saving
  battery on OLED screens.
- UX entry point: default theme; always-on, not just a "dark mode" toggle layered over a light-first design.
- Technical notes: every screen in §7 is designed dark-first; there is no light theme planned for the
  performance surfaces (Settings/onboarding may offer one for accessibility).

**28. No Multi-Device Continuity → Continuity Handoff**
- How it works: a set plan or an in-progress prep session started on a phone (e.g., on the way to a gig)
  can be opened instantly on the desktop app at the venue, with crates, cue points and the AI-planned lineup
  already in place.
- UX entry point: a "Continue on another device" prompt on the Home dashboard when another signed-in device
  has a recent session.
- Technical notes: built on RadicalSync (Issue #15); handoff is just "load the latest synced session state"
  with no special transfer protocol.

**29. Licensing & Content Confusion → Licensing Clarity Center**
- How it works: every track/sample/pack carries a plain-language usage tag (Owned/Imported — DJ use only;
  Royalty-free — DJ use + streaming/recording; Streaming-preview only — not for deck playback or recording),
  with a one-screen explainer on what each tag allows for club play, home streams and uploaded recordings.
- UX entry point: a license badge on every track/pack card; a "Can I stream this?" helper in Settings → Help.
- Technical notes: tags come from the import source (owned file metadata, pack license file, or streaming
  connector flags) and are enforced in-product (e.g., recording export warns if Streaming-preview-only
  tracks were in the set).

**30. Poor Support & Documentation → In-App Help Center + Context AI Support**
- How it works: a searchable help center with short, task-specific articles, plus the same RadicalAI agent
  answering "how do I..." questions with awareness of the exact screen/feature the DJ is currently looking at.
- UX entry point: a persistent "?" affordance on every screen; RadicalAI tab also answers support questions
  directly.
- Technical notes: help content is versioned alongside the app build so articles never describe a UI that no
  longer exists.

---

## 4. AI DJ Agent ("RadicalAI") & Auto Lineup

### 4.1 Capabilities

1. **Library analysis** — continuously maintains BPM, Camelot key, genre, energy (1–10), mood tags and play
   history for every track (§3.11).
2. **Full lineup generation** — builds a complete set (warm-up, build, peak-time, closing, or any custom
   arc) for a target duration and starting point.
3. **Real-time next-track suggestion** — ranks the library live during a set, surfaced in the Next-Track
   Radar (§3.5).
4. **Transition coaching** — recommends a specific technique (echo-out, filter sweep, tempo shift, bass
   swap, loop-roll) for the currently loaded pair, based on their harmonic/tempo relationship.
5. **Crowd-responsive re-routing** — offers "more hype" / "more chill" alternate branches when the Crowd
   Energy Radar (§3.12) signals a shift.
6. **Beginner starter sets** — from as few as 3–5 favorite tracks, generates a complete playable set that
   bridges between them.
7. **Learning from behavior** — tracks played in full, skipped, extended, or manually chosen over an AI
   suggestion all feed back into that DJ's personal ranking weights (not just global popularity).

### 4.2 Where it lives

- A persistent **RadicalAI tab** (mobile) / **docked side panel** (desktop) — a chat-style interface plus
  structured cards (a lineup, a suggestion list) rather than plain text replies.
- Contextual embeds: the Next-Track Radar rail on the Deck screen, a transition-hint chip that appears when
  two decks are both loaded and nearing a mix point, and a "Master this" button on Export.
- A lightweight **overlay mode** during live performance: a single collapsed button that expands to the top
  3 suggestions without covering the decks.

### 4.3 How it scores and plans

**Next-track score** for a candidate track, given the currently playing track:

```
score = w1·harmonic_compatibility(key_a, key_b)      // Camelot wheel distance
      + w2·tempo_compatibility(bpm_a, bpm_b)          // within stretch-comfortable range
      + w3·energy_fit(energy_a, energy_b, set_arc_target)
      + w4·genre_affinity(genre_a, genre_b)
      + w5·recency_penalty(last_played(b))            // avoid repeats within a session/night
      + w6·user_feedback_bias(b)                       // learned per-DJ weight adjustments
```

Weights (`w1..w6`) are tunable in Pro/Master settings for DJs who want to bias harder toward, say, harmonic
purity over energy matching.

**Full-set planning** walks a target **energy-arc template** (e.g., Warm-Up: energy 3→5 over 30%, Peak:
5→9 over 50%, Closing: 9→6 over 20%) and greedily/beam-searches the library for the best-scoring next track
at each step, with a repetition guard (no track repeated, no two tracks from the same artist back-to-back
by default) and a diversity bonus so lineups don't collapse into one sub-genre.

**Anti-repetition / anti-boredom:** a per-track and per-artist cooldown, a diversity term in the scoring
function, and an explicit "surprise me" slider that trades predictability for novelty by sampling from the
top-N scored candidates instead of always picking #1.

### 4.4 Example prompts

- "Plan a 90-minute techno set starting at 128 BPM, peaking around the 60-minute mark."
- "Suggest a next track that keeps energy high but stays in key with what's playing."
- "Create a chill warm-up set using my Deep House playlist, 45 minutes."
- "Give me 5 alternatives if the crowd wants more energy right now."
- "Build a starter set from these 4 tracks for a beginner's first house party gig."
- "What's the smoothest transition out of this track into the next one I've queued?"
- "Find tracks similar to [track] that I haven't played in the last two months."
- "Plan a back-to-back set outline for me and [collaborator] — I open, they close."
- "Master this recording so it's as loud and clean as a commercial release."
- "Why did you suggest this track?" (asks the agent to explain its last recommendation)

### 4.5 Technical notes

- **Metadata use:** every scoring/planning call reads from the same analysis pipeline as §3.11 — no
  duplicate metadata source of truth.
- **Learning:** lightweight per-user weight adjustment (not a full model retrain) updates after each session
  from accept/skip/override signals, stored with the user's profile and synced via RadicalSync.
- **Where it runs:** next-track scoring and transition coaching run on-device (deterministic, low-latency,
  works offline). Full-set planning and "why did you suggest this" explanations can call a cloud LLM for
  richer, prompt-driven reasoning when online, falling back to the on-device scorer's templated explanations
  when offline.

---

## 5. Samplers, Plugins & FX Ecosystem (10,000+ Free)

### 5.1 Content organization

- **Genre packs:** EDM, Techno, Trance, Psytrance, House/Deep House, Hip-Hop, Pop, Drum & Bass, and more.
- **Mood packs:** Dark, Uplifting, Chill, Aggressive, Euphoric.
- **Event packs:** Festival, Club, Lounge, Afterparty, Radio/Livestream.
- **Content types across all packs:** drum hits, risers, impacts, sweeps, vocal chops, DJ tags/drops, EDM
  FX, techno stabs, trance atmospheres, psy FX, house percussion loops, transition whooshes, and more.
- Minimum catalog at launch: **10,000+ free items**, all royalty-free for DJ use, streaming and recording
  (tagged per the Licensing Clarity Center, Issue #29).

### 5.2 Sampler Pads screen

- 4 banks (A–D) × 16 pads on mobile; desktop/tablet can show up to 64 pads across banks simultaneously.
- Color-coded pads (by content type or custom), velocity-sensitive triggering where hardware supports it,
  per-pad loop vs. one-shot mode, and quick "load pack to bank" from the Store.

### 5.3 Plugin & FX Rack

- Chainable effects: EQ, compressor, limiter, reverb, delay, filter, flanger, phaser, distortion, chorus,
  plus genre macro-FX (e.g., "EDM drop enhancer," "Techno stab riser").
- A single preset format for saving/sharing FX chains (ties into the Collab Hub, Issue #23).
- **AI-generated FX presets:** the AI Core can propose a chain for a stated goal ("make this drop hit
  harder," "warm up this vocal") by composing the existing DSP nodes with tuned parameters — it configures
  the deterministic rack rather than running a black-box effect.

### 5.4 Sampler & Plugin Store

- Browse/search/preview (instant audio preview, no download needed to audition) across the free 10,000+
  catalog, with one-tap download to local cache.
- **Premium packs** (optional, monetization — §10) sit in the same browsing experience, clearly labeled.
- **User uploads:** any DJ/producer can package and upload their own pack (samples + a manifest describing
  license, tags, BPM/key where relevant) for private use, Collab Hub sharing, or public Store submission
  (subject to a review/moderation step before public listing).

### 5.5 Storage strategy

- **Cloud:** packs and their manifests live in object storage behind a CDN (download-heavy content, matching
  the approach already specced for `dj-nexus-pro` — Cloudflare R2 + CDN).
- **Local cache:** an LRU-style local cache with a user-configurable size cap; pads/FX reference sample IDs,
  so re-downloading a previously cached pack is instant from cache and otherwise a background CDN fetch.
- **Offline:** any pack a DJ has downloaded works fully offline; the Store's browse/preview naturally
  requires connectivity, same as Issue #21's offline design.

### 5.6 AI pack suggestions

- When planning a set (§4), RadicalAI can suggest relevant sampler packs for the set's genre/mood ("this
  peak-time techno set pairs well with the Dark Stabs pack and Festival Riser pack") and offer to pre-load
  them into a sampler bank before the gig.

---

## 6. Vocal Remover & Stem Separation

### 6.1 Capabilities

- **AI Vocal Remover:** isolate or remove vocals from any track, with independent vocal-level and
  instrumental-level sliders for blending rather than a hard on/off.
- **Stem Separation:** split a track into **drums / bass / vocals / other**, each available as an
  independently mixable channel.
- **Cross-deck stem mixing:** route, say, the drums from Deck A against the vocals from Deck B — live
  mashup mixing without leaving the app.

### 6.2 UX flow

1. From a track's context menu (Library, or directly on a loaded deck): **"Isolate Stems."**
2. A progress indicator shows the job running (cloud) or completing (on-device fallback); stems are cached
   per track so this only happens once per track.
3. Once ready, the deck gains a **Stem Mixer** panel: four small faders/mutes (Drums/Bass/Vocals/Other)
   layered on top of the normal deck controls.
4. Isolated vocals/instrumentals can also be routed into the Sampler (loop a vocal phrase as a pad) or
   through the FX Rack independently of the rest of the track.

### 6.3 Integration with decks, samplers and FX

- Stem channels sit *before* the deck's existing EQ/filter/FX chain, so all per-deck FX still apply to the
  combined or soloed stems exactly as they would to the full track.
- A stem can be "frozen" into the Sampler as a new pad (e.g., capture an isolated vocal hook) for instant
  retriggering later in the set.

### 6.4 Performance considerations

- **Pre-processed (default):** library tracks get stems computed once as a cloud job (GPU-backed, high
  quality) and cached — matching the "upload for a cloud job, delete within 24h" privacy model already
  specced in `dj-nexus-pro/SPEC.md §10.4`. This is the path for anything played live: zero real-time CPU
  cost, consistent quality.
- **Real-time/offline fallback:** a lighter on-device 2-stem (vocal/instrumental) model covers instant,
  no-network separation at lower quality — enough for quick creative use when offline, upgraded to the full
  4-stem cloud result automatically once connectivity returns.
- Full 4-stem separation is never attempted live, in real time, on a playing track — it always runs ahead of
  time on a track a DJ is preparing, never on the one currently in the mix.

---

## 7. UI/UX System

### 7.1 Design language

- **Neon club console:** true near-black base (`#05050A`), neon accents (Radical Red / SplitFire Purple /
  Hologram Blue) reserved for *active* state — a playing deck glows, a cued-but-paused one doesn't. This
  keeps neon meaningful instead of decorative noise, and is kinder to OLED battery life.
- **Large, high-contrast controls** sized for club conditions (§3.2's Club Mode density) — this is a
  constraint on every screen below, not a separate theme.
- **Responsive:** one component library with density/size tokens scales from phone, to tablet, to desktop
  multi-monitor, to the browser companion; desktop/tablet surfaces reveal more simultaneous controls (e.g.,
  a full 64-pad sampler grid) rather than a different design.

### 7.2 Screens

- **Splash screen** — the animated glossy-R logo (reusing `splitfire-production`'s `PulsingLogo`/stage
  renderer) with breathing neon ring halos, brand wordmark fade-in, auto-advancing to Home.
- **Home dashboard** — quick access tiles to Decks, Library, RadicalAI, Sampler Store, and "Continue on
  another device" (Issue #28) when a recent session exists elsewhere.
- **Dual/quad deck view** — GPU waveforms with an accurate beat grid, BPM/key readouts, hot cues, loop
  controls, per-deck FX rack access, and the Next-Track Radar rail.
- **Sampler pads view** — bank switcher (A–D), the pad grid (§5.2), and a "load pack" shortcut into the
  Store.
- **Plugin/FX rack view** — the chainable rack (§5.3) per deck and for the master bus, with drag-to-reorder
  and preset save/load.
- **Library & crates** — RadicalSort's smart/manual crates (§3.3) with RadicalSearch (§3.4) pinned at the
  top.
- **RadicalAI panel** — chat-style interface plus structured cards for lineups and suggestions (§4.2).
- **Settings & Performance Mode** — audio/buffer settings, the performance health badge and manual tier
  override (§3.1/§3.9), theme and mapping editors (§3.17), account/entitlements (§11).
- **Recording & export** — record toggle, format/quality choices, one-tap mastering (§3.25), and a
  tracklist auto-built from deck history.

### 7.3 Beginner vs. Pro, and adapting to screen size

- **Beginner Mode** defaults on for new accounts: fewer simultaneous controls, the tutorial overlay (§3.19)
  available any time, and RadicalAI proactively annotating controls on first touch.
- **Pro Mode** reveals the full control surface (4 decks, full FX chain depth, advanced mapping) — a single
  toggle, not a different app.
- Layouts are defined declaratively per density/size token, so a phone shows a streamlined single-deck-
  focused layout, a tablet shows dual decks with the FX rack visible, and desktop shows the full quad-deck
  Pro layout with the RadicalAI panel docked permanently — all driven by the same screen specs above.

---

## 8. Technical Architecture

### 8.1 Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Mobile + Desktop UI | **Flutter** (Dart 3) across Android, iOS, Windows and macOS | One UI codebase for every native platform (including desktop, which Flutter supports natively); matches and extends the stack already chosen for `dj-nexus-pro` |
| Audio engine | **C++17 shared core**, extending `dj-nexus-pro/engine/` — Oboe (Android), AVAudioEngine (iOS), WASAPI/CoreAudio (Windows/macOS) | Real-time audio cannot run in Dart/JS; reusing the existing engine avoids re-solving beat-matching/time-stretch/FX routing from scratch |
| Web companion | **React** dashboard (library browsing, AI set planning, pack management) + the existing **WASM port of the engine** (`dj-nexus-pro/engine/web`, "Deck Lab") for a lightweight in-browser practice/preview mode | Full live-performance reliability is a native-app guarantee; the browser companion is for planning and casual practice, not gig-time mixing |
| Time-stretch/pitch | Rubber Band Library or Superpowered SDK (licensed) | Key-lock and BPM-stretching are core to the product |
| On-device ML | TensorFlow Lite/LiteRT (Android, NNAPI/GPU delegate), Core ML (iOS/macOS Neural Engine), ONNX Runtime (Windows) | Hardware-accelerated BPM/key detection, lightweight stem split, next-track scoring, all offline-capable |
| Local DB | SQLite via `drift` | Relational queries over large libraries (50k+ tracks), fully offline |
| Backend | Node.js (TypeScript, Fastify) + PostgreSQL + Redis | Entitlements, sync, pack metadata, job queues; consistent with this repo's other backend (`expertprompter`) |
| Auth | Argon2id password hashing + JWT, plus Apple/Google sign-in | Needed for server-verified entitlements and master access (§11) |
| Billing | RevenueCat (mobile stores) + Stripe (desktop/web) | One entitlement model across all storefronts |
| GPU inference | Python (FastAPI) workers on a GPU pool, fed by Redis/BullMQ | HQ stem separation, AI mastering, cloud-tier set planning/explanations |
| Storage | Cloudflare R2 (S3-compatible, no egress fees) + CDN | 10,000+ sampler/plugin catalog and model files are download-heavy |
| Analytics/crash | Crash reporting + privacy-respecting product analytics | Set Analytics (§3.20) is computed from the local deck-event log, not from telemetry |

### 8.2 Component overview (described)

```
┌──────────────── Client (Flutter: mobile + desktop) ────────────────┐
│  UI (one codebase, density tokens for phone/tablet/desktop)        │
│   ◄──ffi──►  C++ audio engine (SplitCore, extends dj-nexus-pro)    │
│  drift/SQLite: library, tags, crates, cues, loops, FX presets      │
│  On-device ML: BPM/key, lightweight 2-stem split, next-track score │
│  Entitlement verifier (signed JWT, public key only)                │
│  RadicalSync client (vector-clock merge)                           │
└──────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼──────────────────────────────────────┐
│ Backend (Fastify API) ── PostgreSQL (users, entitlements, sync,      │
│   pack metadata, shared crates/sets) ── Redis (rate limits, queues)  │
│ GPU workers (FastAPI + PyTorch): HQ 4-stem split, mastering,         │
│   cloud set-planning/explanation LLM calls                           │
│ R2 + CDN: 10,000+ sampler/plugin catalog, model files, temp uploads  │
│ Billing webhooks (RevenueCat, Stripe) → entitlements                 │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────── Web companion (React + WASM "Deck Lab") ───────────┐
│  Library browsing, AI set planning (chat + lineup cards), pack      │
│  management, lightweight in-browser preview — same backend API      │
└───────────────────────────────────────────────────────────────────┘
```

### 8.3 Real-time audio path and where AI fits

Following the same rule already established for `dj-nexus-pro`: **only deterministic, lightweight logic
runs on the real-time audio thread** (FX parameter changes, beat-synced triggers, crossfader curves). Heavy
ML (stem separation, full-set planning, mastering) always runs ahead of time on worker threads or in the
cloud, with results cached per track — never inline with live playback.

### 8.4 Security & privacy

- Audio files never leave the device unless a cloud job is explicitly requested (HQ stems, cloud mastering);
  uploads are encrypted in transit and deleted within 24h of job completion.
- RadicalSync stores fingerprints and metadata only, never raw audio.
- Tokens live in Android Keystore / iOS Keychain / OS credential store on desktop; API calls use certificate
  pinning.
- Server secrets (JWT signing key, master account hash, billing keys) live only in a secret manager, never
  in the client.
- Crowd Energy Radar's optional mic input is processed locally for a coarse level trend only — never
  recorded, stored or uploaded (Issue #12).

---

## 9. Data Models & Storage

### 9.1 On-device (SQLite via `drift`)

- **Track**: id, file path/URI, title, artist, duration, BPM, key (Camelot), energy, mood tags[], genre,
  waveform peak data ref, fingerprint hash, license tag (Issue #29), last played at, play count.
- **Crate**: id, name, type (`manual` | `smart`), smart rule (JSON filter, for smart crates), track refs
  (manual crates), created/updated at.
- **CuePoint / Loop**: id, track id, position, label, color.
- **FXPreset**: id, name, chain (ordered list of {fx type, params}), scope (`deck` | `master`), shared flag.
- **SamplerBank / SamplerPad**: bank id, pad index, sample ref (local cache path or remote pack item id),
  color, mode (`loop` | `one-shot`), velocity curve.
- **DeviceProfile**: controller fingerprint → mapping JSON + audio-routing profile (Issue #18).
- **SetSession / DeckEvent log**: session id, start/end, ordered events (track loaded, played, skipped,
  energy rating, transition technique used) — the single source for recorded tracklists and Set Analytics.
- **AIWeights**: per-user learned scoring-weight adjustments (§4.3), synced like any other setting.

### 9.2 Server (PostgreSQL)

- **User**: id, email (unique), username? (unique, for shared master-style accounts), role
  (`FREE`/`PREMIUM`/`MASTER`), passwordHash?, provider links, subscription fields, created/updated at.
- **Pack**: id, name, type (genre/mood/event), item count, license, owner (system or user upload id),
  visibility (`public`/`private`/`shared`), CDN manifest ref.
- **PackItem**: id, pack id, sample type, tags, BPM/key (where relevant), storage key.
- **SharedObject**: id, type (`crate`/`set`/`preset`/`mapping`), owner id, payload snapshot or live-ref,
  permission (`view`/`edit`), recipients (Issue #23's Collab Hub).
- **SyncRecord**: per-object vector clock + last-writer-wins payload, per user, per device (Issue #15/#28).
- **StemJob / MasteringJob**: id, track fingerprint, status, result storage key, requested/completed at
  (24h deletion policy enforced here).
- **AuditLog**: master-account logins and admin actions (§11), append-only.

### 9.3 Storage strategy recap

- **Local-first:** the library, analysis, cues, loops, presets and mappings all live and fully function on
  the device with no network (Issue #21).
- **Cloud is additive:** sync, HQ stem jobs, mastering, cloud set-planning/explanations and the
  sampler/plugin catalog are the only things that need connectivity, and all degrade gracefully offline.

---

## 10. Monetization & Roadmap

### 10.1 Tiers

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | Full core mixing (decks, FX rack, sampler with a curated subset of the free catalog), on-device AI next-track suggestions, local-only library (no cloud sync), limited AI chat/set-planning calls per day |
| **Pro** | Subscription (monthly/annual, store pricing) | Unlimited RadicalAI usage (set planning, transition coaching, explanations), the full 10,000+ sampler/plugin library, HQ 4-stem separation and AI mastering, RadicalSync across all devices, priority Performance Mode tuning and priority cloud job queueing |
| **One-time purchases** | À la carte | Premium curated sampler/plugin packs beyond the free 10,000+, premium skins/themes, the advanced Set Analytics module (for Free-tier users who want it without a full Pro subscription) |

### 10.2 Pricing philosophy

- **No paywalled fundamentals:** mixing, the FX rack, a real sampler, BPM/key detection and basic AI next-
  track suggestions are free and fully functional — a DJ can actually perform a set on Free.
- **Pay for scale and polish, not for the basics:** the paywall sits on *how much* AI/cloud compute you use,
  *how large* a sampler library you get, and *cross-device convenience* — never on "can I mix at all."
- **Transparent, no dark patterns:** no surprise feature removal from tracks/sets already created; downgrade
  never deletes a DJ's library, crates or cue points — it only pauses cloud-dependent features.

### 10.3 Roadmap

- **v1 (Launch):** Decks + mixer + FX rack, MegaPad sampler with the full free 10,000+ catalog, RadicalSort
  library/crates, RadicalSearch, on-device Precision Analysis (BPM/key), Next-Track Radar, one-tap recording
  + basic export, Beginner/Pro/Club layout modes, Android + iOS + Windows + macOS.
- **v1.5:** AI Set Planner (full lineup generation), Stem Separation + Vocal Remover (cloud HQ + on-device
  fallback), RadicalSync cross-device, Crowd Energy Radar, Collab & Share Hub, Set Analytics Dashboard, the
  web companion dashboard.
- **v2:** Auto-Mix/Smart Transition Automation, Continuity Handoff, AI-generated FX presets and AI pack
  suggestions, RadicalMaster built-in mastering chain, Theme Studio + community device-profile marketplace,
  Licensing Clarity Center v2 (streaming-platform partnerships where terms allow).

---

## 11. User Accounts, Entitlements & Master Access

This follows the exact entitlement and master-access pattern already reviewed and shipped elsewhere in this
repo (`expertprompter`'s `isMaster`/`MASTER_EMAILS` model, and `dj-nexus-pro/SPEC.md §8`) — proven, auditable,
and specifically designed so a plaintext password never ends up committed to a spec or chat log.

### 11.1 Sign-in

- Email + password (Argon2id hashing), Sign in with Apple (required on iOS alongside other social logins),
  Google. The app works fully without an account at the Free tier (local-only); an account is required for
  Pro, sync and cloud AI/jobs.

### 11.2 Entitlements model

The server is the only source of truth for what's unlocked. It issues a signed entitlement token (JWT,
short-lived, refreshed while online, with a longer offline grace period so a DJ isn't locked out mid-gig):

```json
{
  "sub": "usr_01J...",
  "plan": "MASTER",
  "ent": ["pro", "ai:*", "stems:hq", "mastering", "packs:*", "sync", "export:*"],
  "subscription_check": false,
  "exp": 1790000000
}
```

The client verifies the signature against a bundled public key and gates every feature on `ent.contains(...)`
— editing the token client-side grants nothing without the private key, which only the server holds.

Plan resolution, in order: **MASTER** (account role set only by a bootstrap script or an existing master via
the admin API — never by a normal login/signup request) → **PRO** (active verified subscription, or a
promotional grant) → **FREE** (everyone else).

### 11.3 Master access for the product owner

Full-access **master login** for the account owner (`roshanmani1987@gmail.com`), unlocking every Pro feature,
every AI module and the complete 10,000+ pack library with no paywalls — the same guarantee already built for
`dj-nexus-pro` and `expertprompter`:

| Requirement | Implementation |
|---|---|
| Recognized automatically | `MASTER_EMAILS` includes `roshanmani1987@gmail.com`; once that email is verified via Google sign-in, the account resolves to `plan: MASTER` server-side — no separate password to manage or leak |
| Optional shared master login (e.g., for a teammate or a demo device with no personal email) | A reserved username (not published in this spec or any chat log) is created **once**, by running a bootstrap script that prompts for a password interactively and stores only its Argon2id hash — never typed into a document, ticket or prompt |
| Unlocks everything | Entitlement token with `plan: MASTER`, `ent: ["pro", "ai:*", "stems:hq", "mastering", "packs:*", ...]` |
| Skips subscription checks | `subscription_check: false`; a promotional lifetime grant is also set on the billing side so store-side screens agree with the server |
| Security | Login rate-limiting (attempts per IP + account), optional TOTP 2FA recommended for the master account, every master login/action written to the append-only `AuditLog`, and master sessions are individually revocable from an admin endpoint |
| What it explicitly does **not** do | It does not create a hidden door into *other users'* data — master status only changes which entitlements *this one account* receives; it has no special read access to other accounts' libraries, recordings or personal data beyond ordinary admin-support tooling with its own audit trail |

This mirrors the security note already on record in `dj-nexus-pro/SPEC.md §8.3`: a password must never be
typed in plaintext into a spec, ticket or chat — it is only ever entered once, interactively, into the
bootstrap script, which stores nothing but its hash.

### 11.4 Cloud sync scope (Pro and Master)

Synced: crates, cue points, loops, beat-grid edits, FX presets, sampler pack assignments, controller
mappings, and settings — as fingerprints/metadata/config, never raw audio files. Last-writer-wins per field
with a vector clock per object, so edits made on a phone and a desktop merge instead of clobbering each
other (same model as `dj-nexus-pro/SPEC.md §8.4`).
