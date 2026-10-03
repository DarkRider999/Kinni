# Smart Beginning

An offline-first learning app for children from infancy (Little One Mode) through
age 10 — reading, math, science, creativity, feelings, real-world skills, music,
and a library of 77 nursery rhymes/songs and 32 illustrated stories, guided by six
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
- **`window.AndroidVault`** — Parent Zone → Family Photos (see below): camera
  capture, a private gallery, and handing a file to Android's own share sheet.

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
- **Build a Word** (Early Reading) — an Endless Alphabet-style word builder:
  16 picture words (CAT, DOG, FROG, STAR…), tiles are always the target
  word's own letters shuffled, and a wrong tap just bounces back harmlessly.
  There is no fail state, only progress — tap in order and the word locks in
  letter by letter until Kinni says the whole word aloud.
- **Animal Peekaboo** (Science & Discovery) — a Peekaboo-Barn-style grid of
  10 doors; tapping one reveals an animal with its sound ("Moo! I am a
  cow."), spoken aloud. Pure tap-and-reveal cause-and-effect play, aimed at
  the youngest end of the 1 month–5 year range where toddlers are still
  learning that their own actions change what they see and hear.
- **Shape Sorter** (Colours & 3D Shapes) — 8 rounds of "which outline
  matches this shape", reusing the colour/shape vocabulary already taught
  there (circle, square, triangle, star, heart, diamond).
- **Bubble Pop Counting** (Math Adventures) — pop a random 4–8 bubbles one
  at a time; each pop is spoken as the running count, and the round ends
  with the total said aloud — built for the littlest counters, no reading
  required.

These four were chosen after researching what the best-rated kids' apps
(Khan Academy Kids, Endless Alphabet, Sago Mini, Lingokids, Peekaboo Barn)
lean on most: finger/tap tracing and fine-motor practice (the app already
had this — see "Trace it" under Alphabet Time), drag-free zero-fail word
building, tap-and-reveal cause-and-effect for infants and young toddlers,
and shape/pattern sorting as early geometry. All four reuse the app's
existing visual language (`.ltile`, `.memgrid`/`.memcard`, `.gsopts`,
`.sboard`) and reward system (`addXP`, `unlockSticker`) rather than
introducing new UI patterns.

## More interactive activities (round 2)

- **Animal & Bird Sounds** (Science & Discovery) — unlike Peekaboo, this is a
  plain reference soundboard, no reveal mechanic: 24 animals and birds across
  three category tabs (Farm & Pets, Birds, Wild), tap any picture any time to
  hear it, sorted into real **Birds** as its own category per request.
- **Colouring Book** (Creative Studio, and from Parent Zone → Printables) —
  the old "Printables" buttons only ever showed a fake "queued for the weekly
  PDF" toast; there is no printer in a sandboxed WebView, so they now open a
  real in-app colouring page instead. Four simple line-art pictures (a letter,
  a number, a happy face, a camel) are drawn procedurally on a canvas — no
  image files needed — and a child picks a colour pencil from an 8-colour
  palette and draws right over the outline, same free-draw mechanic as the
  Drawing Pad.
- **Odd One Out** (Math Adventures) — a classic toddler cognitive-sorting
  game: 4 pictures, 3 share a category, tap the one that doesn't belong.
- **Music Studio key volume** — a slider now controls how loud the
  xylophone/piano/drum/sound-FX taps are (separate from the master sound
  on/off toggle), saved across sessions.
- **8 more stories** (24 → 32): The Three Billy Goats Gruff, Town Mouse and
  Country Mouse, The Fox and the Grapes, The North Wind and the Sun, Stone
  Soup, The Little Red Hen, The Princess and the Pea, and a fifth original
  Kinni story, "Kinni and the Rainy Window".
- **Softer, slower alphabet voice** — the "soft" voice style (the default) is
  now noticeably slower and lower-pitched. The 26 letters and 10 numbers are
  real recorded clips, not device TTS, so they can't follow a speech-rate
  setting; instead the clip itself now plays back at 0.84x speed with pitch
  allowed to drop with it, for a gentler toddler-appropriate read.

## Navigation restructure + deeper polish (round 5)

- **New "Sounds" tab replaces "Rewards" in the bottom nav.** It's a hub that
  consolidates Music Studio, Animal & Bird Sounds, and Animal Peekaboo - "all
  music instruments and animal/bird sounds in one place," per request. Those
  three screens' back buttons now return to the Sounds hub instead of their
  old homes (Home and Science & Discovery), and were removed from those old
  locations so there's exactly one way to reach each - no stale duplicate
  entry points with inconsistent back-navigation. The Science hub leaves a
  one-line pointer to the new location for anyone used to the old spot.
  Rewards (XP, streak, sticker book, badge shelf) didn't move - it's no
  longer a tab, but a "View stickers & badges" link on the Home screen's XP
  card still reaches it, now with its own back button since it can't rely on
  tab-bar navigation anymore.
- **Floating pill-style bottom nav** with a gradient active-tab highlight and
  a lift/shadow, replacing the previous flat tab strip.
- **Decorative floating rainbow shapes** in the background (CSS-only,
  `aria-hidden`, respects `prefers-reduced-motion`) for extra visual richness
  consistent with the new palette, without touching any screen's actual
  layout or content.
- **Re-verified the two things most recently in question:**
  - *Rhymes actually playing*: checked all 77 rhymes' note data statically
    (2,396 notes total, zero with an undefined frequency), then dynamically
    played a sample through the real `playRhyme()` path and counted actual
    `_playNote()` calls against expected - full matches (e.g. 42/42, 33/33).
  - *Camera/Family Photos*: re-read the whole native implementation and
    hardened one real gap - some camera apps (a known Android
    fragmentation issue) report success without actually writing the output
    file. `onActivityResult` now also checks the file exists and is
    non-empty before treating a capture as successful, instead of leaving a
    broken entry in the gallery.

## Honest progress reporting (round 6)

A sharp catch from testing: the Parent Zone progress dashboard showed
numbers on a completely fresh, never-used install. Traced it to four
separate places quietly faking "already in progress" data:

- **8 badges, 4 pre-unlocked.** `BADGES` had `got:true` hardcoded on half
  the shelf regardless of whether the child had done anything. All 8 now
  start `got:false`; a few unlock from a real signal (finishing a story,
  hearing every animal/bird) and the rest stay honestly locked until there's
  real tracking behind them, rather than faking a condition we can't check.
- **6 stickers, pre-filled.** The `STICKERS` array shipped with 6 of its 24
  slots already filled in. All 24 now start `null` (locked) on a fresh
  install.
- **The Home screen's sticker count never moved.** `unlockSticker()` updated
  a separate array for the Rewards screen but never touched `state.stickers`
  — the "⭐ 0 stickers" chip on Home was permanently stuck at 0 no matter how
  many stickers got earned. It now updates `state.stickers` and the Home
  chip live, in the same place a sticker is actually unlocked.
- **The whole Parent Zone report card was sample data** — fake 82%/74%/66%/
  90% category bars, a fake "4 sessions · 96 min," fabricated strengths/
  weaknesses text, and a fake "AI weekly plan," all shown regardless of
  actual use (with only a small "(sample data)" caption admitting it). It's
  replaced with an honest two-state card: "No activities completed yet"
  until the child does something real, then a plain summary built from
  actual state — current level and XP, stickers really earned, and a
  "still practicing" list pulled from the same weak-letter/weak-number
  tracking the alphabet and counting games already use internally. No
  invented percentages, no fake session counts, no fabricated AI plan.

Verified with a Playwright test that checks a fresh install shows zero
badges/stickers and the honest empty-state dashboard, then simulates real
XP and a real sticker unlock and confirms the dashboard, Rewards screen,
and Home chip all switch to consistent, true numbers.

## Playful rainbow redesign (round 4)

The app's colour system is built from 7 reusable CSS custom-property tokens
(`--lumi` blue, `--mint` green, `--blush` pink, `--butter` gold, `--lav`
purple, `--teal` cyan, `--coral` orange) referenced throughout the stylesheet,
plus a large number of pre-computed light tints and dark variants hardcoded
as literal hex values in inline styles (icon chips, card gradients) -
apparently baked in from the original design tool rather than using `var()`
everywhere. That meant a full re-theme was a bulk, file-wide hex substitution
(every token's base/dark/light value, consistently, everywhere it appears)
rather than hundreds of one-off edits - safe to do globally because `#` never
appears inside the base64-encoded image/audio data also embedded in this
file, so there was no risk of a substitution touching binary content.

What changed:
- Every token pushed from soft pastel toward a distinct, saturated hue -
  same 7 colour families, much bolder.
- The 6 subject-area tile gradients (Reading/Math/Create/Science/Feel/Life)
  went from barely-distinguishable light tints to genuinely different vivid
  colours, so "which section is this" is readable at a glance.
- The page background changed from a flat blue/lavender wash to a bright
  near-white canvas with a hint of all four corner colours - the intent
  being that the *accents* (buttons, tiles, icons, progress bars) carry the
  rainbow identity, not the backdrop itself, which stays out of the way of
  readability.
- ~80 small icon-chip background tints (the circular colour behind each
  activity's emoji, used across every hub screen) were likewise mapped from
  old pastel to new vivid, grouped by the same 7 hue families.
- Deliberately **not** changed: Little One Mode's high-contrast
  black/white/red visuals (changing those would undermine the actual
  newborn-vision research the mode is built on), and the typography
  (Baloo 2 was already a bold, rounded, kid-friendly display font - a decent
  choice doesn't need replacing just because other things did).

## Family Photos (round 3)

Reached only from Parent Zone → Family Photos (so it sits behind the Parent
Zone PIN that already exists), with an optional second PIN a parent can set
just for this section from inside it.

- **Camera**: `AndroidVault.takePhoto()` / `takeVideo()` request the CAMERA
  permission at runtime if needed, then launch the device's own camera app
  (`MediaStore.ACTION_IMAGE_CAPTURE` / `ACTION_VIDEO_CAPTURE`) with its output
  pointed at a file in this app's private storage (`filesDir/vault/`) via a
  `FileProvider`. Video capture is capped at 60 seconds.
- **Storage**: everything lives in that private `vault/` folder — never the
  phone's public Gallery/DCIM, never synced or uploaded anywhere by this app.
  `MainActivity.safeVaultFile()` strips any path components from a filename
  before touching disk, so the bridge can never read, share, or delete
  outside that one folder.
- **Gallery**: `listMedia()` returns the file list as JSON; `readThumb()`
  decodes and downscales each photo to a small base64 JPEG for the grid
  (videos get a plain icon instead of a decoded frame, to keep this fast and
  simple). `openMedia()` hands the full file to the device's own photo
  viewer / video player.
- **Sharing**: `shareMedia()` is the one deliberate way anything leaves the
  device, and only when a parent explicitly taps Share — it hands the file
  to Android's native share sheet (`Intent.ACTION_SEND` + `createChooser`),
  which lists whatever's installed (WhatsApp, Instagram, Facebook, Signal,
  Gmail, ...). This app never talks to any of those services directly and
  has no accounts, API keys, or upload step of its own.
- **The PIN is a privacy screen, not encryption** — same honest framing as
  the existing Parent Zone PIN. It's stored in `localStorage` on the device;
  anyone who could read the app's own storage could read it too. It stops a
  curious child from poking around, not a determined adult.

This is the single biggest piece of native Android code added so far
(permissions, `FileProvider`, activity-result handling, bitmap downscaling)
and, like the WebView crash found earlier, this class of bug only fully
reveals itself on a real device — it compiles and its web-side logic is
Playwright-tested with the native bridge mocked out, but the actual
camera/permission/share flow has not yet been exercised on physical
hardware.

## Building this project

CI builds a debug APK automatically on every push via
`.github/workflows/smart-beginning.yml` (GitHub Actions → the
"Smart Beginning" workflow → the run's Artifacts) — that's the easiest way to
get an installable APK without a local Android SDK. The app has been built
this way, installed, and run on a real device.

To build locally:
```
cd smart-beginning
./gradlew assembleDebug
```
You'll need the Android SDK installed and `ANDROID_HOME`/`local.properties`
pointing at it, same as any Android Studio project. Open the `smart-beginning/`
folder directly in Android Studio and it should sync normally.

## Round 7: the real reason rhymes were silent, plus animal sounds and a bigger Colouring Book

Three rounds of patching the Web Audio retry/resume logic never fixed "rhymes
and lullabies don't play," because that was never the bug. The actual cause,
found by reading the navigation code rather than theorizing about audio
timing further: `openRhyme()` (called when you tap any rhyme, lullaby, action
song or story card) tried to switch to the player screen with
`showScreen('s-act-rhyme')` — but `showScreen()` already prepends `s-` itself,
so this looked for an element id `s-s-act-rhyme`, found nothing, and silently
did nothing. The title/lyrics text updated invisibly in the background, but
the screen holding the actual Play/Stop/Sing buttons never appeared, so there
was never anything to tap. Animal sound effects were unaffected because that
button grid calls the sound function directly, with no screen change
involved — which is also why they were the only thing that worked, and why
the bug looked like an audio engine problem rather than the one-line
navigation typo it actually was. Fixed by removing the stray `s-` prefix.
Verified with a Playwright test that taps an actual rhyme and lullaby card
through the real UI (not by calling the player function directly, which
would have missed this) and confirms the player screen opens and notes
fire when Play is tapped.

Also addressed from the same report:
- **Animal sound character.** These are still synthesised oscillator tones,
  not recordings — the app's "nothing downloaded, nothing streamed" design
  means there's no bundled audio asset to fall back on. What was making them
  sound like knocking/a doorbell was a flat, static pitch per tone. Every
  animal cry now gives its tone a glide target so the pitch actually slides
  during the note (a moo drops, a tweet rises, etc.), which reads as far more
  "alive" than a fixed-frequency beep, even though it's the same waveform
  under the hood. This is a real improvement within what pure synthesis can
  do, not a claim that these now sound like real animals.
- **Colouring Book expanded.** Was 4 fixed pictures (one letter, one number,
  one face, one — not very recognisable — camel). Now: all 26 letters, numbers
  1–10, and 8 animals (camel, cat, dog, fish, bird, turtle, butterfly,
  elephant), organised as a category picker (Letters / Numbers / Faces /
  Animals) with a second row to pick the specific item, rather than one long
  flat list. The old camel was rebuilt as several closed shapes (body, neck,
  head) instead of one long chain of curves that didn't read as a complete
  animal; cat, dog, fish, bird, turtle and butterfly all came out clearly
  recognisable on visual review, elephant is the weakest of the eight (legible
  but not as crisp as the others) and would be the one to revisit first if
  this gets another pass. The old Parent Zone deep links (Tracing sheet /
  Counting to 15 / Feelings faces / UAE animals) still work, now landing on
  the matching category.

## Known gaps / honest limitations

- Tamil and Kannada interface text is a first machine-assisted translation
  pass, not reviewed by a native speaker.
- Watch & Learn opens YouTube search results, not curated/verified videos —
  it says so in-app, but a grown-up should still watch alongside a child there,
  same as the original build intended.
- `autoTune()`-generated melodies are pleasant placeholders, not transcriptions
  of the real traditional tunes, for the rhymes added in this pass.
- The Colouring Book's pictures are simple procedural line art (drawn with
  canvas paths, not illustrated), and colouring is free-draw over the outline
  rather than a flood-fill that respects the lines — the same forgiving
  approach most toddler colouring apps use, since "stay inside the lines"
  isn't a realistic expectation at this age anyway.
- XP, level, and stickers live only in memory for the current app session —
  there's no save/load to the device yet, so progress resets on every app
  restart. Round 6 made the *displayed* numbers honest (zero on a fresh
  install, real numbers once you play), but didn't add persistence across
  restarts. Worth doing next if real day-to-day progress tracking matters.
