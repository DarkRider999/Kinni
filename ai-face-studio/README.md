# AI Face Studio — working app slice

Full product/engineering spec: [`docs/ai-face-studio/SPEC.md`](../docs/ai-face-studio/SPEC.md).

This folder is a **real, running build** of the app's Phase 1–2 slice (core navigation, auth-free demo
session, Home, Tools, Upload, Editor, AI Creator, Projects, Profile, Owner dashboard — see the Build Roadmap
in the spec, §18), with every AI tool wired to a **mock provider** instead of a real model.

## What's real vs. mocked

| Real (actually runs) | Mocked (clearly labeled, swap-in point documented) |
|---|---|
| Photo upload (drag/drop, file picker, camera capture on mobile), multi-file batch upload, client-side validation | The AI transform itself — `lib/aiProvider.ts` implements the `AIProvider` interface from SPEC §8.3 with a `MockLocalProvider` that runs real `<canvas>` pixel operations (filters, blending) so a result is genuinely produced and genuinely different per tool/params — but it is **not** a real face-swap/generative model |
| Smart Edit Locks, Identity Strength slider, style/color pickers — all drive the mock transform's parameters | Quality Control gate — the pass/fail check is simulated (toggle "Simulate QC failure" in dev), not a real face/eye/teeth artifact detector |
| Projects history (localStorage), batch queue with pause/resume/retry, ZIP export of a batch | AI Creator's prompt → edit-plan compiler is a small keyword matcher, not an LLM call (SPEC §5.2 describes the real version) |
| Face Shape / Symmetry / Lighting / Quality "analysis" tools — these compute real heuristics from the uploaded image's pixel data (brightness, left/right symmetry diff, resolution/aspect ratio) | The analysis is a placeholder heuristic, not the real computer-vision model SPEC §21 describes |
| Owner/Unlimited-mode toggle, gated by `NEXT_PUBLIC_OWNER_EMAIL` | This is a **client-side demo gate only** — anyone can read client JS, so it proves nothing about security. Real entitlement must be verified server-side per SPEC §15. No password or real email is committed to this repo. |

Video Studio tools and Multi-Face Swap are shown **disabled** ("requires a connected model") rather than
faking a result, per the brief's own rule: never silently do nothing and call it AI processing.

## Upload-point audit (why every tool below has an explicit Upload step)

Before this build, the earlier screen mockups jumped straight from "pick a tool" to an already-loaded sample
photo. That skipped the step every real tool needs. This build adds one generic, reusable Upload step
(`components/UploadDropzone.tsx` + `pages/upload/[tool].tsx`) used by every editing and analysis tool, and
applies upload rules per tool kind:

- **Single-photo tools** (Face Swap, Hairstyle Changer, Makeup, Background Changer, Photo Enhancer, …): one
  upload, required, consent notice shown first.
- **Batch Face Swap**: multi-file upload (up to 20 in this slice), queued and processed independently.
- **Create My Character**: upload once, saved as a reusable `Character` profile; every later tool's Upload
  step offers "Use a saved character" instead of re-uploading.
- **AI Creator**: requires a photo too (it edits a photo, same as any other tool) — the earlier mockup let
  you type a prompt with no image, which is a gap this build closes.
- **Multi Face Swap**: upload *is* allowed, but generation is disabled with "requires server-side multi-face
  detection" — real per-person face mapping cannot be faked client-side.
- **Video Studio tools**: upload is **not** offered at all — there is no model to send the file to yet
  (SPEC §11 is interfaces-only), so the UI says so instead of inviting an upload that goes nowhere.

## Run it

```bash
cd ai-face-studio/web
npm install
cp .env.example .env.local   # optional — only needed to try the Owner dashboard locally
npm run dev
```

## Installing it today: the deployed PWA

The web app is deployed at **https://ai-face-studio.vercel.app** (Vercel project `ai-face-studio`, built
from this repo's `claude/ai-face-studio-build-wbx9ya` branch). It's a installable PWA (`public/manifest.webmanifest`
+ `public/sw.js`): open it in Chrome on Android and use **⋮ menu → Install app** to get a real home-screen
app (a WebAPK) with no build step. That's the fastest way to try the app on a phone.

## Building a real `.apk`: the Capacitor Android project

`android/` is a real native Android/Gradle project, generated with the Capacitor CLI (`npx cap add android`)
and synced to this app's static export — not a hand-written stub. It was **scaffolded but not built** here:
this sandbox has no Android SDK, and `dl.google.com` (Google's Maven repo, which serves the Android Gradle
Plugin itself, not just SDK platform packages) is blocked by this environment's network policy — confirmed
directly: `./gradlew tasks` fails with `403 Forbidden` from `dl.google.com/dl/android/maven2/...` even before
it gets to needing an installed SDK. Nothing about the project is unfinished because of that — it just needs
to be built somewhere with normal access to Google's Maven repo.

**One codebase, two build targets** (`next.config.js`):
- The default `next build` (used by the Vercel deployment above) is a normal server build.
- `npm run build:capacitor` sets `BUILD_TARGET=capacitor`, which switches `next.config.js` to
  `output: 'export'` — a fully static export into `out/`, because `output: 'export'` can't use
  `headers()`/server features, and Capacitor needs local files to bundle (no live server at runtime).
  `pages/upload/[tool].tsx` and `pages/editor/[tool].tsx` carry `getStaticPaths` over every tool id
  (`lib/tools.ts`) so all 32 tool screens pre-render to their own static HTML file — verified: the export
  produces 73 HTML files, including `/upload/<tool-id>.html` and `/editor/<tool-id>.html` for every tool.

### To build the APK on a machine with Android Studio / the Android SDK

```bash
cd ai-face-studio/web
npm install
npm run cap:sync          # builds the static export, then `cap sync android`
cd android
./gradlew assembleDebug   # needs Android SDK + internet access to dl.google.com, which this sandbox lacks
```

The debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk` — installable by sideloading
(`adb install app-debug.apk`) or sending the file directly. Or skip the CLI and run `npm run android:open`
to open the project in Android Studio and hit Run.

That produces a **debug-signed** APK (fine for sideloading/testing, not for the Play Store). A Play Store
release needs a release keystore and `./gradlew bundleRelease` (produces an `.aab`) — out of scope until
there's an actual release to ship.

### What's already set up

- **App identity**: `com.splitfireproduction.aifacestudio`, app name "AI Face Studio" (`android/app/src/main/res/values/strings.xml`).
- **Brand icons & splash**: generated with `@capacitor/assets` from `resources/icon.png` / `resources/splash.png`
  (the same sparkle mark used across the app) into every Android density bucket, adaptive icon included, plus
  light/dark and portrait/landscape splash variants — 100 files, `npm run cap:assets` to regenerate if the
  source art changes.
- **Brand color overrides** (`android/app/src/main/res/values/colors.xml`): the app module overrides
  `capacitor-android`'s Material-default indigo/pink `colorPrimary`/`colorAccent` with the actual brand
  purple/cyan.
- **`INTERNET` permission** is present (for the Google Fonts `<link>` and any future real AI API calls);
  nothing else is requested.
- `android/app/src/main/assets/public` (the copied web build) and all Gradle/IDE build output are
  gitignored — regenerate with `npm run cap:sync` after pulling, don't expect them to already be there.
