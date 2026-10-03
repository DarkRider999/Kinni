# Smart Beginning

An offline-first learning app for children from infancy (Little One Mode) through
age 10 — reading, math, science, creativity, feelings, real-world skills, music,
and a library of 77 nursery rhymes/songs and 24 illustrated stories, guided by six
original characters.

This app did not previously exist in this repository. It was extracted from a
user-supplied APK (`smart-beginning-4.1.apk`, itself originally built in Google
AI Studio) and rebuilt here — the repo's pre-existing `/app` folder is an
unrelated pregnancy-tracker app and was not touched.

## How it's built

The whole app is a single offline-first web page:
`app/src/main/assets/www/index.html` (HTML/CSS/JS, no framework, no build step).
A thin native Android shell (`MainActivity.kt`) wraps it in a full-screen WebView
and bridges two things JS alone can't do inside a WebView:

- **`window.AndroidTTS`** — narration. Android's WebView has no Web Speech API,
  so all spoken text goes through the device's native `TextToSpeech` engine via
  this bridge (`speak(text, lang, pitch, rate)`), with a graceful fallback to the
  device's default language if a requested one has no voice pack installed.
- **`window.AndroidOrientation`** — lets the Music Studio run in landscape (held
  sideways, like a real toy instrument) while every other screen stays portrait.

A handful of fixed, high-frequency narration clips (the alphabet and numbers 1–10)
are instead *real recorded audio* in a single warm, gentle voice (ElevenLabs
"Lauren B"), stored under `assets/www/audio/*.mp3` — see **Voice** below.

## What was fixed

The original build had several dead-end bugs, likely from an incomplete prior
edit:

- **Alphabet Time and Number Time did nothing when tapped.** Their tiles used
  `data-go` ids (`#s-alpha`, `#s-numb`) that didn't match the actual screen ids
  (`#s-act-alpha`, `#s-act-numb`), and the "Early Reading" hub screen they were
  supposed to live in didn't exist at all. All three are now wired correctly,
  and two previously orphaned quizzes ("Sound it out", "Word match") are
  reachable again.
- **Music Studio's Piano and Melody Tunes tabs had no click handler** — only
  Xylophone ever responded. A real tab switcher now drives all five modes
  (Xylophone, Piano, **Drums**, **Sound FX**, Melody tunes — the last two are
  new, replacing a `DRUMS is not defined` crash that fired on every page load
  from dead code for a feature that was never finished).
- **Watch & Learn was a completely empty screen** (`#watchCats`/`#watchList`
  were never populated). It now has six subject categories; tapping an item
  opens a specific, safe YouTube search for that topic in the device's own
  YouTube app — deliberately not a hardcoded video ID (which could be wrong,
  removed, or inappropriate by the time anyone taps it) and not a YouTube Data
  API integration (no API key to manage, no quota).

## Music Studio

Keys are now large, vividly colored/gradiented, and flash + sparkle on tap.
Holding the device in **landscape** (for Xylophone, Piano, Drums, Sound FX)
makes the keys fill the screen, toy-instrument style; `AndroidOrientation`
unlocks landscape only on this screen and locks back to portrait everywhere
else.

## Voice & language

- **Narration** uses the device's TextToSpeech by default, tuned by a
  **Soft 🧸 / Bright ⭐** style toggle (pitch/rate presets) in Parent Zone →
  Settings. "Soft" is the default and aims for the gentler, warmer read that
  was asked for.
- **Languages**: English, Arabic (RTL), **Tamil**, **Kannada** — a toggle in
  Settings switches the UI chrome and narration locale. Lesson *content*
  (rhymes, stories, quizzes) stays in English; only the interface strings and
  the narrator's locale change. The Tamil/Kannada interface translations are a
  first pass and should be reviewed by a native speaker before wide release.
- Tamil/Kannada narration quality depends on the device having that language's
  voice data installed; `AndroidTTS.speak()` falls back to the device's default
  language rather than staying silent if it doesn't.
- The 26 letters (each "A. A is for Apple.", etc.) and the numbers one through
  ten are **real recorded audio** (ElevenLabs, voice "Lauren B" — warm, gentle,
  built for children's narration) rather than device TTS, since these are the
  most-repeated lines in the app. Everything else (quiz questions, rhyme lyrics,
  story pages, body-part names, etc.) uses device TTS, since pre-recording every
  possible spoken string isn't practical.

## Content library

- **77 nursery rhymes, action songs and lullabies** (up from 22) — mostly
  well-known public-domain titles (Pat-a-Cake, Sing a Song of Sixpence, Golden
  Slumbers, ...). Titles without a hand-arranged melody use `autoTune()`, a
  small placeholder-melody generator (a gentle rotating scale sized to each
  line's syllable count) so the sing-along/lyric-highlight feature works for
  all of them without a manual note-by-note transcription per title.
- **24 stories** (up from 10) — public-domain fables and tales (The Ant and the
  Grasshopper, The Gingerbread Man, The Ugly Duckling, ...) plus new stories for
  the app's own characters (Zuzu, Bingo, RoboRex, Mira), and — since the app's
  main character Kinni is named for a real little girl — a personal lullaby and
  two stories written from a photo of her (the pink bow, her bunny, bath time
  with her duck).

## Little One Mode (new)

A passive screen for roughly 0–12 months: high-contrast black/white/red visual
patterns (bullseye, stripes, pinwheel, a simple face, checkerboard, sunburst —
real CSS gradients, chosen because true contrast is what very young eyes can
actually focus on, not colorful emoji) auto-cycle every few seconds, with an
optional looping lullaby. Nothing needs to be tapped — a parent just holds the
device up. Reachable from Home → "Little One Mode", and age range in Parent
Zone now goes down to 0 ("under 1") instead of starting at 2.

## New activities

- **Memory Match** (Creative Studio) — a 6-pair flip-card matching game.
- **My Body** (Real-World Skills) — tap a body part (hair, eyes, nose, mouth,
  ears, tummy, hands, feet) to hear its name and collect a star for each.

## Building this project

**This has not been compiled** — there is no Android SDK available in the
environment this was built in, only a plain JDK. The web app itself was
verified headlessly with Playwright (all 34 screens and all 87 interactive
elements click through with zero console/page errors); the native shell
(`MainActivity.kt`) is standard, well-established WebView + TextToSpeech
boilerplate but has not been test-compiled.

To build:
```
cd smart-beginning
./gradlew assembleDebug
```
You'll need the Android SDK installed and `ANDROID_HOME`/`local.properties`
pointing at it, same as any Android Studio project. Open the `smart-beginning/`
folder directly in Android Studio and it should sync normally.

## Known gaps / honest limitations

- Tamil and Kannada interface text is a first machine-assisted translation
  pass, not reviewed by a native speaker.
- Watch & Learn opens YouTube search results, not curated/verified videos —
  it says so in-app, but a grown-up should still watch alongside a child there,
  same as the original build intended.
- `autoTune()`-generated melodies are pleasant placeholders, not transcriptions
  of the real traditional tunes, for the rhymes added in this pass.
