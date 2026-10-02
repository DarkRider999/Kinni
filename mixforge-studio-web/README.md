# MixForge Studio (web)

A real, working browser preview of MixForge Studio: an **AI Beat Generator** (genre-conditioned step
sequencer), a **Melody & Bassline Creator** (scale-locked piano roll), a **2-deck DJ Mixer** (neon waveforms,
auto-sync, filter/echo FX, crossfader, recording), a **Sample Library** (drag-and-drop one-shot kit) and
**One-Tap Mastering** (a real deterministic EQ/compressor/limiter chain) — all running on the Web Audio API
in this tab, not a simulation. See [`docs/mixforge-studio/SPEC.md`](../docs/mixforge-studio/SPEC.md) for the
full product blueprint and what of it this build does and doesn't implement (short version: the pattern
generation, audio engine, DJ mixer and mastering chain are real; a trained generative model, licensed 10,000+
sample catalog, AI stem separation, Auto Remix, cloud sync and accounts are not — they need GPU training
infrastructure, licensed content, and a deployed backend this environment doesn't have).

## Running it

```bash
npm install
npm run dev       # dev server with hot reload
# or
npm run build && npm run preview   # production build, served statically
```

## Getting a real .apk

This environment has no Android SDK and network policy blocks downloading one (confirmed:
`dl.google.com`/`android.clients.google.com` are rejected by the egress proxy), so the APK can't be built or
tested from inside this session. Instead, **[`.github/workflows/mixforge-studio-android.yml`](../.github/workflows/mixforge-studio-android.yml)**
builds it on GitHub's own Ubuntu runners, which do ship the Android SDK: on every push that touches
`mixforge-studio-web/**` it runs the unit tests, builds the web app, wraps it with
[Capacitor](https://capacitorjs.com/) (`android/` — a thin native WebView shell around the same `dist/` build,
added via `npx cap add android`), runs `./gradlew assembleDebug`, uploads the resulting debug APK as a build
artifact, and attaches it to a `mixforge-studio-apk-<run_number>` GitHub Release for a stable download link.
It's a debug-signed build meant for sideloading (enable "install unknown apps" for your browser/file manager
when installing it), not a Play Store release.

To build it yourself instead: `npm ci && npm run build && npx cap sync android && cd android && ./gradlew
assembleDebug` on a machine with the Android SDK (e.g. via Android Studio).

## Installing it on a phone without an .apk

Independent of the native build above, this is also an installable **Progressive Web App**: deploy the
`dist/` build to any HTTPS host (GitHub Pages, Vercel, Netlify, etc. — localhost also works for testing), open
it in Chrome on Android or Safari on iOS, and use **"Install app"** / **"Add to Home Screen."** It then
launches full-screen with its own icon, independent of the browser chrome, and the service worker lets it
reopen without a network connection (after at least one successful online visit).

