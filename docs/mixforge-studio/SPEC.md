# MixForge Studio — AI Music Creation + DJ Mixing + Stem Lab: Product & Technical Specification

> Mobile (Android + iOS) and Desktop (Windows + macOS). A unified music-creation ecosystem: an AI beat/melody
> generator, AI stem separation, a beginner-friendly 2-deck DJ mixer, auto remix mode, a 10,000+ free
> loop/sample library, one-tap mastering and cross-device cloud sync — one app instead of five.
> Version 1.0 · Status: Blueprint, with a real working web slice built — see §0.1
> Related specs in this repo: [`docs/dj-radicalmix/SPEC.md`](../dj-radicalmix/SPEC.md) (DJ mixer/AI-DJ product
> line), [`docs/dj-nexus-pro/SPEC.md`](../dj-nexus-pro/SPEC.md) (shared C++ audio engine, analysis engine and
> entitlement/master-access pattern this spec reuses rather than reinvents — see §0.2).
> Companion build in this repo: [`mixforge-studio-web/`](../../mixforge-studio-web/) (a real browser app
> implementing §2A/B/D/F/G below).

---

## Table of Contents

0. [Scope, Status & Relationship to Existing Projects](#0-scope-status--relationship-to-existing-projects)
1. [App Overview](#1-app-overview)
2. [Core Features](#2-core-features)
3. [UI/UX System](#3-uiux-system)
4. [Technical Architecture](#4-technical-architecture)
5. [Module Breakdown](#5-module-breakdown)
6. [API Structure](#6-api-structure)
7. [User Flows](#7-user-flows)
8. [In-App AI Prompts](#8-in-app-ai-prompts)
9. [Monetization](#9-monetization)
10. [Roadmap](#10-roadmap)
11. [User Accounts, Entitlements & Master Access](#11-user-accounts-entitlements--master-access)

---

## 0. Scope, Status & Relationship to Existing Projects

### 0.1 Implementation status

This started as a blueprint-level deliverable; a first real slice of it has since been implemented as a
browser companion app, `mixforge-studio-web/`, on the same reasoning already used for `dj-radicalmix-web`:
real, working, testable code beats a UI mockup wherever it's actually buildable in this environment.

| Blueprint item | Status |
|---|---|
| §2A AI Beat Generator (pattern generation, editable grid) | **Implemented and tested** — `mixforge-studio-web/src/lib/beatPatterns.ts`: a seeded, genre-conditioned procedural generator across 7 genre templates, energy-weighted fills, unit-tested for determinism and base-pattern correctness. A rule-based generator standing in for the spec's trained sequence model (§6 `/generateBeat`) — training one needs GPU infrastructure and training data this environment doesn't have |
| §2B Melody & Bassline Creator (scale-locked generation, piano roll) | **Implemented and tested** — `mixforge-studio-web/src/lib/melodyPatterns.ts`: 5 scales, 3 part types (melody/bassline/chords), every generated note is in-key, "regenerate this half" leaves the rest untouched. Same honesty note as the beat generator — procedural, not a trained model |
| §2D DJ Mixer (2 decks, waveforms, crossfader, FX, sync) | **Implemented and working** — `mixforge-studio-web/src/engine/deck.ts` + `src/views/DJMixer.tsx`: real decks on the Web Audio API, canvas peak waveforms, an equal-power crossfader, filter + echo FX, BPM-ratio auto-sync, and MediaRecorder-based set recording. Not the native C++ engine from §4.1/`dj-nexus-pro` — a browser-only Web Audio implementation, since this is a web companion, not the native app |
| §2G One-Tap Mastering | **Implemented and working** — `mixforge-studio-web/src/engine/mastering.ts`: a real deterministic `OfflineAudioContext` chain (shelving EQ → compressor → limiter), 3 genre-flavored presets, WAV export. Preset parameters are a fixed lookup table rather than the spec's AI-selected set (§6 `/masterTrack`) — same "deterministic chain, parameters chosen upstream" split as the spec, just with a rule-based table instead of a trained model |
| §2F Sample Library (10,000+ free loops/samples) | **UX implemented, content not** — genre/mood filtering, preview, and drag-and-drop onto a Beat Generator lane all work, but only 8 procedurally synthesized placeholder one-shots back it (`mixforge-studio-web/src/engine/synthKit.ts`), not the licensed 10,000+ catalog, which needs licensed content this environment doesn't have |
| §2C Stem Lab (AI stem separation) | **Not implemented** — needs a trained source-separation model (Demucs-style) and GPU inference |
| §2E Auto Remix Mode | **Not implemented** — depends on Stem Lab plus an AI remix-orchestration job |
| §2H Cloud Sync, §11 accounts/master access, §4/§6 backend and billing | **Not implemented** — needs a deployed database/backend, auth and store accounts |
| §4.1 Flutter mobile + desktop app (Android/iOS/Windows/macOS) | **Not implemented.** No Flutter SDK is available to build or verify one in this environment, and network policy blocks downloading the Android SDK too (`dl.google.com`/`android.clients.google.com` rejected by the egress proxy) — there is no path to a real `.apk` from inside this environment. `mixforge-studio-web` covers the same Beat/Melody/Mixer/Library surface on desktop browsers in the meantime, and ships as an **installable PWA** (`public/manifest.webmanifest`, `public/service-worker.js`) so it can be added to an Android/iOS home screen without a native build |

See `mixforge-studio-web/README.md` for the full real-vs-placeholder breakdown, architecture notes, and how
to run its unit tests (`npm run test`) and full-browser smoke test (`npm run e2e`).

### 0.2 Why this reuses, not duplicates, existing work in this repo

| Existing project | What it is | What MixForge Studio reuses from it |
|---|---|---|
| `dj-nexus-pro/` (`docs/dj-nexus-pro/SPEC.md`) | A two/four-deck AI DJ app with a real C++17 audio engine (`dj-nexus-pro/engine/`) | The **audio engine core** (mixer graph, time-stretch, beat grid, FX chain, BPM/key analysis) backs MixForge's DJ Mixer module (§2D) and Stem Lab playback — see §4.1. Not rewritten from scratch. |
| `dj-radicalmix/` (`docs/dj-radicalmix/SPEC.md`) | A next-gen DJ product (AI next-track radar, 10,000+ sampler library, RadicalSync) | The **sample/loop library architecture** (§5.5 there, §5F here), the **RadicalSync-style cloud sync model** (vector clock, metadata-only), and the **AI Core** pattern (on-device for latency-critical scoring, cloud for heavy jobs) are the same design, applied here to beat/melody generation instead of next-track suggestion. |
| `expertprompter/` | A web app with an existing "master login" pattern (`isMaster` flag, `MASTER_EMAILS`) | The **entitlement and master-access model** (§11) follows the same reviewed, shipped pattern: no plaintext password ever committed to a spec, chat, or ticket. |

MixForge Studio is a **new product line** in this repo (not a reskin), because its core AI problem — generative
beat/melody/remix creation and stem separation — is a different ML domain (generative audio models + source
separation) from DJ RadicalMix's recommendation/scoring problem. It is positioned to **sit on top of** the
already-proven audio engine rather than build a second one.

---

## 1. App Overview

**MixForge Studio** is a unified music-creation ecosystem combining:

1. AI Beat Generator
2. AI Melody & Bassline Creator
3. AI Stem Separation (Vocals / Drums / Bass / Instruments) — "Stem Lab"
4. Beginner-Friendly DJ Mixer (2 decks)
5. Auto Remix Mode
6. 10,000+ Free Loops & Samples
7. One-Tap Mastering
8. Cloud Sync across Android, iOS, Windows, macOS

| Item | Value |
|---|---|
| Product name | **MixForge Studio** |
| Platforms | Android, iOS, Windows, macOS |
| Personality | Simple, beginner-friendly, visually modern — **neon hologram** style, approachable for someone who has never produced music, with a Pro Mode underneath for depth |
| Positioning | "Shazam-simple to start, DAW-deep when you want it" — one app replaces a beat-maker app, a stem-splitter web tool, a basic DJ app and a mastering plugin |

**Color palette** (neon hologram — a distinct identity from the red/purple/blue "club console" palette used
by `dj-radicalmix`, so the two products are visually distinguishable on a store shelf):

| Token | Hex | Role |
|---|---|---|
| Forge Cyan | `#00F5FF` | Primary brand, active-module glow, waveform accent |
| Hologram Magenta | `#FF2DD1` | Secondary glow, AI-generation accent ("AI is working" state) |
| Synth Violet | `#8B5CF6` | Tertiary accent, piano-roll/melody accent |
| Studio Void | `#07070C` | Base background (near-black, OLED-friendly) |
| Signal White | `#F2F2F8` | High-contrast text/icons |

---

## 2. Core Features

### A. AI Beat Generator

- Generate beats in EDM, techno, house, psy-trance, trance, hip-hop, trap (genre list is data-driven, not
  hardcoded — new genres ship as a model/preset update, not an app update).
- Adjustable **BPM** (60–200), **energy** (1–10), **style** (sub-genre presets), **instrumentation** (drum kit
  selection: 808s, acoustic kit, industrial, etc.).
- Output is always **editable**: both a rendered audio loop (WAV) and an editable **MIDI** pattern for the
  drum/percussion parts, so a beginner can accept it as-is and a producer can open it in the Beat Editor
  (step sequencer + piano roll) and change individual hits.

### B. AI Melody & Bassline Creator

- Auto-generates melodies, chords and basslines that are **BPM- and scale-locked** to whatever beat is active
  (or to a user-chosen key/scale/BPM with no beat yet).
- Genre-aware: a trance lead "sounds like trance," a trap melody "sounds like trap" — driven by genre-
  conditioned generation, not one generic model with a different label.
- **Piano roll editing**: every generated part lands as editable MIDI notes (pitch, velocity, length) on a
  standard piano-roll grid, with quantize/humanize tools and a "regenerate this bar" action that keeps the
  rest of the part intact.

### C. Stem Lab (AI Stem Separation)

- Import any song (local file or a recording made in-app).
- AI splits it into four stems: **Vocals, Drums, Bass, Instruments** (an "Other" bucket is included inside
  Instruments for anything not cleanly drums/bass/vocals).
- **Remix individually**: mute/solo/volume/pan per stem, route any stem through the FX Rack (§2D/§5), pitch-
  or time-shift a stem independently, or drag a stem into the Beat/Melody workspace as a new source track.
- **Export stems**: individually (4 files) or as a remixed stereo bounce, in WAV/FLAC/MP3.

### D. Beginner-Friendly DJ Mixer

- **2 decks** with **auto-sync** (BPM/phase matched automatically; manual nudge/pitch-bend still available for
  Pro Mode users who want to beatmatch by ear).
- **Smart beat-grid AI**: automatic BPM/downbeat detection on load, confidence indicator, one-tap re-analyze.
- **Neon hologram waveforms**: GPU-rendered, color-coded by frequency band, glowing brighter on the active
  deck.
- **FX rack**: filter (LP/HP), delay, reverb, flanger, echo — chainable per deck and on the master bus.
- **Loop controls, cue points, crossfader**: standard loop-in/loop-out with auto-loop-length snap, up to 4 hot
  cues per deck, a center-detented crossfader with a selectable curve (smooth/scratch).

### E. Auto Remix Mode

- AI remixes any imported song (or any MixForge project) end-to-end using:
  - **New beats** — the AI Beat Generator (§2A) conditioned on the source track's BPM/genre.
  - **New basslines** — the AI Melody/Bassline Creator (§2B) conditioned on the source track's key.
  - **New FX** — the FX Rack (§2D/§5E) applied with AI-chosen parameters for the chosen remix style.
  - **New transitions** — if remixing multiple source tracks together, AI-sequenced transitions reusing the
    DJ Mixer's auto-sync/crossfade engine.
- Output is a **full remix** (rendered stereo file) **plus** the editable project (stems, generated MIDI, FX
  chain) so a user can keep tweaking instead of only getting a finished bounce.
- Style presets at launch: Festival/Big-Room, Lo-Fi Chill, Trap Flip, Techno Peak-Time (data-driven list,
  same extensibility note as §2A).

### F. 10,000+ Free Loops & Samples

- **Genre packs**: EDM, Techno, Psy-trance, House, Hip-Hop, Trap, and more.
- **Mood packs**: Dark, Uplifting, Chill.
- **Drag-and-drop** into the Beat Generator's editable pattern, the Melody workspace, a DJ deck, or Stem Lab's
  remix canvas — one interaction model reused everywhere audio content can be placed.
- All catalog content is royalty-free for creation, remix, export and upload to streaming platforms (tagged
  per the licensing model in §5F).

### G. One-Tap Mastering

- AI loudness targeting, multiband EQ, compression and stereo-width processing, genre-aware (a club techno
  bounce masters differently than a lo-fi beat).
- Before/after loudness meter; **non-destructive** — mastering is a chain applied at export/render time, the
  underlying project stays editable.
- Export at **professional-quality** targets (streaming-loudness presets: Spotify/YouTube/club-system
  presets) in WAV/FLAC/MP3.

### H. Cloud Sync

- Syncs **beats, stems, DJ sets, presets** (and melody/bassline MIDI, FX chains, sampler assignments) across
  every signed-in device.
- **Multi-device continuity**: start a beat on the phone on the bus, open the same project — fully editable —
  on the desktop app at home.
- Metadata/fingerprint sync, not raw-audio sync by default (same model as `dj-radicalmix/SPEC.md §3.15`) — see
  §5H for the data actually transferred.

---

## 3. UI/UX System

### 3.1 Design language

Neon hologram interface inspired by futuristic DJ consoles: a true near-black base, neon glow reserved for
*active* elements (a playing deck, a currently-generating AI module, the active tool in the Beat Editor), large
touch targets, and one shared component library with density tokens so the same design scales from phone to
multi-monitor desktop. **Beginner Mode** (default) shows fewer controls with inline guidance; **Pro Mode**
(one toggle) reveals the full control surface (piano roll note-level editing, full FX parameter sets, step-
sequencer micro-timing) without switching to a different app or codebase.

### 3.2 Screens

1. **Splash Screen** — animated neon hologram logo, breathing glow ring, auto-advance to Home.
2. **Home Dashboard** — quick-access tiles: New Beat, New Melody, Stem Lab, DJ Mixer, Auto Remix, recent
   projects, "Continue on another device" (when a newer synced session exists elsewhere).
3. **Beat Generator** — genre/BPM/energy/instrument controls, a generate button with a neon-pulse loading
   state, a step-sequencer + waveform preview of the result, "regenerate," "keep and edit," "send to Melody."
4. **Melody/Bassline Creator** — scale/key/BPM (auto-filled from an active beat, editable), a piano roll,
   per-bar regenerate, chord-track view alongside the melody/bassline lanes.
5. **Stem Lab** — import target, a 4-stem progress/result view, per-stem fader/mute/solo/FX-send strip,
   waveform-synced playback, export panel.
6. **DJ Mixer (2 Decks)** — dual neon waveform decks, beat grid overlay, crossfader, per-deck FX rack access,
   loop/cue controls, a record button.
7. **FX Rack** — the shared chainable effects view (filter, delay, reverb, flanger, echo, plus mastering-chain
   nodes), reused by the DJ Mixer, Stem Lab and Auto Remix.
8. **Sample Library** — genre/mood pack browser, instant audio preview, drag-and-drop source for every other
   screen, download/cache status per pack.
9. **Project Workspace** — the "DAW-lite" canvas where a beat, melody/bassline, stems and sampler hits live
   together as a single editable project (what Cloud Sync actually syncs).
10. **Cloud Sync Manager** — last-synced time, per-device session list, force-sync, conflict resolution (rare,
    only on true concurrent edits — see §5H).
11. **Settings** — audio/buffer performance, account/entitlements (§11), theme, Beginner/Pro toggle, help.

---

## 4. Technical Architecture

### 4.1 Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Mobile + Desktop UI | **Flutter** (Dart 3) across Android, iOS, Windows, macOS | One UI codebase for all four native targets; same choice already made for `dj-radicalmix/SPEC.md §8.1`, so patterns (density tokens, component library) transfer directly. |
| Audio engine | **C++17 shared core**, extending `dj-nexus-pro/engine/` (Oboe/Android, AVAudioEngine/iOS, WASAPI/CoreAudio on desktop) | Real-time playback, mixing, the FX rack and beat-grid analysis cannot run in Dart; reusing the existing, already-tested engine avoids re-solving low-latency audio from scratch. MixForge adds: a MIDI/pattern playback layer (for generated beats/melodies) and a stem-aware multi-stream mixer (4 independent stem channels per loaded track) on top of this core. |
| Backend API | **Node.js (TypeScript, Fastify)** + PostgreSQL + Redis | Entitlements, project metadata, sync, pack catalog, job queues — same stack already used by `expertprompter` and specced for `dj-radicalmix/SPEC.md §8.1`. |
| Generative AI (beat/melody/remix) | GPU inference workers (**Python, FastAPI + PyTorch**), genre-conditioned sequence models producing MIDI/pattern data (+ a sample-based or small neural renderer for the audio preview) | Generation is not real-time-critical (a few seconds of "AI is working" is acceptable), so it runs server-side/cloud rather than on-device, matching the HQ-job pattern in §4.3. |
| Stem separation | GPU inference workers, a Demucs-style source-separation model (4-stem: vocals/drums/bass/other) | Same GPU worker pool as generation; 4-stem HQ separation is cloud-only (§4.3), with a lighter on-device 2-stem (vocal/instrumental) model for instant offline use, same pattern as `dj-radicalmix/SPEC.md §6.4`. |
| Mastering engine | Deterministic DSP chain (multiband EQ, compressor, true-peak limiter) with AI-selected parameters per genre/loudness target | A mastering *chain* is deterministic DSP (reliable, explainable, fast); only the **parameter selection** is AI-driven, not the signal path itself — avoids a black-box mastering result nobody can reason about. |
| On-device ML | TensorFlow Lite/LiteRT (Android), Core ML (iOS/macOS), ONNX Runtime (Windows) | BPM/key detection, the lightweight 2-stem fallback, and beat-grid analysis all need to work fully offline. |
| Local DB | SQLite via `drift` | Project files, sample/pack metadata cache, presets — offline-first, same choice as `dj-radicalmix/SPEC.md §8.1`. |
| Cloud storage | Cloudflare R2 (S3-compatible) + CDN | The 10,000+ sample/loop catalog and generated-audio renders are download-heavy. |
| Auth | Argon2id password hashing + JWT, Apple/Google sign-in | Needed for server-verified entitlements and master access (§11). |
| Billing | RevenueCat (mobile stores) + Stripe (desktop) | One entitlement model across all storefronts. |

### 4.2 Component overview (described)

```
┌──────────────── Client (Flutter: mobile + desktop) ────────────────────┐
│  UI (Beginner/Pro density tokens)                                      │
│   ◄──ffi──►  C++ audio engine (extends dj-nexus-pro/engine)            │
│      - deck/stem multi-stream mixer, FX chain, beat-grid analysis      │
│      - MIDI/pattern playback for generated beats & melodies            │
│  drift/SQLite: projects, sample-pack cache metadata, presets           │
│  On-device ML: BPM/key, lightweight 2-stem split                       │
│  Entitlement verifier (signed JWT, public key only)                    │
│  Sync client (vector-clock merge)                                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼──────────────────────────────────────┐
│ Backend (Fastify API) ── PostgreSQL (users, entitlements, projects,    │
│   pack metadata, sync records) ── Redis (rate limits, job queues)      │
│ GPU workers (FastAPI + PyTorch):                                       │
│   - Beat generation model   - Melody/bassline/chord model              │
│   - Stem separation (4-stem HQ)   - Remix orchestration                │
│   - Mastering parameter selection                                      │
│ R2 + CDN: sample/loop catalog, generated renders, temp stem uploads    │
│ Billing webhooks (RevenueCat, Stripe) → entitlements                   │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.3 Real-time path vs. AI jobs

Same rule as the rest of this repo's audio products: **only deterministic, lightweight logic runs on the
real-time audio thread** (playback, mixing, FX parameter changes, beat-synced triggers). Every AI job —
generation, HQ stem separation, mastering parameter selection, remix orchestration — runs ahead of time on a
GPU worker and is cached per request; results are fetched and then played back deterministically. Nothing
ever blocks or glitches live audio waiting on a model.

| Job | Where it runs | Typical latency budget |
|---|---|---|
| BPM/key detection, beat-grid | On-device | < 1s per track, on import |
| Beat / melody / bassline generation | Cloud GPU worker | A few seconds; progress UI, not a blocking spinner |
| Lightweight 2-stem split (offline fallback) | On-device | Near-instant, lower quality |
| HQ 4-stem separation | Cloud GPU worker | Tens of seconds; cached per track fingerprint so it only runs once |
| Auto Remix orchestration | Cloud GPU worker, composes the jobs above | Longest job in the app; always shows a clear progress state, never silently hangs |
| Mastering parameter selection | Cloud GPU worker (parameters only); the DSP chain itself runs locally at render time | Parameters: a few seconds and cached; actual render is local/instant |

### 4.4 Security & privacy

- Audio files never leave the device unless a cloud AI job is explicitly requested (generation, HQ stems,
  remix, mastering); uploads are encrypted in transit and deleted within 24h of job completion.
- Cloud Sync stores fingerprints, MIDI data and metadata — never raw stem/sample audio the user didn't
  generate or upload themselves.
- Tokens live in Android Keystore / iOS Keychain / OS credential store on desktop; API calls use certificate
  pinning.
- Server secrets (JWT signing key, master-account resolution, billing keys) live only in a secret manager,
  never in the client or in this repo.

---

## 5. Module Breakdown

### A. Beat Generator Module

- **Purpose**: turn a few high-level choices into an editable drum/percussion pattern.
- **Inputs**: genre, BPM, energy (1–10), instrument/kit selection, optional "more like this" reference to a
  previously generated beat.
- **Outputs**: rendered audio loop (WAV, cached), editable MIDI pattern, a step-sequencer representation for
  the Beat Editor.
- **Internal logic**: genre-conditioned generative sequence model (server-side) → MIDI pattern → rendered via
  the selected drum kit's sample set (client-side, using the Sample Library's engine) so regenerating a single
  element doesn't require a new cloud round trip for every tweak.
- **APIs used**: `POST /generateBeat` (§6).
- **UI components**: Beat Generator screen (§3.2.3), step sequencer, generate/regenerate controls.
- **Data stored**: `Beat` record (pattern MIDI, generation params, kit reference) inside the owning `Project`.

### B. Melody Module

- **Purpose**: generate melody/chord/bassline parts that lock to an active beat's BPM and a chosen scale.
- **Inputs**: scale/key, BPM (inherited or explicit), genre, target part (melody/chords/bassline), optional
  seed motif (hum/MIDI input in a later version — not required at launch).
- **Outputs**: editable MIDI notes on a piano roll, rendered audio preview via the selected instrument/synth
  patch.
- **Internal logic**: genre- and scale-conditioned generative model, constrained to the active key so output
  is never off-scale; "regenerate this bar" re-samples only the selected region, keeping note data outside it
  untouched.
- **APIs used**: `POST /generateMelody` (§6).
- **UI components**: Melody/Bassline Creator screen (§3.2.4), piano roll, chord-track lane.
- **Data stored**: `MelodyPart` record (MIDI, instrument patch, generation params) inside the owning `Project`.

### C. Stem Lab Module

- **Purpose**: split an imported song into independently mixable/exportable stems.
- **Inputs**: an audio file (import or in-app recording).
- **Outputs**: 4 stem audio files (vocals/drums/bass/instruments) + per-stem mix state (volume/pan/mute/
  solo/FX-send).
- **Internal logic**: fingerprint the source file; if a cached HQ separation already exists for that
  fingerprint, reuse it (no duplicate GPU work); otherwise queue a cloud job, with an on-device 2-stem
  fallback available instantly while the HQ job completes.
- **APIs used**: `POST /separateStems` (§6).
- **UI components**: Stem Lab screen (§3.2.5), per-stem fader strip, export panel.
- **Data stored**: `StemSet` record (4 storage keys, source fingerprint, job status) + per-project stem mix
  state.

### D. DJ Mixer Module

- **Purpose**: beginner-friendly 2-deck live mixing, reusing the shared audio engine.
- **Inputs**: two loaded tracks (library files, imported audio, or a MixForge project bounce).
- **Outputs**: live mixed audio, optionally recorded to a file.
- **Internal logic**: on load, auto-analyze BPM/beat grid; auto-sync matches tempo/phase; crossfader and
  per-deck FX sends feed the master bus; recording taps the master bus post-limiter to a ring buffer on a
  background thread (never on the real-time path).
- **APIs used**: none required for local mixing (fully offline-capable); `POST /syncProject` if the recorded
  set is saved to a cloud-synced project.
- **UI components**: DJ Mixer screen (§3.2.6), neon waveform decks, crossfader, loop/cue controls, record
  button.
- **Data stored**: `DJSession` record (deck event log → auto-built tracklist, matching `dj-radicalmix`'s
  pattern) if recorded and kept.

### E. FX Rack Module

- **Purpose**: one shared, chainable effects rack used by the DJ Mixer, Stem Lab and Auto Remix.
- **Inputs**: an ordered list of FX nodes (filter, delay, reverb, flanger, echo, EQ, compressor, limiter) with
  parameters, applied per-deck, per-stem, or on the master bus.
- **Outputs**: processed audio (real-time for DJ Mixer/Stem Lab monitoring; baked in at render/export time for
  Auto Remix and Mastering).
- **Internal logic**: each FX is a self-contained DSP node behind one internal plugin interface (own format,
  no third-party plugin dependency on mobile).
- **APIs used**: none (fully local); presets can sync via `POST /syncProject`.
- **UI components**: FX Rack screen (§3.2.7), drag-to-reorder chain, preset save/load.
- **Data stored**: `FXPreset` record (ordered node list + params), referenced by DJ sessions, Stem Lab mixes
  and Auto Remix jobs.

### F. Sample Library Module

- **Purpose**: browse, preview and place the 10,000+ free loops/samples catalog.
- **Inputs**: search/filter (genre, mood, BPM, key), drag target (Beat Generator, Melody workspace, DJ deck,
  Stem Lab canvas).
- **Outputs**: a placed audio reference (not a duplicated file — see §5.5 storage note) in whichever workspace
  received the drop.
- **Internal logic**: an LRU local cache with a user-configurable size cap; placing a sample references its
  catalog ID, so re-use across projects doesn't re-download.
- **APIs used**: `GET` catalog browse/search, `POST /downloadSample`, `POST /uploadSample` (user uploads).
- **UI components**: Sample Library screen (§3.2.8).
- **Data stored**: `Pack`/`PackItem` catalog (server), local cache index (client).

### G. Mastering Module

- **Purpose**: one-tap, genre-aware loudness/EQ/compression/stereo-width finishing on export.
- **Inputs**: a rendered project or DJ-set bounce, target preset (streaming/club/custom).
- **Outputs**: a mastered export file; the underlying project remains unmastered/editable.
- **Internal logic**: cloud job selects DSP parameters (genre- and loudness-target-aware); the deterministic
  DSP chain (EQ/compressor/limiter) then runs locally at render time using those parameters, so re-rendering
  after a small edit doesn't require a new cloud round trip unless the user asks to re-analyze.
- **APIs used**: `POST /masterTrack` (§6).
- **UI components**: export panel inside Project Workspace, before/after loudness meter.
- **Data stored**: mastering parameters cached per project version.

### H. Cloud Sync Module

- **Purpose**: keep beats, stems (metadata), DJ sets, presets and melody/bassline MIDI current across devices.
- **Inputs**: local project changes (debounced).
- **Outputs**: merged project state on every signed-in device.
- **Internal logic**: last-writer-wins per field with a vector clock per object — identical model to
  `dj-radicalmix/SPEC.md §3.15/§9.3`. Raw stem/sample audio is not re-uploaded on every sync; only
  fingerprints/metadata/MIDI move over the wire, with audio re-fetched from cache/CDN as needed.
- **APIs used**: `POST /syncProject` (§6).
- **UI components**: Cloud Sync Manager screen (§3.2.10).
- **Data stored**: `SyncRecord` (server), `Project` tree (client + server).

### I. User Account Module

- **Purpose**: sign-in, entitlement resolution, master access (§11).
- **Inputs**: email/password, Apple/Google sign-in.
- **Outputs**: a signed entitlement JWT gating Pro features.
- **Internal logic**: see §11 in full.
- **APIs used**: standard auth endpoints (sign-in/sign-up/refresh — omitted from §6 as out-of-scope
  boilerplate, same convention as the companion specs in this repo).
- **UI components**: Settings → Account (§3.2.11).
- **Data stored**: `User` record (server only).

---

## 6. API Structure

REST, JSON over HTTPS. Every mutating endpoint requires a valid entitlement JWT (§11.2); generation/
separation/mastering endpoints are gated by plan (`ent` claims) as shown per-endpoint below.

### `POST /generateBeat`

Request:
```json
{
  "genre": "techno",
  "bpm": 128,
  "energy": 7,
  "kit": "industrial",
  "projectId": "prj_01J..."
}
```
Response:
```json
{
  "beatId": "bt_01J...",
  "midiUrl": "https://cdn.mixforge.app/renders/bt_01J....mid",
  "previewAudioUrl": "https://cdn.mixforge.app/renders/bt_01J....wav",
  "bpm": 128,
  "status": "completed"
}
```
Requires: `ent: ["ai:beat"]` (Free tier: rate-limited daily quota; Pro: unlimited — §9).

### `POST /generateMelody`

Request:
```json
{
  "projectId": "prj_01J...",
  "part": "bassline",
  "key": "A minor",
  "bpm": 128,
  "genre": "trance",
  "barRange": [0, 7]
}
```
Response:
```json
{
  "melodyPartId": "mel_01J...",
  "midiUrl": "https://cdn.mixforge.app/renders/mel_01J....mid",
  "previewAudioUrl": "https://cdn.mixforge.app/renders/mel_01J....wav",
  "status": "completed"
}
```
Requires: `ent: ["ai:melody"]`.

### `POST /separateStems`

Request:
```json
{
  "sourceFingerprint": "fp_a1b2c3...",
  "uploadUrl": "https://upload.mixforge.app/tmp/upl_01J...",
  "quality": "hq"
}
```
Response (job accepted, poll or webhook):
```json
{
  "jobId": "stemjob_01J...",
  "status": "queued",
  "estimatedSeconds": 25
}
```
Completed job result (fetched via job status, or delivered by webhook):
```json
{
  "jobId": "stemjob_01J...",
  "status": "completed",
  "stems": {
    "vocals": "https://cdn.mixforge.app/stems/stemjob_01J.../vocals.wav",
    "drums": "https://cdn.mixforge.app/stems/stemjob_01J.../drums.wav",
    "bass": "https://cdn.mixforge.app/stems/stemjob_01J.../bass.wav",
    "instruments": "https://cdn.mixforge.app/stems/stemjob_01J.../instruments.wav"
  }
}
```
Requires: `ent: ["stems:hq"]` for `quality: "hq"`; `quality: "fast"` (on-device-equivalent 2-stem) is Free tier
and does not call this endpoint at all (runs fully on-device).

### `POST /masterTrack`

Request:
```json
{
  "projectId": "prj_01J...",
  "sourceRenderFingerprint": "fp_render_9f8e...",
  "preset": "streaming_loudness",
  "genre": "techno"
}
```
Response:
```json
{
  "masteringParams": {
    "targetLufs": -9.5,
    "eqCurve": "ref_curve_techno_01",
    "compressorRatio": 2.5,
    "limiterCeilingDb": -0.3,
    "stereoWidth": 1.15
  },
  "status": "completed"
}
```
Requires: `ent: ["mastering"]`. The DSP chain itself then runs client-side using these parameters.

### `POST /syncProject`

Request:
```json
{
  "projectId": "prj_01J...",
  "deviceId": "dev_01J...",
  "vectorClock": { "dev_01J...": 14, "dev_02K...": 9 },
  "changes": [
    { "path": "beats.bt_01J....energy", "value": 8 },
    { "path": "melodyParts.mel_01J....muted", "value": false }
  ]
}
```
Response:
```json
{
  "mergedVectorClock": { "dev_01J...": 15, "dev_02K...": 9 },
  "conflicts": []
}
```
Requires: `ent: ["sync"]` (Pro/Master).

### `POST /uploadSample`

Request: multipart — audio file + manifest (`{ "tags": [...], "bpm": 124, "key": "8A", "license": "royalty_free" }`).
Response:
```json
{ "packItemId": "pki_01J...", "status": "pending_review", "visibility": "private" }
```

### `POST /downloadSample`

Request: `{ "packItemId": "pki_01J..." }`
Response: `{ "downloadUrl": "https://cdn.mixforge.app/samples/pki_01J....wav", "expiresAt": 1790000000 }`

### `POST /createRemix`

Request:
```json
{
  "sourceFingerprint": "fp_a1b2c3...",
  "style": "festival_bigroom",
  "projectId": "prj_01J..."
}
```
Response (job accepted; this is the longest-running job in the app — see §4.3):
```json
{
  "jobId": "remixjob_01J...",
  "status": "queued",
  "estimatedSeconds": 90
}
```
Completed result references the new beat, melody/bassline parts, FX preset and final render inside the given
`projectId`, each individually editable afterward exactly like any manually created part.
Requires: `ent: ["ai:remix"]` (Pro/Master — see §9).

---

## 7. User Flows

### Creating a beat

1. Home → **New Beat** → Beat Generator screen.
2. Pick genre, BPM, energy, kit (Beginner Mode shows 4 big choices; Pro Mode exposes more granular kit/pattern-
   density controls).
3. Tap **Generate** → neon-pulse loading state → `POST /generateBeat`.
4. Result plays automatically; step sequencer shows the pattern. User can **Regenerate**, **Edit** (opens
   pattern in the step sequencer for hand edits), or **Keep & Continue to Melody**.
5. Beat is saved into the active Project automatically (no explicit "save" step — same autosave model as
   §5H's sync).

### Generating a melody

1. From an active Beat (or standalone): **New Melody/Bassline**.
2. Key/BPM pre-filled from the active beat if one exists; otherwise chosen explicitly.
3. Choose part type (melody/chords/bassline) and genre flavor → **Generate** → `POST /generateMelody`.
4. Result appears on the piano roll, playing in sync with the beat if one is active. User can edit notes
   directly, or select a bar range and **Regenerate selection**.

### Importing a song

1. Home → **Stem Lab** (or DJ Mixer → load deck → "Send to Stem Lab").
2. Pick a local file or a prior in-app recording.
3. File is fingerprinted; if a cached separation exists, stems appear immediately. Otherwise: instant on-device
   2-stem fallback preview while an HQ 4-stem cloud job runs in the background with a visible progress state.

### Separating stems

(Continues directly from "Importing a song" above.) Once the HQ job completes, the 4-stem mixer replaces the
2-stem fallback automatically; the user is never blocked waiting — they can start mixing/muting stems the
moment the fast fallback is ready.

### Remixing a track

1. From a Stem Lab project or DJ deck: **Auto Remix**.
2. Pick a style preset (Festival/Big-Room, Lo-Fi Chill, Trap Flip, Techno Peak-Time).
3. Tap **Create Remix** → `POST /createRemix` → progress view (this is the longest job in the app; the UI
   explicitly says so and shows a determinate progress bar, not an indefinite spinner).
4. Result opens in Project Workspace as a fully editable project (new beat, new bassline, FX chain, final
   render) — not just a locked audio file.

### DJ mixing

1. Home → **DJ Mixer**.
2. Load a track to Deck A (from Library, a project bounce, or an imported file); beat grid auto-analyzes.
3. Load Deck B; tap **Sync** to auto-match tempo/phase, or mix manually in Pro Mode.
4. Use crossfader, loop/cue controls and the FX rack live; optionally tap **Record**.
5. Stop recording → set is saved with an auto-built tracklist (from the deck event log) into Project
   Workspace, where it can be sent through **One-Tap Mastering** before export.

### Exporting audio

1. From Project Workspace (any beat, melody, stem mix, remix or recorded DJ set): **Export**.
2. Optional: toggle **Master this** → choose a preset (streaming/club/custom) → `POST /masterTrack`.
3. Choose format (WAV/FLAC/MP3) and resolution/bitrate.
4. File renders locally using the (optionally AI-selected) mastering parameters and saves to device/share
   sheet.

### Syncing across devices

1. Sign in on a second device (§11.1).
2. Cloud Sync Manager shows available projects from the account; open any one and it becomes immediately
   editable, pulling the latest merged state via `POST /syncProject`'s underlying client logic.
3. Edits on either device merge automatically (vector clock, last-writer-wins per field); a true concurrent
   edit on the same field is the only case that surfaces a conflict prompt.

---

## 8. In-App AI Prompts

Example prompts a user can type into the AI prompt bar present on the Beat Generator, Melody Creator, Stem
Lab and Auto Remix screens (natural language is parsed into the same structured parameters shown in §6 — the
prompt bar is a convenience layer over the same generation pipeline, not a separate model):

- "Create a dark techno beat at 128 BPM."
- "Generate a trance melody in A minor."
- "Separate vocals and drums from this song."
- "Make a festival-style remix."
- "Master this track for club loudness."
- "Give me a trap beat with heavy 808s, energy 9."
- "Write a chill lo-fi bassline that matches this beat."
- "Isolate just the vocals and mute everything else."
- "Make this beat feel more uplifting."
- "Remix this into a peak-time techno version."

---

## 9. Monetization

### Free Tier

- Basic beat generator (daily generation quota)
- Basic DJ mixer (full 2-deck mixing, FX rack, loop/cue controls — mixing itself is never paywalled)
- Limited stem separation (on-device 2-stem only; no HQ 4-stem)
- Limited samples (a curated subset of the 10,000+ catalog)

### Pro Tier

- Unlimited AI generation (beat, melody/bassline, Auto Remix)
- Full Stem Lab (HQ 4-stem separation, unlimited jobs)
- Full sample library (all 10,000+ loops/samples)
- Advanced mastering (all presets, unlimited renders)
- Cloud sync across all devices
- Pro FX (extended FX rack nodes beyond the Free-tier set)

### Pricing philosophy

- **No paywalled fundamentals**: a beginner can generate a beat, add a melody, mix two decks and export —
  the full creative loop — on Free. The paywall sits on *how much* AI/cloud compute is used and *how large* a
  content library is unlocked, not on "can I create at all" (same philosophy already adopted in
  `dj-radicalmix/SPEC.md §10.2`).
- **No surprise feature removal**: downgrading never deletes a project, beat, stem or preset — it only pauses
  cloud-dependent features (HQ separation, unlimited generation, sync) going forward.

---

## 10. Roadmap

### Version 1.0

- Beat generator
- Melody creator
- Stem lab (HQ cloud + on-device fallback)
- DJ mixer (2 decks)
- Basic FX rack
- Basic mastering
- Android + iOS + Windows + macOS

### Version 1.5

- Auto remix mode
- Sample marketplace (user uploads, public Store submission with moderation — same model as
  `dj-radicalmix/SPEC.md §5.4`)
- Advanced FX (full Pro FX rack)
- Cloud sync

### Version 2.0

- Collaboration mode (share/co-edit a project, same pattern as `dj-radicalmix`'s Collab & Share Hub)
- Multi-deck DJ mixer (beyond 2 decks, Pro Mode)
- AI set generator (full DJ-set lineup planning — the AI DJ Agent pattern from `dj-radicalmix/SPEC.md §4`,
  applied to MixForge's own library + generated content)

### Version 3.0

- Live performance mode
- Visualizer engine
- Plugin SDK (third-party FX/instrument extensibility)

---

## 11. User Accounts, Entitlements & Master Access

This follows the exact entitlement and master-access pattern already reviewed and shipped elsewhere in this
repo (`expertprompter`'s `isMaster`/`MASTER_EMAILS` model, `dj-nexus-pro/SPEC.md §8`, and
`dj-radicalmix/SPEC.md §11`) — proven, auditable, and specifically designed so **no plaintext password is ever
committed to a spec, ticket or chat log**, and so "master access" never means a backdoor into other users'
data.

### 11.1 Sign-in

Email + password (Argon2id hashing), Sign in with Apple (required on iOS alongside other social logins),
Google. The app works fully without an account at the Free tier (local-only); an account is required for Pro,
sync and cloud AI jobs.

### 11.2 Entitlements model

The server is the only source of truth for what's unlocked. It issues a signed, short-lived entitlement JWT
(refreshed while online, with an offline grace period so a project doesn't suddenly lock mid-session):

```json
{
  "sub": "usr_01J...",
  "plan": "MASTER",
  "ent": ["pro", "ai:beat", "ai:melody", "ai:remix", "stems:hq", "mastering", "packs:*", "sync", "export:*"],
  "subscription_check": false,
  "exp": 1790000000
}
```

The client verifies the signature against a bundled public key and gates every feature on
`ent.contains(...)` — editing the token client-side grants nothing without the private key, which only the
server holds.

Plan resolution, in order: **MASTER** (role set only by a bootstrap script or an existing master via the admin
API — never by a normal login/signup request) → **PRO** (active verified subscription, or a promotional
grant) → **FREE** (everyone else).

### 11.3 Master access for the product owner

Full-access **master login** for the account owner (`roshanmani1987@gmail.com`), unlocking every Pro feature
— unlimited AI generation, HQ Stem Lab, the full 10,000+ pack library, advanced mastering and cross-device
sync, with no paywalls — using the same guarantee already built for `dj-nexus-pro`, `dj-radicalmix` and
`expertprompter`:

| Requirement | Implementation |
|---|---|
| Recognized automatically | `MASTER_EMAILS` includes `roshanmani1987@gmail.com`; once that email is verified via Google sign-in, the account resolves to `plan: MASTER` server-side — **no separate password to create, type or leak** |
| Optional shared master login (e.g., a demo device with no personal email) | A reserved username (never published in this spec or any chat log) is created **once**, by running a bootstrap script that prompts for a password interactively and stores only its Argon2id hash |
| Unlocks everything | Entitlement token with `plan: MASTER`, `ent: ["pro", "ai:*", "stems:hq", "mastering", "packs:*", "sync", "export:*"]` |
| Skips subscription checks | `subscription_check: false`; a promotional lifetime grant is also set on the billing side so store-side screens agree with the server |
| Security | Login rate-limiting (attempts per IP + account), optional TOTP 2FA recommended for the master account, every master login/action written to an append-only `AuditLog`, and master sessions are individually revocable from an admin endpoint |
| What it explicitly does **not** do | It does not create a hidden door into *other users'* data — master status only changes which entitlements *this one account* receives; it carries no special read access to other accounts' projects, stems, recordings or personal data beyond ordinary admin-support tooling with its own audit trail |

This mirrors the security note already on record in `dj-nexus-pro/SPEC.md §8.3` and `dj-radicalmix/SPEC.md
§11.3`: a password must never be typed in plaintext into a spec, ticket or chat — it is only ever entered
once, interactively, into the bootstrap script, which stores nothing but its hash. **No credentials are
included in this document**, consistent with that rule.

### 11.4 Cloud sync scope (Pro and Master)

Synced: beats (MIDI + generation params), melody/bassline parts (MIDI), stem mix state (fader/mute/solo/FX-
send per stem, not raw stem audio unless user-recorded and not yet cached server-side), DJ session event logs,
FX presets, sampler pack assignments, and settings — as fingerprints/metadata/MIDI, never bulk raw audio
files. Last-writer-wins per field with a vector clock per object (§6 `/syncProject`), identical model to
`dj-radicalmix/SPEC.md §9.3`.
