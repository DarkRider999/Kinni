# SplitFire Production — Product & Technical Spec

> Neon-themed DJ motion-graphics and branding app for DJAY RadicalMix
> Platforms: Android + iOS (single Expo/React Native codebase) · Status: MVP implemented

---

## 1. Product summary

| Item | Value |
|---|---|
| Brand | DJAY RadicalMix |
| Studio | SplitFire Production |
| Tagline | Mix Beyond Reality |
| Platforms | Android, iOS (Expo / React Native, TypeScript) |
| Core value | Generate on-brand intros, transitions, posters, reels and motion graphics, edit them live, export them |

### Core brand elements

- Glossy red **R** integrated with headphones
- Neon ring — red / blue / purple
- DJ hologram silhouette
- Sparks, particles, pulses over a near-black stage

These are implemented as real assets (`assets/brand-logo-square.png`, `assets/brand-hero.png`,
derived app icon / adaptive icon / splash variants) and as a live procedural renderer (see §4).

---

## 2. Screens

### 2.1 Splash Screen (`src/app/index.tsx`)
Full-screen neon gradient stage, the pulsing glossy-R logo (`PulsingLogo`, breathing red/purple
ring halos via `Animated` loops), brand name + tagline fade-in, auto-advances to Home after
~2.6s.

### 2.2 Home Dashboard (`src/app/home.tsx`)
Three main neon gradient tiles — **Motion Pack**, **Transitions**, **Background Loops** — each
routes into the Motion Pack module (the latter two deep-link straight into their category).
Quick actions row — **Create Intro**, **Create Poster**, **Create Reel** — routes to
`create/[type]`, a filtered template picker for that quick-start flow. A top-right icon opens the
Brand Kit.

### 2.3 Motion Pack module (`src/app/motion-pack/`)
- `index.tsx`: grid of the six categories — Logo Animations, Transitions, Background Loops, Text
  Animations, Event Visuals, Overlay FX — each with an icon, gradient, description and item count.
- `[category].tsx`: item list for a category; each row shows a live-rendered thumbnail, title,
  description, duration/loop label and beat-sync badge, and opens the Animation Preview.

The catalog (`src/data/motionCatalog.ts`) ships 18 items across the six categories (16 video,
3 poster-kind — event visuals includes poster templates for lineup/date-reveal cards).

### 2.4 Animation Preview screen (`src/app/preview/[itemId].tsx`)
- Live video-style preview window (`MotionStagePreview`, playing) with a progress overlay during
  generation and a "Generated" badge once complete.
- Description panel: title, description, tags, duration, category, beat-sync indicator.
- **Generate** — runs `services/generationService.ts`.
- **Download** — routes into the Export screen (requires a completed generation).
- **Add to Project** — persists the item into the user's library (`AsyncStorage`).
- A header shortcut opens the Editor for fine control.

### 2.5 Editor screen (`src/app/editor/[itemId].tsx`)
- **Timeline scrubber** — drags the stage's render phase (0–100%); scrubbing pauses live
  playback and freezes the procedural stage at that exact frame. A play/pause toggle resumes the
  loop.
- **Neon color picker** — primary + secondary swatch rows (Radical Red / SplitFire Purple /
  Hologram Blue / Stage White), live-applied to the stage.
- **Glow intensity slider** (0–100) and **particle density slider** (0–100).
- **Beat sync toggle** — when on, reveals a BPM slider (60–190) and the stage's loop timing locks
  to that tempo.
- **Export options** — format chips (MP4/MOV) and a loop toggle, pre-filled into the Export
  screen's config; a "Continue to Export" button opens it.

### 2.6 Export screen (`src/app/export/[itemId].tsx`)
- Resolution selector (1080p / 4K), format selector (MP4 / MOV), Loop toggle, Neon enhancement
  toggle (boosts glow/bloom on the rendered frame).
