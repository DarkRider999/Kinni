# SplitFire Production

Neon-themed DJ motion-graphics and branding studio for **DJAY RadicalMix**. Generates intros, transitions, posters, reels and motion graphics from a single cross-platform (Android + iOS) codebase. Tagline: **Mix Beyond Reality**.

```
splitfire-production/
└── app/                         Expo (React Native + TypeScript) app — Android & iOS
    ├── src/
    │   ├── app/                 Expo Router routes (file-based navigation)
    │   │   ├── index.tsx            Splash screen
    │   │   ├── home.tsx             Home dashboard
    │   │   ├── motion-pack/         Motion Pack categories + per-category item list
    │   │   ├── create/[type].tsx    Quick actions: Create Intro / Poster / Reel
    │   │   ├── preview/[itemId].tsx Animation Preview (Generate / Download / Add to Project)
    │   │   ├── editor/[itemId].tsx  Editor (timeline, color picker, glow/particles, beat sync)
    │   │   ├── export/[itemId].tsx  Export (resolution, format, loop, neon enhance, download)
    │   │   └── brand-kit.tsx        Brand Kit (logo pack, palette, type, motion samples)
    │   ├── components/          Reusable neon UI kit + MotionStagePreview (the live render stage)
    │   ├── data/                 Motion catalog (6 categories, 18 items) + brand kit data
    │   ├── services/             generationService + exportService (pluggable providers)
    │   ├── state/                 ProjectStore (React context) — per-item config, library
    │   └── theme/                 Colors, type scale, spacing tokens
    └── assets/                    App icon, splash, adaptive icon layers, brand logo & hero art
```

## What's real vs. what's a hook for later

Every screen, control and navigation flow in this app is fully wired and functional today:

- **SplitFire Motion Engine** — the `MotionStagePreview` component is a real-time, on-device
  procedural renderer (not a static mock) that drives every live preview, the editor stage and
  the export frame from the active color / glow intensity / particle density / beat-sync config.
  Scrub the timeline, change colors, toggle beat sync — the stage updates live.
- **Generate** runs through `services/generationService.ts`, a provider-based pipeline. The
  shipped `LocalMotionEngineProvider` renders instantly (it's procedural); the interface is ready
  to swap in a cloud AI video model later without touching any screen.
- **Download / Export** runs a staged render pipeline (`services/exportService.ts`), then captures
  the live stage at full resolution via `react-native-view-shot` and saves it to the device photo
  library (`expo-media-library`) or shares it (`expo-sharing`) — a genuine on-device artifact today.
  Full MP4/MOV video encoding is the next milestone once a render backend is connected (see
  `docs/splitfire-production/SPEC.md`).
- **Add to Project** persists to a library list via `AsyncStorage`.

## Build & run

This app uses native modules (`expo-router`, `react-native-view-shot`, `expo-media-library`,
`react-native-reanimated`, …), so it needs a **development build** — Expo Go alone won't load it.

```bash
cd splitfire-production/app
npm install

# iOS (macOS + Xcode required)
npx expo run:ios

# Android (Android Studio / SDK required)
npx expo run:android

# Or build in the cloud with EAS (no local Xcode/Android Studio needed)
npx eas-cli@latest build --platform all --profile development
```

Useful scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npx expo-doctor     # dependency/config health check
```

## Brand

- **Logo**: glossy red "R" integrated with headphones (`assets/brand-logo-square.png`) — used as
  the app icon, adaptive icon foreground, and primary mark throughout the UI.
- **Hero art**: DJ hologram silhouette behind the ring-and-R mark (`assets/brand-hero.png`) — used
  for the native boot splash and the Brand Kit screen.
- **Palette**: Radical Red `#FF1B4B`, Hologram Blue `#1BE7FF`, SplitFire Purple `#B01BFF` on a
  near-black `#05010A` stage — see `src/theme/colors.ts` and the in-app Brand Kit screen.

Full product spec: [`docs/splitfire-production/SPEC.md`](../docs/splitfire-production/SPEC.md).