- `public/manifest.webmanifest` — name, icons, `display: standalone`, theme/background color.
- `public/service-worker.js` — a minimal network-first-with-cache-fallback worker (no Workbox/build-time
  precache list, since Vite's output filenames are content-hashed per build).
- `public/icon-192.png` / `icon-512.png` — generated from `public/icon-source.svg` (rendered to PNG via a
  headless-Chromium screenshot, since this environment's ImageMagick has no `rsvg-convert` delegate).
- The e2e smoke test (`npm run e2e`) asserts the manifest serves, both icon sizes return `200`, and the
  service worker reaches the `active` state — the concrete conditions Chrome checks before offering
  "Install app."

Open the printed URL and click **Enter the Studio** (browsers require a user gesture before audio can start).
Everything runs locally in the tab — nothing is uploaded anywhere.

## What's real here (and what it stands in for)

| Spec feature (`docs/mixforge-studio/SPEC.md`) | This build | Honest gap vs. the full spec |
|---|---|---|
| §2A AI Beat Generator | **Real**: a genre-conditioned, seeded procedural pattern generator (`src/lib/beatPatterns.ts`) across 7 genre templates, editable 7-lane x 16-step grid, energy-weighted fills | Rule-based templates, not a trained sequence model — the spec's `/generateBeat` cloud endpoint (§6) is the real target architecture; training a generative model needs GPU infrastructure and training data this environment doesn't have |
| §2B Melody & Bassline Creator | **Real**: scale-constrained note generation (`src/lib/melodyPatterns.ts`, 5 scales), a playable piano roll, "regenerate this half" | Same honesty note as the beat generator — procedural, not a trained model. Every note is still guaranteed in-key, which is the product's core promise |
| §2D DJ Mixer | **Real**: two decks (`src/engine/deck.ts`), GPU-rendered-looking canvas waveforms, equal-power crossfader, filter + echo FX, BPM auto-sync (playback-rate matching against a known/entered BPM), MediaRecorder-based set recording | No automatic BPM/key *detection* on imported files (SPEC §3.11-equivalent) — generated beats carry an exact known BPM; an imported file needs its BPM entered, it isn't analyzed |
| §2G One-Tap Mastering | **Real**: a deterministic `OfflineAudioContext` chain — low/high shelf EQ, compressor, limiter (`src/engine/mastering.ts`), 3 genre-flavored presets, WAV export | Preset *parameters* are a fixed lookup table rather than an AI-selected set per the spec's cloud job (§6 `/masterTrack`) — same "deterministic chain, AI picks the knobs" split as the spec, just with a rule-based parameter table instead of a trained model |
| §2F Sample Library (10,000+) | **Real UX**: genre/mood filtering, click-to-preview, drag-and-drop onto a Beat Generator lane to swap its sound | Only 8 procedurally synthesized placeholder one-shots (`src/engine/synthKit.ts`), not the licensed 10,000+ catalog |
| §2C Stem Lab (AI stem separation) | **Not implemented** | Needs a trained source-separation model (Demucs-style) and GPU inference — not available here |
| §2E Auto Remix Mode | **Not implemented** | Depends on Stem Lab + an AI remix-orchestration job; not buildable without the above |
| §2H Cloud Sync, §11 accounts/master access | **Not implemented** | Needs a deployed backend, database and auth — this is a static client-only build |

## Architecture

- `src/engine/context.ts` — a single shared `AudioContext`, resumed on the "Enter the Studio" gesture
  (autoplay policy).
- `src/engine/synthKit.ts` — the procedurally synthesized placeholder one-shot kit (kick/snare/clap/hats/
  bass/rim/stab), baked to `AudioBuffer`s once via `OfflineAudioContext` and reused everywhere.
- `src/engine/scheduler.ts` — a lookahead step scheduler (the standard "look ahead, schedule against
  `AudioContext.currentTime`" pattern) shared by the Beat Generator and Melody Creator.
- `src/engine/deck.ts` — a DJ-mixer deck: gain → filter → dry/echo-send → output, with BPM-ratio
  playback-rate sync.
- `src/engine/mastering.ts` — the One-Tap Mastering DSP chain and a generic `renderMix` bounce helper
  (step pattern → single stereo buffer) shared by the Beat Generator's export flow and the DJ Mixer's
  "load a generated beat to a deck" flow.
- `src/lib/beatPatterns.ts`, `src/lib/melodyPatterns.ts` — pure, seeded, unit-tested generation logic (no
  `AudioContext` dependency, so it's testable under Vitest/jsdom).
- `src/lib/mixerMath.ts` — the equal-power crossfade curve, also pure/tested.
- `src/lib/wav.ts` — a minimal PCM16 WAV encoder for the Export flow.
- `src/state/store.tsx` — a small React context holding the loaded sample kit and the session's saved
  beats/melodies (what "Keep & Send to Project" writes to, and what the DJ Mixer's deck-load dropdown reads
  from). In-memory only in this build; the full spec's Project Workspace/Cloud Sync persists this server-side.

## Tests

```bash
npm run test   # Vitest: pattern generators, scale/frequency math, crossfade curve, WAV encoder
npm run e2e    # builds, serves, and drives a real headless Chromium through the whole app
```

The e2e script (`scripts/e2e-smoke.mjs`) generates a beat, plays it, generates a melody, saves the beat to the
project, loads it into a DJ deck, plays and crossfades it, and previews a sample from the library — end to
end, in a real browser, with console-error assertions.
