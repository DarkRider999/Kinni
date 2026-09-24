# DJ Nexus Pro: Product & Technical Specification

> Your Personal AI DJ Console. A two- and four-deck DJ app for Android and iOS, with an AI "Smart DJ Bot".
> Version 1.0 · Status: Ready for engineering kickoff
> Companion documents: [AI_TRAINING_BLUEPRINT.md](./AI_TRAINING_BLUEPRINT.md) · [mockups.html](./mockups.html) · [icon.svg](./icon.svg)

---

## Table of Contents

0. [Scope Decisions](#0-scope-decisions)
1. [Brand Identity](#1-brand-identity)
2. [Product Blueprint & Feature List](#2-product-blueprint--feature-list)
3. [Smart DJ Bot](#3-smart-dj-bot)
4. [DJ Controller Interface](#4-dj-controller-interface)
5. [AI Feature Catalogue](#5-ai-feature-catalogue)
6. [Music Library & Management](#6-music-library--management)
7. [Recording & Sharing](#7-recording--sharing)
8. [User Accounts, Entitlements & Master Access](#8-user-accounts-entitlements--master-access)
9. [UI/UX: Screens & Flows](#9-uiux-screens--flows)
10. [Technical Architecture](#10-technical-architecture)
11. [Database Schema](#11-database-schema)
12. [API Endpoints](#12-api-endpoints)
13. [Monetization Plan](#13-monetization-plan)
14. [App Store & Play Store Listings](#14-app-store--play-store-listings)
15. [Marketing Strategy](#15-marketing-strategy)
16. [Delivery Roadmap & Team](#16-delivery-roadmap--team)
17. [Developer Guide: Master Access](#17-developer-guide-master-access)

---

## 0. Scope Decisions

The brief asks for some things that can't be built exactly as written. For each one, this spec keeps what the brief wants and changes how it is delivered.

| Brief item | Problem as written | What this spec does |
|---|---|---|
| **Master login with a fixed username and password inside the app** (`if username == "RoshanMaster" && password == "DJNexusUnlimited"`) | Anything compiled into an APK or IPA can be pulled out with free tools in minutes. Once the string leaks, everyone gets free Premium for good, and you can't revoke it without shipping a new app version. The password has also been pasted into prompts and chats, so treat it as already public. | Roshan gets a **server-side MASTER role**. The `RoshanMaster` username is reserved. The password is stored only as an Argon2id hash on the server and is set through a bootstrap script, never in source. The server returns signed entitlements that unlock everything, and the app never compares credentials itself. Same result for Roshan (log in, everything unlocked, subscription checks skipped, all AI models on), but revocable and not extractable. See [§8](#8-user-accounts-entitlements--master-access) and [§17](#17-developer-guide-master-access). **Pick a new password when you bootstrap.** |
| **"Scan all music on the device" on iOS** | iOS does not let apps read the whole file system. Apple Music and other DRM-protected tracks can't be decoded into a third-party audio engine at all. | Android: full scan via MediaStore plus Storage Access Framework (SD card, USB OTG). iOS: the user's own DRM-free files from the Music library, plus folders the user picks in the Files app (iCloud Drive, USB drives, SMB). DRM tracks are listed as "not playable" instead of silently missing. |
| **"Suggest downloadable tracks"** | Suggesting links to ripped or pirated music gets the app pulled from both stores and exposes the company to DMCA claims. | Suggestions point only to **legal sources**: royalty-free/Creative Commons catalogues (Jamendo, Free Music Archive), paid stores (Beatport, Bandcamp, Traxsource, through affiliate links where available), and links the user adds. |
| **Pioneer CDJ-3000 / DJM-900NXS2 look** | "Pioneer DJ", "CDJ", "DJM" and "NEXUS/NXS" are AlphaTheta trademarks, and copying the hardware trade dress closely invites a takedown. | The *layout conventions* DJs already know stay (jog wheel, waveform strip, 3-band EQ columns, crossfader, hot-cue row). The visual design is our own neon/holographic look. Store copy never names Pioneer. **Trademark note:** Pioneer used "NEXUS" for the CDJ-2000NXS line, so "DJ Nexus Pro" needs a trademark clearance search before launch. [§1.2](#12-name) lists fallback names. |
| **"Share to YouTube / Instagram / TikTok"** for recorded sets | Mixes of commercial tracks get Content ID claims, muted audio or strikes. That matters a lot if you post them on your own YouTube channels. | Sharing is fully supported. Before upload, a **copyright pre-check** shows which tracks in the set are commercial releases and suggests Mixcloud (which licenses DJ mixes) or a royalty-free-only set for YouTube. |
| **Generative features trained on "a multi-genre EDM dataset"** | Training generative models (FX synthesis, genre morphing) on scraped commercial music is a live legal risk. | Training data must be licensed, Creative Commons with commercial terms, or created in-house. See the dataset licence matrix in the AI blueprint. |

Everything else in the brief is specified below as asked.

---

## 1. Brand Identity

### 1.1 Positioning

- **Tagline:** *Your Personal AI DJ Console*
- **One-liner:** A club-standard deck and mixer layout in your pocket, with an AI co-pilot that knows every track in your library by BPM, key and energy.
- **Personality:** confident, nocturnal, precise. It should feel like standing in a dark booth under UV light, not like a toy.

### 1.2 Name

**Working name:** DJ Nexus Pro (subject to the trademark clearance in §0).

**10 alternatives** (pre-screened by ear only; each still needs a USPTO/EUIPO/IP India search):

| # | Name | Why it works |
|---|---|---|
| 1 | **NeonDeck AI** | Describes the look and the product in two words |
| 2 | **MixMind** | Leads with the AI co-pilot |
| 3 | **PulseGrid** | Beat grid plus energy "pulse" |
| 4 | **DropForge** | Drops, builds and FX creation |
| 5 | **CueVerse** | Hot cues and a whole world of sound |
| 6 | **HoloMix** | Matches the holographic UI |
| 7 | **Camelot Nine** | Harmonic-mixing insider reference (check "Camelot" mark, owned by Mixed In Key) |
| 8 | **BoothOS** | "The operating system for your DJ booth" |
| 9 | **Afterglow DJ** | Nightlife mood, soft and memorable |
| 10 | **VYBE Console** | Short, brandable, vibe-matching feature |

### 1.3 Logo Concepts

1. **The Nexus Platter** *(primary; drawn in [icon.svg](./icon.svg))*: a jog-wheel ring drawn as a cyan-to-magenta gradient stroke, with a waveform "N" cut through the centre. It reads as a platter at small sizes and as an N at large sizes.
2. **Split Deck:** two half-circles (Deck A cyan, Deck B magenta) meeting at a vertical crossfader line. It literally shows two decks being mixed.
3. **Camelot Crown:** twelve short radial ticks (the 12 Camelot key positions) around a play triangle, with one tick lit. It hints at harmonic intelligence.
4. **Wordmark:** "DJ NEXUS" in Chakra Petch SemiBold, tracking +8%, with the X built from two crossing waveform strokes. "PRO" sits in a small outlined capsule.

### 1.4 Color Palette

Dark-first. The deck colours carry meaning (they identify decks everywhere in the UI), so they stay the same across all screens.

| Token | Hex | Role |
|---|---|---|
| `void` | `#07060D` | App background, the "booth" |
| `deck` | `#12101E` | Panels, deck surfaces |
| `rail` | `#221E36` | Dividers, inactive knobs, grid lines |
| `ink` | `#EDEBFA` | Primary text |
| `ink-dim` | `#8B86A8` | Secondary text, labels |
| `deck-a` / neon cyan | `#19F0FF` | Deck A, primary accent |
| `deck-b` / neon magenta | `#FF2BD6` | Deck B, secondary accent |
| `deck-c` / amber | `#FFB020` | Deck C, cue points, warnings |
| `deck-d` / violet | `#8A5CFF` | Deck D, AI features ("the bot's colour") |
| `live` | `#FF3B5C` | Recording, clipping, emergency mode |
| `ok` | `#3DFFA2` | Sync locked, key-compatible |

Waveforms use the frequency-coloured convention DJs expect: lows in deep blue/violet, mids in cyan, highs in white.

### 1.5 Typography

| Role | Face | Use |
|---|---|---|
| Display | **Chakra Petch** (SemiBold 600) | Screen titles, deck letters, wordmark |
| UI / body | **IBM Plex Sans** (400/500) | Labels, lists, settings |
| Numerals | **JetBrains Mono** (500, tabular) | BPM, key, time, pitch %; digits must never jitter while playing |

All three are open-licence (OFL), so they can be bundled in the app.

### 1.6 App Icon

- Adaptive icon (Android) and 1024 px App Store icon from `icon.svg`: the Nexus Platter on `void`, with a soft outer glow.
- The monochrome Android 13+ themed icon uses the ring and the N alone.
- Minimum-size test: it must still read as a platter at 48 px. The waveform detail drops out below 64 px by design.

---

## 2. Product Blueprint & Feature List

### 2.1 Product Summary

| Item | Value |
|---|---|
| Name | DJ Nexus Pro (working) |
| Platforms | Android 9+ (API 28, AAudio low-latency path), iOS 16+ |
| Form factors | Phone (2 decks, landscape), tablet (2 or 4 decks) |
| Core value | A professional deck and mixer layout plus an AI bot that analyses your library and builds, queues and mixes sets |
| Target users | Bedroom and mobile DJs, EDM/techno/trance/psytrance fans, content creators recording mixes, working DJs who want a backup rig on their phone |

### 2.2 Feature Matrix

Legend: **F** = Free, **P** = Premium. Master access unlocks everything. Release: **1.0** = launch, **1.x** = within 6 months, **2.0** = research track.

| Area | Feature | Tier | Release |
|---|---|---|---|
| Library | Scan device, SD, USB OTG, cloud folders | F | 1.0 |
| Library | BPM, key, energy, genre analysis | F (first 200 tracks) / P (unlimited) | 1.0 |
| Library | Smart search, favourites, sorting | F | 1.0 |
| Library | Cloud import (Drive, Dropbox, iCloud Drive) | P | 1.0 |
| Decks | 2 decks, waveform, beat grid, sync | F | 1.0 |
| Decks | 4 decks (tablet) | P | 1.0 |
| Decks | 8 hot cues | F: 3 / P: 8 (16 on tablet) | 1.0 |
| Decks | Loops (auto/manual), slip, reverse, vinyl mode | F | 1.0 |
| Mixer | 3-band EQ, trim, filter, crossfader, master | F | 1.0 |
| FX | Colour FX (filter, noise, pitch, dub echo) | F | 1.0 |
| FX | Beat FX (reverb, echo, delay, flanger, phaser, roll, stutter, distortion) | F: 4 / P: all | 1.0 |
| Sampler | Sampler pads | F: 16 pads, 1 bank / P: 1,000+ pads across banks | 1.0 |
| Sampler | Downloadable packs, custom pack import | P (paid packs are IAP) | 1.0 |
| Smart DJ Bot | Auto-playlists by genre | F | 1.0 |
| Smart DJ Bot | Harmonic Smart Queue + auto-mix | P | 1.0 |
| AI | See §5, 27 AI features across 8 groups | Mostly P | 1.0 → 2.0 |
| Recording | Record set to WAV/AAC | F (30 min) / P (unlimited, + MP3) | 1.0 |
| Recording | AI mastering | P | 1.x |
| Sharing | YouTube, Instagram, TikTok, SoundCloud, Mixcloud | F | 1.0 |
| Hardware | MIDI controller support (USB/BLE MIDI) | P | 1.x |
| Account | Cloud sync of playlists, cue points, FX presets, packs | P | 1.0 |

### 2.3 Non-Functional Targets

| Metric | Target |
|---|---|
| Audio output latency | ≤ 20 ms on "pro audio" Android devices and all iOS devices; ≤ 40 ms elsewhere |
| Audio dropouts | 0 underruns in a 60-minute 4-deck stress test on reference devices |
| Library analysis speed | ≥ 10 tracks/min on a mid-range phone (Snapdragon 7-series), in the background |
| Cold start to playable deck | < 2.5 s |
| Crash-free sessions | ≥ 99.7% |
| Offline | Everything except cloud import, sync, cloud AI jobs and pack downloads works offline |

---

## 3. Smart DJ Bot

The Smart DJ Bot is the app's AI co-pilot. It has its own tab and also appears as a violet assistant chip on the deck screen.

### 3.1 Library Scanning

| Source | Android | iOS |
|---|---|---|
| Internal storage | `MediaStore.Audio` query (`READ_MEDIA_AUDIO` on 13+, `READ_EXTERNAL_STORAGE` on ≤12) | Music library via `MPMediaQuery` (DRM-free items only, identified by a non-nil `assetURL`) |
| SD card | MediaStore (indexed volumes) + SAF tree picker for non-indexed folders | n/a |
| USB OTG / external drives | SAF `ACTION_OPEN_DOCUMENT_TREE`; persisted URI permission; rescan when the drive is mounted | Files app document picker (security-scoped bookmarks) |
| Cloud | Drive / Dropbox APIs, download to app cache | iCloud Drive via Files picker; Drive / Dropbox APIs |

Supported formats: MP3, AAC/M4A, WAV, AIFF, FLAC, OGG, ALAC (iOS). Decoding uses platform decoders (MediaCodec / AVAudioFile) and falls back to FFmpeg (LGPL build, dynamically linked) for FLAC/OGG on older devices.

**Scan pipeline:** enumerate → fingerprint (Chromaprint; also used to match tracks across devices for sync) → read tags (TagLib) → queue for analysis → analyse in a background worker (WorkManager on Android, `BGProcessingTask` on iOS) → write to the local DB. Scans are incremental: a track is re-analysed only when its file hash changes.

### 3.2 Analysis Output (per track)

| Field | Method | Model (see AI blueprint) |
|---|---|---|
| BPM (float, plus confidence) | Beat tracking network + tempo octave correction | BPM Detection Model |
| Beat grid (downbeat anchor + tempo map) | Beat/downbeat network, dynamic-programming grid fit | Beat-Grid Alignment Model |
| Key (Camelot + musical notation) | CQT chroma CNN | Key Detection Model |
| Energy 1–10 and Low/Medium/High | Loudness, spectral flux, onset density → regressor | Energy Level Classifier |
| Genre (top-3 with probabilities) | Mel-spectrogram CNN/transformer | Genre Classifier |
| Mood / emotion (valence, arousal + tags) | Regression head on shared embedding | Emotion Detection Model |
| Sections (intro, build, drop, break, outro) | Structure segmentation | Build-Up Detector + Drop Timing Predictor |
| Suggested cues | From sections + phrase boundaries | AI Cue Point Generator |
| 512-d audio embedding | Shared encoder | Used for "sounds like" search |

### 3.3 Auto-Playlists

Generated on first scan and refreshed nightly: **EDM, Electro, Techno, Trance, House, Psytrance, Melodic Techno**, plus dynamic lists: *Peak Time (energy ≥ 8)*, *Warm-Up (energy 3–5, 118–124 BPM)*, *Same Key as Now Playing*, *Recently Added*, *Never Played*.

Genre thresholds: a track joins a genre playlist when that genre's probability is ≥ 0.45, or when it is the top-1 genre at ≥ 0.30 with a margin of ≥ 0.10 over the next. The user can override the genre, and overrides feed personalisation (§5.6).

### 3.4 Match Suggestions & Smart Queue

**Compatibility score** between the current track *A* and a candidate *B* (0–100):

```
score = 35·key(A,B) + 30·tempo(A,B) + 20·energy(A,B) + 15·vibe(A,B)

key    : 1.0 same Camelot key; 0.9 ±1 on the wheel or relative major/minor;
         0.6 energy boost (+2 / +7 semitone moves); 0.2 otherwise
tempo  : 1.0 if |ΔBPM| ≤ 2%; linear to 0 at 8%; also try half/double time
energy : 1 − |ΔE − target_step| / 9     (target_step from the set plan, default +0.5)
vibe   : cosine similarity of audio embeddings, rescaled to 0..1
```

**Smart Queue Mode** keeps the next 5 tracks filled using beam search (width 8) over this score, with penalties for repeating an artist within 4 tracks and for staying at one energy level for more than 3 tracks. "Lock" pins a track in the queue. "Why this?" explains a suggestion, for example: *"8A → 9A, 124 → 126 BPM, energy 6 → 7"*.

### 3.5 Suggested Downloads (legal only)

When the queue has a gap (for example, no 128 BPM 5A track at energy 8), the bot shows "Tracks that would fit here" from:

1. Royalty-free / CC catalogues with commercial-use licences (Jamendo, FMA, plus our own licensed pack library).
2. Store search deep links (Beatport, Bandcamp, Traxsource), using affiliate links where a programme exists.
3. User-provided links and folders.

We never scrape, rip or proxy audio from streaming or video sites.

### 3.6 Download Hub

A catalogue of **sound effects, sampler packs, DJ tags/drops, risers, impacts, drum kits and loops**, served from cloud storage (§10). Each pack has a preview, BPM/key metadata, a licence ("royalty-free for live and recorded use") and a size. Users can also **import custom packs**: a ZIP or folder of WAV/MP3/AIFF files plus an optional `pack.json` (name, pad colours, BPM, key, choke groups). Imported packs stay on the device and sync (Premium) only if the user turns it on.

---

## 4. DJ Controller Interface

### 4.1 Decks

| Feature | Specification |
|---|---|
| Layout | 2 decks on phone (landscape). 2 or 4 on tablet. In 4-deck mode, decks C/D fold into compact strips and tapping one swaps it into a main slot |
| Waveforms | Overview strip (whole track, playhead, cue markers) + scrolling HD detail waveform, 3-band colour, 60 fps, pre-rendered at analysis time into a multi-resolution cache |
| Zoom | Pinch or ± buttons: 2, 4, 8, 16, 32 beats visible |
| Beat grid | Bar lines are brighter than beat lines. Grid edit mode: nudge, set downbeat, adjust BPM ±0.01, "AI fix" (Beat-Grid Corrector) |
| Jog wheel | Touch platter: vinyl mode (top touch scratches, edge touch bends), CDJ mode (nudge only), and a scratch sensitivity setting |
| Pitch / tempo | ±6/10/16/50% ranges, key lock (master tempo), sync (tempo + phase), quantize |
| Hot cues | 8 per deck on phone, 16 on tablet (2 pages); colour and name editable; quantized when quantize is on |
| Loops | Auto-loop ¼ to 32 beats; manual in/out; loop halve/double; loop roll; saved loops stored like hot cues |
| Slip mode | The playhead keeps running silently during loops, scratches, reverse and rolls, and playback resumes where it would have been |
| Reverse | Momentary or latched (respects slip) |
| Censor | Momentary reverse + slip |
| Track load | Drag from browser, "load next from Smart Queue", or instant doubles |

### 4.2 Mixer

Per channel: **Trim** (±12 dB) → **3-band EQ** (low 70 Hz shelf, mid 1 kHz bell, high 13 kHz shelf; isolator mode can fully kill each band) → **Colour FX / Filter knob** (bipolar: LPF left, HPF right, resonance in settings) → **Channel fader** (curve setting) → **Crossfader assign** (A/THRU/B) → **Channel FX send**.

Master: crossfader (curve: smooth, sharp cut, scratch), master level, a booth/cue mix for headphone preview (needs a split cable or a USB interface with two stereo outputs; the app detects multi-channel outputs), limiter, and stereo VU meters with peak hold.

### 4.3 Effects

| Group | Effects | Parameters |
|---|---|---|
| Beat FX (tempo-synced) | Echo, Delay, Ping-Pong, Reverb, Flanger, Phaser, Roll, Slip Roll, Stutter, Trans, Pitch, Distortion | Beat division ¼–16, depth, dry/wet, channel select, on/off or momentary |
| Colour FX (per channel, on the filter knob) | Filter, Noise, Dub Echo, Pitch, Crush, Space | One knob |
| Build tools | Riser (noise sweep + pitch), Build-Up (combined filter + reverb + roll over N bars), Drop (cut + impact + release) | Length in bars, intensity |
| AI FX | Presets from the AI FX Synthesizer and the Live FX Assistant (§5) | Macro knob |

The DSP is written once in C++ and shared by both platforms (§10.2). Every effect has a tail (reverb and echo ring out after switching off) and a "freeze" hold.

### 4.4 Sampler

- 16 pads per bank (4×4), unlimited banks for Premium (1,000+ pads with the bundled library).
- Modes: one-shot, gate, loop (tempo-synced), toggle. Choke groups. Pad velocity from touch radius on supported devices.
- Sampler output can be routed to the master or through a channel so it passes through EQ and FX.
- Pads can be recorded from any deck ("capture last 4 beats"), which makes a quick way to build vocal chops in combination with the AI Vocal Chop Maker.

---

## 5. AI Feature Catalogue

All AI features are Premium unless marked **F**. "Where" means on-device (**D**), cloud (**C**), or hybrid (**H**: on-device fast path, cloud for full quality). The models behind each feature are specified in [AI_TRAINING_BLUEPRINT.md](./AI_TRAINING_BLUEPRINT.md).

### 5.1 Mixing & Transition Intelligence

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI Transition Composer** | Pick outgoing and incoming tracks → it proposes 3 transitions (e.g. "16-bar bass swap", "echo-out on the phrase", "filter blend") with an EQ/filter/FX automation lane you can preview, edit and trigger | H | 1.0 |
| **AI Drop Timing Predictor** | Marks the next drop on the waveform with a countdown in bars; "land on the drop" auto-aligns the incoming track so its drop hits on the outgoing phrase | D | 1.0 |
| **AI Beat-Grid Corrector** | Detects drifting or offset grids (live drums, tempo changes) and fixes them with one tap; shows a before/after diff | D | 1.0 (**F**) |
| **AI Cue Point Generator** | Places up to 8 colour-coded cues (first beat, mix-in, build, drop, break, mix-out) | D | 1.0 (**F**: 3 cues) |

### 5.2 Sound & FX Creation

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI FX Synthesizer** | Text or knob-based ("dark metallic riser, 8 bars, 128 BPM") → a new FX sample, loaded onto a pad | C | 1.x |
| **AI Vocal Chop Maker** | Isolates vocals, slices them at syllable onsets, pitches them to the deck key, and maps them to 8 pads | H | 1.x |
| **AI Stem Splitter Pro** | 4 stems (vocals, drums, bass, other), with per-stem faders and mute on the deck. Precomputed in the background after load (fast model on-device, high-quality model in the cloud) | H | 1.0 |

### 5.3 Music Discovery & Enhancement

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI Genre Morphing** | Re-dresses a track toward another genre (e.g. house → techno) by swapping and processing stems: drum replacement from a genre kit, bass re-synthesis, FX chain. It is a performance effect, not a new master | C | 2.0 |
| **AI BPM Stretching** | High-quality time-stretch beyond ±16% with transient preservation; offline "render at 140 BPM" | H | 1.0 |
| **AI Key Shifting** | Pitch-shift to a target key with formant-preserving vocals (on stems) | H | 1.0 |

### 5.4 DJ Analytics & Coaching

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI Set Analyzer** | After a recording: energy curve, key path on the Camelot wheel, BPM path, transition quality scores, clashing moments with timestamps | C | 1.0 |
| **AI DJ Skill Coach** | Weekly drills and tips from your sets ("your beatmatch drifts after 20 s, try nudging earlier"; "3 of 9 transitions clashed keys") | C | 1.x |
| **AI Crowd Energy Simulator** | A virtual crowd meter that reacts to your mix, for practice. Clearly labelled as a simulation, since it is trained on a small crowd-reaction dataset | D | 2.0 |

### 5.5 Personalization & Automation

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI Mood-Based Set Builder** | "90 min, sunset rooftop, melodic → peak" → an ordered set with an energy arc | D | 1.0 |
| **AI Auto-Tagging** | Genre, sub-genre, mood, vocal/instrumental, instruments, era | D | 1.0 (**F**) |
| **AI Smart Sorting** | Learns how you sort and group (your crates, your overrides) and proposes crates for new tracks | D | 1.x |

### 5.6 Live Performance Tools

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI Live FX Assistant** | Suggests a context-aware FX move 4–8 bars ahead ("echo out on the vocal at bar 64"); one tap arms it on the right beat | D | 1.x |
| **AI Crowd Mode** | Hands-free auto-DJ that keeps the Smart Queue running and executes Transition Composer mixes, with an energy target the user sets | D | 1.0 |
| **AI Emergency Mix Mode** | One red button when a track is ending or a deck fails: it picks the best compatible track, loads it on the free deck, and runs a safe 8-bar blend or echo-out automatically | D | 1.0 |

### 5.7 Deep Music Understanding

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI Emotion Detection** | Valence/arousal plot per track and over time; mood tags | D | 1.0 |
| **AI Frequency Analyzer** | Real-time spectrum + "clash meter" that warns when both decks' low end overlaps (two kicks or basslines at once) | D | 1.0 (**F**) |
| **AI Build-Up Detector** | Highlights build sections on the waveform and predicts their length in bars | D | 1.0 |

### 5.8 Futuristic Features

| Feature | What the user gets | Where | Release |
|---|---|---|---|
| **AI DJ Personality Mode** | Pick a style profile ("Minimal Purist", "Festival Maximalist", "Psy Journey") that sets how Crowd Mode chooses tracks, transition length and FX density. Profiles are style archetypes, never imitations of named real DJs | D | 1.x |
| **AI Track Mood Converter** | Shifts a track's mood with EQ tilt, reverb space, stem balance and key/mode changes (e.g. brighter/darker) | C | 2.0 |
| **AI Set Storyline Creator** | Plans a set as chapters (arrival → groove → peak → release → closer) with target energy per chapter and fills it from your library | C | 1.x |

---

## 6. Music Library & Management

- **Browser:** Library / Playlists / Crates / Smart Lists / Folders / History / Cloud. The list view has columns for artwork, title, artist, BPM, key (Camelot, colour-coded by compatibility with the playing deck), energy, genre, duration, rating and play count.
- **Search:** fuzzy text search over title/artist/album/label/tags, plus a query syntax: `bpm:124-128 key:8A energy:>6 genre:techno`. Search results can be ranked by compatibility with the deck that has focus.
- **Sorting:** any column, plus "Best next track" (compatibility score).
- **Favourites** (heart), 5-star rating, colour labels.
- **Auto playlists** (§3.3) and user playlists/crates with drag reorder.
- **Cloud import:** Google Drive, Dropbox (OAuth, file picker, download to app library folder), iCloud Drive (Files). Imported files are analysed like local files.
- **External device import:** USB OTG / SD / Files locations (§3.1). Rekordbox XML, Serato crates and M3U/M3U8 import for playlists and cues where the files are present.
- **Metadata editing:** tags, artwork, BPM/key overrides (overrides are never overwritten by re-analysis).
- **Duplicates:** Chromaprint matching flags duplicates across sources.

---

## 7. Recording & Sharing

### 7.1 Recording

- Records the master bus post-limiter (optionally including a mic input on devices with a USB interface).
- Formats: **WAV** (16/24-bit, 44.1/48 kHz), **MP3** (320 kbps, LAME), **AAC** (256 kbps, platform encoder).
- A tracklist with timestamps is saved alongside every recording (from deck load and crossfader history), exportable as text for YouTube chapters and descriptions.
- Recording writes to disk in chunks, so a crash loses at most the last 2 seconds.

### 7.2 AI Mastering (Premium)

A cloud job: loudness target (−9 LUFS club / −14 LUFS streaming), multiband compression, EQ matched to a reference profile, true-peak limit −1 dBTP. The user compares before and after with an A/B toggle and keeps the original.

### 7.3 Sharing

| Destination | Method |
|---|---|
| YouTube | YouTube Data API upload (OAuth); auto-generated waveform video (1080p, artwork + animated waveform + tracklist chapters) |
| Instagram / TikTok | Platform share sheet with a 9:16 clip (best 30/60 s chosen by the Drop Timing Predictor) |
| SoundCloud | SoundCloud API upload |
| Mixcloud | Mixcloud API upload (recommended for full DJ sets, since Mixcloud licenses mixes) |
| Files / other | System share sheet |

**Copyright pre-check:** before upload, the app lists commercial tracks in the set (matched by fingerprint and tags) and warns about Content ID claims or muting on YouTube, Instagram and TikTok. It never blocks the upload.

---

## 8. User Accounts, Entitlements & Master Access

### 8.1 Sign-in

- Email + password (Argon2id), Sign in with Apple (required on iOS when other social logins exist), Google.
- The app works without an account (local-only Free tier). An account is needed for Premium, sync and cloud AI.

### 8.2 Entitlements Model

The app never decides on its own what is unlocked. The server returns a **signed entitlement token** (JWT, Ed25519, 30-day expiry so DJs can play offline at gigs; refreshed whenever online):

```json
{
  "sub": "usr_01J...",
  "plan": "MASTER",                          // FREE | PREMIUM | MASTER
  "ent": ["premium", "decks:4", "cues:16", "sampler:unlimited",
          "ai:*", "packs:*", "sync", "export:mp3", "mastering"],
  "subscription_check": false,               // MASTER skips store receipt checks
  "exp": 1790000000
}
```

The app verifies the signature with a public key bundled in the binary and gates each feature with `ent.contains(...)`. Only the server holds the private key, so editing the token on a rooted device gets you nothing.

Plan resolution on the server, in order:

1. **MASTER:** the account's `role` is `MASTER`. The role can only be set by the bootstrap script or by an existing master through the admin API. It is never granted by a login request.
2. **PREMIUM:** an active store subscription (verified through RevenueCat webhooks and receipt validation) or a promotional grant.
3. **FREE:** everyone else.

### 8.3 Master Access for Roshan

What Roshan experiences is exactly what the brief asked for: sign in as **RoshanMaster**, and every Premium feature, every AI module, every pack and 4-deck mode is unlocked, with no paywalls and no subscription prompts.

How it works:

| Requirement from the brief | Implementation |
|---|---|
| Username `RoshanMaster` | Reserved at the server: sign-up rejects it (and case/Unicode look-alikes). The account is created once by `scripts/bootstrap-master` |
| Password | Chosen at bootstrap, stored only as an Argon2id hash. **Do not reuse `DJNexusUnlimited`**: it is in plain text in the brief and chat history |
| `UnlockAllPremiumFeatures()` | Entitlement token with `plan: MASTER`, `ent: ["premium", "ai:*", "packs:*", ...]` |
| `BypassSubscriptionChecks()` | `subscription_check: false`; the paywall and receipt checks are skipped for this token. A RevenueCat promotional *lifetime* entitlement is also granted so store-side screens agree |
| `EnableAllAIModels()` | `ai:*` enables every AI module, including 2.0 experimental features behind the "Labs" toggle, and gives master jobs top cloud queue priority with no credit limits |
| Security | Login rate limit (5 tries / 15 min / IP + account), optional TOTP 2FA (recommended for MASTER), every master login written to `audit_log`, master sessions revocable from the admin API |

The code is in [§17](#17-developer-guide-master-access).

### 8.4 Cloud Sync (Premium and Master)

Synced: playlists/crates (as track fingerprints + metadata, never the audio files), cue points, loops, beat-grid edits, FX presets, sampler pack assignments and purchased/imported pack manifests, settings. Last-writer-wins per field with vector clocks per object, so edits on phone and tablet merge instead of overwriting whole playlists.

---

## 9. UI/UX: Screens & Flows

Interactive mockups for all seven screens are in **[mockups.html](./mockups.html)**.

### 9.1 Design Language

- **Surfaces:** near-black `void` background, `deck` panels with 1 px `rail` borders. Neon only where something is *active*: a playing deck glows, a paused one doesn't. This keeps the neon meaningful and saves battery on OLED screens.
- **Holographic accents:** a subtle cyan→magenta→violet gradient appears only on the jog-wheel ring, the Smart DJ Bot orb and Premium badges.
- **Touch targets:** ≥ 44 pt. Performance controls (play, cue, hot cues) ≥ 56 pt with haptic feedback.
- **Landscape first** for the deck screen; portrait for library, bot and settings.
- **Motion:** 60 fps waveforms; UI transitions ≤ 200 ms; reduced-motion setting disables glow pulses.

### 9.2 Navigation Map

```
Splash ─► (first run) Onboarding: permissions → library scan → pick genres
      └─► Home Dashboard
            ├─ Decks (DJ Controller)  ◄── main landscape screen
            │    ├─ Library drawer (swipe up)
            │    ├─ FX panel / Sampler panel (tabs under the mixer)
            │    └─ Bot chip → Smart Queue sheet, Emergency Mix
            ├─ Smart DJ Bot
            │    ├─ Scan status & analysis
            │    ├─ Playlist Generator
            │    └─ Set Builder / Storyline
            ├─ Library
            ├─ FX & Sampler Hub (packs, downloads, imports)
            ├─ Recordings (set analyzer, mastering, share)
            └─ Settings (audio, decks, account, sync, Labs)
```

### 9.3 Screen Specifications

**Splash:** Nexus Platter logo spins up like a platter reaching 33⅓ rpm (600 ms), with a wordmark fade. The audio engine and DB warm up in parallel. Skipped on warm starts.

**Home Dashboard:** a greeting with library stats (tracks, analysed %, hours), a *Continue* card (last session's decks), *Bot suggests* (a set built from recent favourites), quick tiles (Decks, Smart Bot, Record, Hub), and recent recordings. A plan badge (FREE / PREMIUM / MASTER) sits top-right.

**DJ Controller (landscape):** top band has the two overview waveforms and the detail waveforms stacked with a shared beat-aligned centre line. The left and right thirds are Deck A and Deck B: jog wheel, BPM/key/pitch readout, play/cue, sync, 8 hot-cue pads, loop row. The centre third is the mixer: trim, 3 EQ knobs and filter per channel, channel faders, crossfader, master meter. Below the mixer, tabs switch between FX, Sampler and Stems. The bot chip is in the top centre; the red Emergency Mix button is long-press only, to avoid accidental triggers.

**Smart DJ Bot:** an animated violet orb shows state (scanning, analysing, ready). Cards: scan progress per source, genre breakdown donut, energy histogram, "Next up" queue with scores, and a text/voice prompt ("build me 60 min of melodic techno").

**Playlist Generator:** inputs are duration, genres, BPM range, start/end energy, key strategy (strict harmonic / relaxed) and mood. The output shows the ordered list with an energy-curve chart and a key path. Actions: Save, Send to Smart Queue, Regenerate, Lock tracks.

**FX & Sampler Hub:** tabs for My Packs / Store / Import. Pack cards show waveform preview, pad count, BPM/key, size, and price or "Included". Import accepts a folder or ZIP. The AI FX Synthesizer prompt sits at the top of the Store tab.

**Settings:** Audio (output device, buffer size, sample rate, latency test, headphone cue routing), Decks (pitch range, jog mode, quantize, sync mode, waveform colours), Library (sources, rescan, analysis quality), AI (on-device vs cloud, Labs features), Account (plan, sync, sign out, restore purchases), Recording defaults, About.

### 9.4 Key Flows

1. **First run:** permission prompt with an explanation of why → pick sources → scan starts in the background → decks are usable immediately with analysed tracks appearing as they finish.
2. **Auto-mix a party:** Bot → "Crowd Mode" → set energy target and length → go. The deck screen shows the upcoming transition 16 bars ahead, and touching any control takes over manually.
3. **Record and post to YouTube:** Record → play set → Stop → Set Analyzer → (Premium) Master → Share → YouTube, with auto title, tracklist chapters and the copyright pre-check.

---

## 10. Technical Architecture

### 10.1 Stack Decisions

| Layer | Choice | Why |
|---|---|---|
| UI | **Flutter** (Dart 3) | One UI codebase for both platforms; `CustomPainter` + Impeller handle 60 fps waveforms; `dart:ffi` calls the C++ engine directly without a platform-channel hop. React Native could work, but the audio engine must be native either way and Flutter's rendering is more predictable for waveform-heavy screens |
| Audio engine | **C++17 shared core** + thin platform hosts: **Oboe** (AAudio/OpenSL ES) on Android, **AVAudioEngine / RemoteIO** on iOS | Real-time audio cannot run in Dart or JavaScript. One DSP codebase keeps both platforms sounding identical |
| Time-stretch / pitch | **Rubber Band Library** (commercial licence; the GPL version can't ship in a closed-source app) or the **Superpowered** SDK (commercial). Decide after a 1-week quality and CPU bake-off | Key lock and BPM stretching are core; both are proven in DJ products |
| On-device ML | **TensorFlow Lite / LiteRT** (Android, with NNAPI/GPU delegate) and **Core ML** (iOS, Neural Engine). Models exported from PyTorch | Hardware acceleration on both platforms |
| Local DB | **SQLite** via `drift` | Relational queries over large libraries (50k+ tracks), works offline |
| Backend | **Node.js (TypeScript, Fastify)** API + **PostgreSQL** + **Redis** (rate limits, queues) | Relational data (entitlements, sync, packs); same language as the repo's other web project |
| Auth | Own auth service (Argon2id, JWT) + Sign in with Apple / Google | Needed for server-side MASTER role and signed entitlements |
| Billing | **RevenueCat** over StoreKit 2 / Play Billing | One entitlement source across stores; supports promotional grants for the master account |
| GPU inference | Python (FastAPI) workers on a GPU pool (e.g. Modal, RunPod or GKE with L4 GPUs), fed by a Redis/BullMQ queue | Stem splitting HQ, FX synthesis, mastering, set analysis |
| Storage | **Cloudflare R2** (S3 API, no egress fees) + CDN for packs and models | Sampler packs and model files are download-heavy |
| Analytics / crash | Firebase Crashlytics + privacy-respecting product analytics (PostHog, self-hosted or EU) | |

### 10.2 Real-Time Audio Engine

```
               ┌───────────────────── C++ audio thread (lock-free) ─────────────────────┐
 Decoder pool ─► Deck A: stretch/pitch ─► stems mix ─► trim ─► EQ ─► filter/colour FX ─► fader ─┐
 (worker thr.) ► Deck B: ...                                                                   ├► crossfader ─► Beat FX ─► master limiter ─► output (Oboe / RemoteIO)
               ► Deck C/D: ...                                                                 │                                   └► recorder ring buffer ─► disk thread
 Sampler ────────────────────────────────────────────────────────────────────────────────────┘
 Cue bus: pre-fader taps ─► headphone output (when a 4-channel device is present)
               └────────────────────────────────────────────────────────────────────────┘
 UI (Flutter) ◄── lock-free SPSC queues ──► engine commands (play, cue, knob values) and telemetry (playhead, meters, 60 Hz)
```

Rules for the audio thread: no allocation, no locks, no I/O, no logging. Decoding and file reading happen on worker threads into ring buffers with ≥ 2 s lookahead. Parameter changes are smoothed over 10–20 ms to avoid zipper noise. Buffer size is 128–256 frames at 48 kHz by default, user-adjustable, with a built-in latency test.

**AI in the audio path:** only lightweight, deterministic logic runs in real time (queue decisions, FX triggers timed to the beat grid). Heavy models (analysis, stems) run ahead of time on worker threads or in the cloud, and results are cached per track.

### 10.3 System Diagram

```
┌───────────── Mobile app (Flutter) ─────────────┐        ┌──────────────── Backend ────────────────┐
│ UI  ◄─ffi─►  C++ audio engine                   │  HTTPS │ API (Fastify)  ── Postgres               │
│ drift/SQLite (library, analysis, cues)          │ ─────► │   auth, entitlements, sync, packs, jobs  │
│ ML runtime (LiteRT / Core ML) + model cache     │        │ Redis (rate limit, BullMQ)               │
│ Entitlement verifier (Ed25519 public key)       │        │ GPU workers (FastAPI + PyTorch)          │
│ RevenueCat SDK                                  │        │   stems HQ, FX synth, mastering, set AI  │
└─────────────────────────────────────────────────┘        │ R2 + CDN (packs, models, temp uploads)   │
                                                            │ RevenueCat webhooks → entitlements      │
                                                            └──────────────────────────────────────────┘
```

### 10.4 Security & Privacy

- Audio files never leave the device unless the user runs a cloud AI job. Uploads for cloud jobs are encrypted in transit, stored in a per-job bucket prefix and **deleted within 24 h** of job completion.
- Sync stores fingerprints and metadata only.
- Tokens are stored in Android Keystore / iOS Keychain. Certificate pinning on API calls.
- Secrets (JWT private key, master password hash, store keys) live only in the server's secret manager.
- GDPR / DPDP (India): data export and account deletion from Settings; a privacy policy that lists processors (RevenueCat, cloud GPU provider, Crashlytics).
- Permissions are requested just in time with a plain-language reason.

---

## 11. Database Schema

### 11.1 On-Device (SQLite / drift)

```sql
CREATE TABLE tracks (
  id              INTEGER PRIMARY KEY,
  fingerprint     TEXT NOT NULL,              -- Chromaprint, used for sync + duplicates
  file_hash       TEXT NOT NULL,              -- xxhash64 of file bytes, triggers re-analysis
  source          TEXT NOT NULL CHECK (source IN ('mediastore','saf','ios_music','files','cloud_drive','cloud_dropbox','icloud')),
  uri             TEXT NOT NULL UNIQUE,       -- content:// , file:// or bookmark id
  title TEXT, artist TEXT, album TEXT, label TEXT, year INTEGER,
  duration_ms     INTEGER,
  sample_rate     INTEGER,
  playable        INTEGER NOT NULL DEFAULT 1, -- 0 for DRM / missing
  rating          INTEGER CHECK (rating BETWEEN 0 AND 5),
  favourite       INTEGER NOT NULL DEFAULT 0,
  color_label     TEXT,
  play_count      INTEGER NOT NULL DEFAULT 0,
  last_played_at  INTEGER,
  added_at        INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_tracks_fp ON tracks(fingerprint);

CREATE TABLE track_analysis (
  track_id        INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  model_version   TEXT NOT NULL,
  bpm REAL, bpm_confidence REAL,
  key_camelot TEXT, key_confidence REAL,      -- e.g. '8A'
  energy REAL,                                -- 1..10
  energy_class TEXT CHECK (energy_class IN ('low','medium','high')),
  genres_json TEXT,                           -- [{"g":"techno","p":0.71},...]
  valence REAL, arousal REAL, moods_json TEXT,
  loudness_lufs REAL,
  vocal_prob REAL,
  embedding BLOB,                             -- 512 x float16
  sections_json TEXT,                         -- [{"type":"build","start_ms":..,"end_ms":..}]
  waveform_path TEXT,                         -- multi-res cache file
  stems_path TEXT,                            -- cached stems, nullable
  user_bpm REAL, user_key TEXT, user_genre TEXT, -- overrides, never overwritten
  analysed_at INTEGER NOT NULL
);
CREATE INDEX idx_analysis_bpm_key ON track_analysis(bpm, key_camelot);

CREATE TABLE beat_grids (
  track_id   INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  anchor_ms  REAL NOT NULL,                   -- first downbeat
  tempo_map  TEXT NOT NULL,                   -- [{"ms":0,"bpm":126.0}, ...] for variable tempo
  beats_per_bar INTEGER NOT NULL DEFAULT 4,
  edited_by_user INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cue_points (
  id        INTEGER PRIMARY KEY,
  track_id  INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  slot      INTEGER,                          -- 0..15 hot cue slot, NULL = memory cue
  kind      TEXT NOT NULL CHECK (kind IN ('hot','memory','loop')),
  start_ms  REAL NOT NULL,
  end_ms    REAL,                             -- loops only
  name TEXT, color TEXT,
  source    TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','ai','import')),
  sync_id   TEXT, updated_at INTEGER NOT NULL
);

CREATE TABLE playlists (
  id INTEGER PRIMARY KEY, sync_id TEXT UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('user','crate','auto_genre','smart','generated','history')),
  rule_json TEXT,                             -- smart list query / generator params
  parent_id INTEGER REFERENCES playlists(id),
  updated_at INTEGER NOT NULL
);
CREATE TABLE playlist_tracks (
  playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  position    REAL NOT NULL,                  -- fractional index for cheap reorder
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE sampler_packs (
  id INTEGER PRIMARY KEY, remote_id TEXT, name TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('bundled','store','imported','ai')),
  path TEXT NOT NULL, bpm REAL, key_camelot TEXT, installed_at INTEGER NOT NULL
);
CREATE TABLE sampler_pads (
  id INTEGER PRIMARY KEY,
  pack_id INTEGER REFERENCES sampler_packs(id) ON DELETE CASCADE,
  bank INTEGER NOT NULL, slot INTEGER NOT NULL,
  file_path TEXT NOT NULL, name TEXT, color TEXT,
  mode TEXT NOT NULL DEFAULT 'oneshot' CHECK (mode IN ('oneshot','gate','loop','toggle')),
  choke_group INTEGER, gain_db REAL DEFAULT 0
);

CREATE TABLE fx_presets (
  id INTEGER PRIMARY KEY, sync_id TEXT UNIQUE, name TEXT NOT NULL,
  chain_json TEXT NOT NULL, origin TEXT NOT NULL DEFAULT 'user', updated_at INTEGER NOT NULL
);

CREATE TABLE recordings (
  id INTEGER PRIMARY KEY, path TEXT NOT NULL, format TEXT NOT NULL,
  duration_ms INTEGER, started_at INTEGER NOT NULL,
  tracklist_json TEXT,                        -- [{"track_id":..,"at_ms":..}]
  analysis_json TEXT, mastered_path TEXT
);

CREATE TABLE entitlement_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token TEXT NOT NULL,                        -- signed JWT from server
  verified_at INTEGER NOT NULL
);
```

### 11.2 Server (PostgreSQL)

```sql
CREATE TYPE user_role AS ENUM ('USER', 'MASTER');
CREATE TYPE plan      AS ENUM ('FREE', 'PREMIUM', 'MASTER');

CREATE TABLE users (
  id              TEXT PRIMARY KEY,                 -- usr_<ulid>
  username        CITEXT UNIQUE,
  email           CITEXT UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT false,
  password_hash   TEXT,                             -- Argon2id; NULL for social-only
  totp_secret_enc BYTEA,                            -- encrypted, optional 2FA
  role            user_role NOT NULL DEFAULT 'USER',
  display_name    TEXT,
  country         CHAR(2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE reserved_usernames (
  username CITEXT PRIMARY KEY                       -- 'RoshanMaster', 'admin', 'support', ...
);

CREATE TABLE auth_identities (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('apple','google')),
  provider_uid TEXT NOT NULL,
  UNIQUE (provider, provider_uid)
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL,
  refresh_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

CREATE TABLE subscriptions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store           TEXT NOT NULL CHECK (store IN ('app_store','play_store','promo')),
  product_id      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('active','grace','billing_retry','expired','refunded')),
  current_period_end TIMESTAMPTZ,
  revenuecat_id   TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON subscriptions(user_id, status);

CREATE TABLE sync_objects (                         -- playlists, cues, grids, fx presets, settings
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  sync_id     TEXT NOT NULL,
  body        JSONB NOT NULL,
  vclock      JSONB NOT NULL,
  deleted     BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, sync_id)
);
CREATE INDEX ON sync_objects(user_id, updated_at);

CREATE TABLE packs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('fx','sampler','dj_tags','risers','drops','drum_kit','loops')),
  pad_count   INTEGER NOT NULL,
  bpm         REAL, key_camelot TEXT,
  size_bytes  BIGINT NOT NULL,
  price_tier  TEXT,                                 -- NULL = included with Premium
  store_product_id TEXT,
  r2_key      TEXT NOT NULL,
  preview_key TEXT NOT NULL,
  licence     TEXT NOT NULL,
  published   BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE pack_ownership (
  user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  pack_id  TEXT REFERENCES packs(id),
  source   TEXT NOT NULL CHECK (source IN ('premium','purchase','master','promo')),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pack_id)
);

CREATE TABLE ai_jobs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                        -- stems_hq, fx_synth, mastering, set_analysis, genre_morph...
  status      TEXT NOT NULL CHECK (status IN ('queued','running','done','failed','expired')),
  priority    SMALLINT NOT NULL DEFAULT 5,          -- MASTER = 0
  input_key   TEXT, output_key TEXT,
  params      JSONB NOT NULL DEFAULT '{}',
  model_version TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ                            -- input/output deleted after this
);
CREATE INDEX ON ai_jobs(status, priority, created_at);

CREATE TABLE model_releases (
  name        TEXT NOT NULL,                        -- bpm, key, genre, stems_fast, ...
  version     TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('android','ios','cloud')),
  r2_key      TEXT NOT NULL, sha256 TEXT NOT NULL,
  min_app_version TEXT NOT NULL,
  rollout_pct SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (name, version, platform)
);

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),
  action     TEXT NOT NULL,                         -- login, master_login, role_change, session_revoke...
  ip         INET, user_agent TEXT,
  meta       JSONB,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 12. API Endpoints

Base URL `https://api.djnexus.app/v1`. JSON over HTTPS; bearer access token (15 min) + refresh token (rotating).

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | Email/username/password sign-up (rejects reserved usernames) |
| POST | `/auth/login` | Username or email + password (+ `totp` when enabled). Returns tokens + entitlement token |
| POST | `/auth/oauth/{apple\|google}` | Social sign-in |
| POST | `/auth/refresh` | Rotate refresh token, returns fresh entitlement token |
| POST | `/auth/logout` | Revoke session |
| GET | `/me` | Profile, plan, entitlements |
| DELETE | `/me` | Account deletion (30-day grace) |
| GET | `/entitlements` | Current signed entitlement token |
| POST | `/billing/revenuecat/webhook` | Store events → subscriptions (HMAC verified) |
| GET | `/sync/changes?since=` | Pull changed sync objects |
| POST | `/sync/changes` | Push batch of sync objects (vector-clock merge) |
| GET | `/packs` | Pack catalogue (filter by category, BPM, key) |
| POST | `/packs/{id}/download` | Signed R2 URL (15 min) if owned/entitled |
| POST | `/ai/jobs` | Create a cloud AI job (`kind`, `params`); returns upload URL |
| GET | `/ai/jobs/{id}` | Job status + signed output URL |
| GET | `/models/manifest?platform=&app=` | On-device model versions to download |
| POST | `/share/youtube/token` | Exchange OAuth code for upload (tokens kept on device) |
| POST | `/admin/users/{id}/role` | MASTER only: grant/revoke role (audited) |
| POST | `/admin/sessions/{id}/revoke` | MASTER only: revoke a session |

Rate limits: `/auth/login` 5 per 15 min per IP+account; `/ai/jobs` 30/hour Premium, unlimited MASTER; everything else 600/min per user.

---

## 13. Monetization Plan

### 13.1 Tiers

| | **Free** | **Premium** | **Master** (Roshan) |
|---|---|---|---|
| Price | $0 | **$7.99/mo** or **$49.99/yr** (India: ₹299/mo, ₹1,999/yr via store price tiers) | Not sold |
| Decks | 2 | 2 + 4 on tablet | All |
| Hot cues | 3 per deck | 8 (16 on tablet) | All |
| Library analysis | First 200 tracks | Unlimited | Unlimited |
| Beat FX | 4 | All 12 + AI FX | All |
| Sampler | 16 pads | 1,000+ pads, all included packs | All packs, including paid ones |
| AI features | Beat-grid fix, auto-tagging, 3 AI cues, frequency analyzer, auto genre playlists | All 1.0/1.x AI features; 60 cloud AI minutes/month | All, including Labs; no limits; top queue priority |
| Recording | 30 min, WAV/AAC | Unlimited, WAV/MP3/AAC, AI mastering | All |
| Sync | — | Yes | Yes |
| Ads | None on the deck screen, ever. One interstitial max per session on Home only | None | None |

**Trial:** 7-day free trial on the yearly plan.

### 13.2 In-App Purchases

- **FX & sampler packs:** $1.99–$4.99 each (genre packs such as "Psytrance Leads & FX", "Techno Warehouse Drums", "Festival Drops"). Bundles: 5 for $14.99.
- **Cloud AI minutes top-up:** 60 minutes for $2.99.
- **Creator marketplace (1.x):** sound designers sell packs; 70/30 split after store fees.

### 13.3 KPI Targets (first 12 months)

| Metric | Target |
|---|---|
| D1 / D7 / D30 retention | 45% / 22% / 12% |
| Free → Premium conversion | 4% |
| Trial → paid | 35% |
| Pack attach rate (Premium users buying ≥ 1 pack) | 15% |
| Crash-free sessions | ≥ 99.7% |

---

## 14. App Store & Play Store Listings

### 14.1 Apple App Store

- **Name (30):** `DJ Nexus Pro: AI DJ Mixer`
- **Subtitle (30):** `Your Personal AI DJ Console`
- **Promotional text (170):** `New: AI Emergency Mix. One press picks the perfect next track and blends it for you. Plus stem splitting, harmonic Smart Queue and 1,000+ sampler pads.`
- **Keywords (100):** `dj,mixer,dj app,edm,techno,bpm,beatmatch,sampler,stems,auto mix,harmonic,cue,trance,house,remix`
- **Category:** Music (secondary: Entertainment)

**Description:**

> DJ Nexus Pro turns your phone or tablet into a professional DJ console, with an AI co-pilot that knows every track in your library.
>
> SMART DJ BOT
> • Scans your music and detects BPM, key, energy and genre automatically
> • Builds EDM, techno, trance, house, psytrance and melodic techno playlists for you
> • Smart Queue suggests the next track that fits by key, tempo and vibe
> • Crowd Mode mixes a whole party hands-free
>
> CLUB-STYLE DECKS AND MIXER
> • 2 decks on phone, 4 on tablet, with HD zoomable waveforms and beat grids
> • 8 hot cues, auto and manual loops, slip mode, reverse and vinyl scratch mode
> • 3-band EQ, trim, filter, crossfader, colour FX and beat FX
> • Reverb, echo, delay, flanger, phaser, roll, stutter, distortion, pitch and more
> • Sampler with 1,000+ pads and downloadable packs
>
> AI TOOLS
> • Stem splitter: vocals, drums, bass and melody on separate faders
> • Transition Composer, drop predictor, AI cue points and beat-grid fixer
> • Set Analyzer and DJ Skill Coach help you improve after every mix
>
> RECORD AND SHARE
> • Record sets in WAV, MP3 or AAC, with AI mastering
> • Share to YouTube, Instagram, TikTok, SoundCloud and Mixcloud with automatic tracklists
>
> Free to download. Premium unlocks 4 decks, all FX, unlimited analysis, every AI tool and cloud sync. Payment is charged to your Apple ID account. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Manage them in Account Settings.
>
> Only play music you own or have rights to use.

- **Review notes:** a demo Premium account for App Review (a normal PREMIUM account, not the MASTER account).

### 14.2 Google Play

- **Title (30):** `DJ Nexus Pro – AI DJ Mixer`
- **Short description (80):** `AI DJ console: auto BPM & key, smart playlists, stems, FX, sampler & auto-mix.`
- **Full description:** same as above, adapted to Play formatting (no Apple billing paragraph; add "Works with USB drives and SD cards").
- **Category:** Music & Audio. **Content rating:** Everyone. **Data safety:** audio stays on device unless cloud AI is used; account email; purchase history; crash logs.

### 14.3 Store Creative

Six screenshots (landscape for decks, portrait for the rest): (1) decks in the dark with glowing waveforms, "Your Personal AI DJ Console"; (2) Smart DJ Bot scan, "Knows every track: BPM, key, energy"; (3) Smart Queue, "Always the right next track"; (4) stems, "Pull the vocal out of anything"; (5) sampler/FX, "1,000+ pads and club FX"; (6) record and share, "Record. Master. Post." A 30-second preview video shows an Emergency Mix save in real time.

---

## 15. Marketing Strategy

### 15.1 Positioning

For EDM and techno fans who want to DJ without buying hardware, DJ Nexus Pro is the mobile DJ app that pairs a real club layout with an AI that mixes *with* you. Competitors are either toy-like auto-mixers or complex pro tools with no guidance.

### 15.2 Target Segments

1. **Aspiring bedroom DJs (18–30)** who learn on YouTube and TikTok. Hook: Skill Coach + Emergency Mix.
2. **Genre scene fans:** psytrance, melodic techno and trance communities. Hook: genre auto-playlists and genre FX packs.
3. **Content creators** who need mixes for videos and streams. Hook: record, master and share with tracklist chapters.
4. **Working DJs** who want a backup rig. Hook: 4 decks on tablet, Rekordbox import, MIDI (1.x).

### 15.3 Launch Plan (10 weeks)

| Week | Activity |
|---|---|
| −10 to −6 | Landing page + waitlist; closed beta with 200 DJs from Discord/Reddit (r/DJs, r/Beatmatch, r/psytrance) |
| −6 to −2 | Creator seeding: 30 DJ YouTubers/TikTokers get lifetime Premium codes; produce "AI vs me" transition challenge videos |
| −2 | Press kit, App Store "Coming soon" pre-order / Play pre-registration |
| 0 | Launch; Product Hunt; launch sale (yearly plan 40% off for 7 days) |
| +1 to +4 | Weekly "Set of the Week" contest (users submit recordings; winner gets a pack + feature) |

### 15.4 Your Own Channels

Use your existing YouTube channels as launch channels:

- **Channel content series:** "Mixing a 60-min psytrance set with only my phone", "AI picks my next track: does it clash?", 60-second Shorts of Emergency Mix saves.
- **Mixes for the channel:** record with royalty-free or licensed tracks (the copyright pre-check helps) so videos aren't claimed; link the app in the description with an attribution link.
- **Ebook tie-in (Amazon KDP):** a short guide such as *"Harmonic Mixing in 7 Days: A Phone DJ's Handbook"*, with a download code for 1 free month of Premium printed inside. The book promotes the app, and the app's Skill Coach can link to the book.

### 15.5 Growth Loops

- Every shared recording carries a "Mixed with DJ Nexus Pro" end card and a link in the tracklist text (removable for Premium).
- Referral: give 1 month of Premium, get 1 month.
- Pack creators promote their own packs, which brings their audiences.

### 15.6 Metrics

Installs by channel, scan completion rate (onboarding health), first-mix-within-24h rate, trial starts, conversion, pack attach, share rate per recording.

---

## 16. Delivery Roadmap & Team

### 16.1 Team (MVP)

| Role | Count |
|---|---|
| Flutter engineers | 2 |
| C++ audio / DSP engineer | 2 (one Android-focused, one iOS-focused) |
| ML engineer (audio) | 2 |
| Backend engineer | 1 |
| Product designer (UI + motion) | 1 |
| QA (device lab: 15 Android + 6 iOS devices) | 1 |
| PM / founder | 1 |

### 16.2 Milestones

| Month | Milestone |
|---|---|
| 1 | Audio engine spike: 2 decks, stretch, EQ, crossfader at ≤ 20 ms on reference devices. Library scanner. Stretch-library bake-off |
| 2 | Waveforms, beat grid, hot cues, loops, sync. BPM/key/energy models v1 on device. Backend auth + entitlements + master bootstrap |
| 3 | FX, sampler, recording. Genre/emotion models. Smart Queue + auto-playlists |
| 4 | Stems (on-device fast + cloud HQ), Transition Composer, Emergency Mix, Crowd Mode. RevenueCat billing |
| 5 | Pack hub + store, sync, sharing, Set Analyzer. Closed beta |
| 6 | Performance hardening, store review, launch |
| 7–12 | 1.x features: MIDI, AI FX Synthesizer, Vocal Chop Maker, Skill Coach, Smart Sorting, Personality Mode, Storyline Creator |
| 12+ | 2.0 research: Genre Morphing, Mood Converter, Crowd Energy Simulator |

### 16.3 Repository Layout

```
dj-nexus-pro/
├── app/                    # Flutter app
│   ├── lib/features/{decks,library,bot,hub,recordings,settings,auth}/
│   └── lib/core/{entitlements,engine_ffi,db,ml}/
├── engine/                 # C++17 audio engine + CMake, shared by both platforms
│   ├── src/{deck,mixer,fx,sampler,recorder,stretch}/
│   ├── android/ (Oboe host)   ios/ (RemoteIO host)
│   └── tests/ (offline render tests, golden WAV comparisons)
├── server/                 # Fastify API, Postgres migrations, bootstrap scripts
├── ml/                     # training code, see AI_TRAINING_BLUEPRINT.md
└── infra/                  # Terraform, CI
```

### 16.4 Testing Strategy

- **Engine:** offline render tests (deterministic input → golden output within −90 dB), 60-min 4-deck underrun soak test on each reference device in CI device farm.
- **Models:** evaluation gates from the AI blueprint block release if a metric regresses.
- **App:** widget tests, integration tests for scan → analyse → load → play; screenshot tests for all seven main screens.
- **Entitlements:** unit tests for plan resolution, including "tampered token rejected", "reserved username rejected at signup", "master login audited".

---

## 17. Developer Guide: Master Access

### 17.1 Bootstrap (run once, on the server)

```bash
# Prompts for the password without echo; never pass it as an argument or env var.
npm run bootstrap-master -- --username RoshanMaster --email <roshan's email>
```

```ts
// server/scripts/bootstrap-master.ts
import { hash } from '@node-rs/argon2';
import { db } from '../src/db';
import { promptHidden } from './prompt';

const username = argv.username;                     // 'RoshanMaster'
const password = await promptHidden('New master password: ');
if (password.length < 14) throw new Error('Use at least 14 characters.');

await db.tx(async (t) => {
  await t.none(`INSERT INTO reserved_usernames (username) VALUES ($1) ON CONFLICT DO NOTHING`, [username]);
  const user = await t.one(
    `INSERT INTO users (id, username, email, email_verified, password_hash, role)
     VALUES ($1, $2, $3, true, $4, 'MASTER')
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'MASTER'
     RETURNING id`,
    [newUserId(), username, argv.email, await hash(password)],
  );
  await t.none(`INSERT INTO audit_log (user_id, action) VALUES ($1, 'role_change')`, [user.id]);
});
// Also grant a lifetime promotional entitlement in RevenueCat so store UI agrees:
// POST https://api.revenuecat.com/v1/subscribers/{user.id}/entitlements/premium/promotional  { "duration": "lifetime" }
```

### 17.2 Login and Entitlements (server)

```ts
// server/src/services/entitlements.ts
export type Plan = 'MASTER' | 'PREMIUM' | 'FREE';

export function resolvePlan(user: User, subs: Subscription[]): Plan {
  if (user.role === 'MASTER') return 'MASTER';          // role only set by bootstrap/admin
  if (subs.some(isActive)) return 'PREMIUM';
  return 'FREE';
}

const ALL = ['premium', 'decks:4', 'cues:16', 'sampler:unlimited', 'ai:*', 'ai:labs',
             'packs:*', 'sync', 'export:mp3', 'mastering', 'cloud_ai:unlimited'];

export function entitlementsFor(plan: Plan): string[] {
  switch (plan) {
    case 'MASTER':  return ALL;                                   // UnlockAllPremiumFeatures + EnableAllAIModels
    case 'PREMIUM': return ALL.filter((e) => !['ai:labs', 'packs:*', 'cloud_ai:unlimited'].includes(e))
                              .concat('packs:included', 'cloud_ai:60');
    case 'FREE':    return ['decks:2', 'cues:3', 'ai:basic'];
  }
}

export function issueEntitlementToken(user: User, plan: Plan): string {
  return signEd25519({
    sub: user.id,
    plan,
    ent: entitlementsFor(plan),
    subscription_check: plan !== 'MASTER',                        // BypassSubscriptionChecks
    exp: nowSec() + 30 * 24 * 3600,
  });
}
```

```ts
// server/src/routes/auth.ts: POST /auth/login
const user = await users.findByUsernameOrEmail(body.login);
// Always run a hash verify (against a dummy hash if the user is missing) to keep timing constant.
const ok = await verify(user?.password_hash ?? DUMMY_HASH, body.password);
if (!user || !ok) { await limiter.fail(ip, body.login); throw unauthorized(); }
if (user.totp_secret_enc && !verifyTotp(user, body.totp)) throw unauthorized('totp');

const plan = resolvePlan(user, await subs.forUser(user.id));
await audit(user.id, plan === 'MASTER' ? 'master_login' : 'login', { ip, ua });
return { ...issueSessionTokens(user), entitlement: issueEntitlementToken(user, plan) };
```

### 17.3 Client (Flutter)

```dart
// app/lib/core/entitlements/entitlements.dart
class Entitlements {
  Entitlements(this.plan, this._ent, this.subscriptionCheck);
  final String plan;                 // FREE | PREMIUM | MASTER
  final Set<String> _ent;
  final bool subscriptionCheck;

  bool has(String e) =>
      _ent.contains(e) || _ent.contains('${e.split(':').first}:*');

  static Entitlements fromToken(String jwt) {
    final claims = verifyEd25519(jwt, kEntitlementPublicKey); // throws if tampered/expired
    return Entitlements(claims['plan'], Set.from(claims['ent']), claims['subscription_check']);
  }
}

// Usage: gate features, never usernames.
if (!ents.has('ai:stems')) return showPaywall(context, feature: 'stems');
if (ents.subscriptionCheck) await revenueCat.refreshCustomerInfo();   // skipped for MASTER
```

There is deliberately **no** `if (username == ...)` anywhere in the app. Searching the compiled app for "RoshanMaster" or the password finds nothing.

### 17.4 Checklist

- [ ] Choose a new master password (not the one in the brief) and run the bootstrap script.
- [ ] Turn on TOTP for the master account.
- [ ] Store the Ed25519 private key and RevenueCat secret in the secret manager.
- [ ] Confirm sign-up rejects `RoshanMaster`, `roshanmaster` and look-alikes (`R0shanMaster`, Cyrillic "о").
- [ ] Confirm a hand-edited entitlement token is rejected by the app.
- [ ] Confirm master login appears in `audit_log`.
- [ ] Use a separate normal Premium demo account for App Store / Play review.