- **Download** runs a staged render/encode progress UI, captures the live stage at full
  resolution, and saves it to the device photo library (or shares it where photo-library access
  isn't available), with a result banner confirming resolution/format/loop and where it landed.

### 2.7 Brand Kit screen (`src/app/brand-kit.tsx`)
- **Logo pack** — the primary square mark and the full hologram hero artwork, each with usage
  notes.
- **Color palette** — the neon trio plus stage neutrals, with hex values and roles.
- **Typography** — the live type scale (display/heading/tagline/body) rendered at actual weights.
- **Motion** — four live procedural presets (logo pulse, ring sweep, particle burst, beat strobe)
  rendered via the same stage engine used everywhere else in the app.

---

## 3. Architecture

- **Framework**: Expo SDK 57, React Native 0.86, React 19, TypeScript (strict), Expo Router 57
  (file-based routing under `src/app/`, per this project's own `AGENTS.md` convention).
- **State**: a single React Context + `useReducer` store (`src/state/projectStore.tsx`) holding,
  per catalog item: its live `ProjectConfig` (colors, glow, particles, beat sync, BPM, timeline
  phase), its `GeneratedAsset` status/progress, its `ExportConfig`, plus a persisted "library" of
  items the user added to their project (`AsyncStorage`).
- **Rendering**: `src/components/MotionStagePreview.tsx` is the shared stage used by list
  thumbnails, the Preview screen, the Editor, the Export screen and the Brand Kit — one real,
  configurable renderer, not six different mocks. It implements six pattern families (pulse
  rings, sweep, burst, scanlines, strobe, typewriter) driven by an `Animated.Value` phase that
  either free-loops or locks to BPM.
- **Generation pipeline**: `src/services/generationService.ts` defines a `GenerationProvider`
  interface. The shipped `LocalMotionEngineProvider` commits the current config as the item's
  render recipe (genuinely instant, since the stage is procedural) with a staged progress
  animation matching real render-pipeline UX. Swap in a cloud AI video backend by implementing the
  same interface and calling `configureGenerationProvider()` — no screen changes required.
- **Export pipeline**: `src/services/exportService.ts` simulates the render/encode stages for the
  chosen resolution/format, then captures the live stage via `react-native-view-shot` and saves
  via `expo-media-library` / shares via `expo-sharing`. Full MP4/MOV encoding is a native/cloud
  render-farm concern — tracked as the next backend milestone (§6).

---

## 4. The SplitFire Motion Engine (what "AI generation" means in this build)

There is no bundled ML model. The in-app "generation" is a real-time procedural animation engine
that renders every category from the same small parameter set (primary/secondary neon color, glow
intensity, particle density, beat sync + BPM, timeline phase). This is intentional and disclosed
here for whoever maintains this codebase next:

- It means every feature in the spec is **actually functional today** — Generate, scrub, recolor,
  and export all produce a real, different result, with no placeholder video files required.
- It is architected so a real AI video-generation backend (diffusion video model, a
  Runway/Pika-style API, or a server render farm) can be dropped in behind
  `GenerationProvider` / the export pipeline later without changing any screen.

---

## 5. Brand assets

| Asset | Source | Used for |
|---|---|---|
| `assets/brand-logo-square.png` | Supplied square R+headphones logo | App icon, adaptive icon foreground, in-app logo badge, Brand Kit |
| `assets/brand-hero.png` | Supplied DJ hologram poster artwork | Native splash image, Brand Kit hero card |
| `assets/icon.png`, `favicon.png`, `splash-icon.png`, `android-icon-*.png` | Derived from the square logo via ImageMagick | Store icon, web favicon, splash, Android adaptive icon layers |

---

## 6. Known limitations / roadmap

- **Video encoding**: exports currently save a high-resolution PNG frame of the live stage, not an
  encoded MP4/MOV file. Wire a native or cloud video encoder behind `exportService.ts` to produce
  real video files; the UI (resolution/format/loop/neon-enhance) is already built to drive it.
  (This also follows from the design in §4: true "generated" video, as opposed to a snapshot of
  the procedural stage, is where a cloud AI video backend would plug in.)
- **Cloud AI generation**: swap `LocalMotionEngineProvider` for a real provider implementing
  `GenerationProvider` when a backend is available.
- **Accounts/cloud sync**: out of scope for this MVP; the project library is local
  (`AsyncStorage`) only.
- Native modules (`expo-router`, `react-native-view-shot`, `expo-media-library`,
  `react-native-reanimated`, etc.) mean the app needs a development build — Expo Go alone cannot
  run it. See `splitfire-production/README.md` for build commands.
