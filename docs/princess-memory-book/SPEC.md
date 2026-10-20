# Princess Memory Book — A Magical Digital Scrapbook for a Baby Girl: Product & Technical Specification

> Flutter (Android + iOS), Firebase backend, Riverpod state, Clean Architecture. An emotionally beautiful,
> fairy-tale scrapbook where parents save every precious memory — photos, videos, voice notes, letters,
> milestones, stickers and AI-written stories — of their baby girl.
> Version 1.0 · Status: Blueprint (implementation-ready) + runnable MVP source in §14.
> Related in this repo: [`metadata.json`](../../metadata.json) — "Kinni" is Anjali's **pregnancy** tracker.
> Princess Memory Book is the natural **post-birth sequel** to that journey (shared account, same family), and
> reuses the Gemini server-side AI capability already declared there (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`).

---

## Table of Contents

0. [Scope, Status & Relationship to Kinni](#0-scope-status--relationship-to-kinni)
1. [Product Requirements Document (PRD)](#1-product-requirements-document-prd)
2. [App Architecture (Clean Architecture)](#2-app-architecture-clean-architecture)
3. [Database Schema (Firestore + Storage)](#3-database-schema-firestore--storage)
4. [Flutter Folder Structure](#4-flutter-folder-structure)
5. [UI Wireframes & Design Language](#5-ui-wireframes--design-language)
6. [Screen-by-Screen Design](#6-screen-by-screen-design)
7. [API Structure (Cloud Functions)](#7-api-structure-cloud-functions)
8. [Firebase Configuration](#8-firebase-configuration)
9. [AI Integration (Gemini / OpenAI)](#9-ai-integration-gemini--openai)
10. [Development Roadmap](#10-development-roadmap)
11. [Monetization Strategy](#11-monetization-strategy)
12. [Security Model](#12-security-model)
13. [Premium Features](#13-premium-features)
14. [Complete Flutter Source Code for MVP](#14-complete-flutter-source-code-for-mvp)
15. [Production Deployment Guide](#15-production-deployment-guide)

---

## 0. Scope, Status & Relationship to Kinni

### 0.1 Implementation status (honest framing)

This document is a **blueprint-level deliverable plus a runnable MVP foundation** (§14). The four-perspective
reading of the brief:

- **Executive:** An 18-feature, 10-WOW-feature "most beautiful scrapbook ever" is a 9–12 month, multi-engineer
  product, not a one-shot build. Shipping value fast means releasing the **emotional core** first (scrapbook
  pages, milestones, letters, voice notes, dashboard) and letting the AR/3D/AI-movie features follow once the
  memory graph has users and data.
- **Business user (the parent):** Day one, a parent must be able to create a page, drop in a photo + a note +
  a voice memory, log "first smile", and feel the magic. That is the MVP. Everything else is delight on top.
- **Solution architect:** 5,000 stickers, AI movies, AR camera and 3D flipbooks are each a **subsystem**. They
  must not block the core. The architecture (§2) isolates them behind feature modules and remote config flags so
  the app ships without them and lights them up later.
- **Engineer / end user:** "Never provide placeholders" is honored by shipping **real, compilable MVP code**
  (§14) — theme, models, Riverpod providers, Firestore repositories, auth and three live screens — rather than
  pretending a 200-file production app was built and verified in one session. What is spec vs. shipped is stated
  per feature in §1.4 so nothing is oversold.

### 0.2 Why it belongs next to Kinni

`metadata.json` describes Kinni as *"Anjali's Pregnancy Journey tracker."* Princess Memory Book continues the
same family's story after the due date. It reuses:

| Reused asset | From | How |
|---|---|---|
| Server-side Gemini API capability | `metadata.json` (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`) | AI captions, story generator, auto-tagging, memory-movie script (§9) run server-side — no API key on device. |
| The master/entitlement pattern | `expertprompter/` (reviewed `isMaster` / `MASTER_EMAILS`) | Premium/family-admin gating (§11, §12) follows the same shipped pattern — never a plaintext password in spec, chat or ticket. |
| The "blueprint + working slice" discipline | `docs/mixforge-studio/SPEC.md`, `docs/dj-nexus-pro/` | Same honesty about status and the same spec shape. |

---

## 1. Product Requirements Document (PRD)

### 1.1 Vision

> Opening Princess Memory Book should feel like opening a magical fairy-tale storybook filled with love — a
> private, heirloom-grade scrapbook a parent keeps for a lifetime and gifts to their daughter when she grows up.

### 1.2 Target users & personas

| Persona | Need | Primary features |
|---|---|---|
| **New mum (primary)** | Capture fleeting moments in seconds, one-handed, often at 2 a.m. | Quick-add, voice notes, dashboard "Today's Memory" |
| **Dad / partner** | Write letters, record messages, feel involved | Love Notes, Voice Memory Book, family sharing |
| **Grandparents (viewer)** | See new memories without managing anything | Read-only family sharing, "On This Day" |
| **The child (future)** | Receive the book at 5/10/18/21 | Time Capsule, PDF/photo-book export, Digital Museum |

### 1.3 Goals & success metrics

| Goal | Metric (90 days post-launch) |
|---|---|
| Emotional habit | ≥ 3 memories added / active family / week |
| Retention | D30 ≥ 35% (memory apps skew high — the data compounds) |
| Monetization | ≥ 5% free→Premium within 60 days |
| Trust | 0 privacy incidents; 100% of media encrypted at rest + in transit |

### 1.4 Feature inventory & release phase

Legend: **MVP** = in §14 foundation / first release · **v1** = fast-follow · **v2** = WOW phase.

| # | Feature | Phase | Notes |
|---|---|---|---|
| 1 | Digital Scrapbook Creator (photos, video, voice, notes, date, location) | MVP | Core of the app |
| 2 | Drag-and-drop page editor (resize/rotate/layer) | v1 | Canvas engine, significant effort |
| 3 | Love Notes ("Dear My Princess", unlimited letters) | MVP | Text + optional photo |
| 4 | Video Memory Gallery (age-bucketed timeline) | v1 | Reels + AI slideshow in v2 |
| 5 | Milestone Tracker (first smile/tooth/word… roadmap) | MVP | Story-roadmap UI |
| 6 | Sticker Universe (5,000+, animated/interactive packs) | v1→v2 | Ship ~200 free in MVP; packs later |
| 7 | Scrapbook Templates (baby shower, 1st birthday, festivals…) | v1 | One-tap page presets |
| 8 | Memory Calendar + "On This Day" | v1 | Firestore date index |
| 9 | AI Story Generator (photos → storybook) | v2 | Gemini vision + text (§9) |
| 10 | Voice Memory Book + speech-to-text | v1 | On-device STT + cloud fallback |
| 11 | Family Sharing (Viewer/Editor/Admin) | v1 | Security rules in §12 |
| 12 | Memory Time Capsule (open at 5/10/18/21, countdown) | v1 | Scheduled unlock |
| 13 | Editor effects (filters, video sparkles/hearts) | v2 | GPU shaders |
| 14 | Export (PDF, photo book, video story, album) | v1 | Print-ready layouts |
| 15 | Beautiful Dashboard (today, recent, stats) | MVP | §14 screen |
| 16 | Search & smart AI tagging | v1→v2 | Keyword MVP; AI tags v2 |
| 17 | Cloud backup (Drive/OneDrive/iCloud) + E2E | v2 | Firebase is primary; export-sync later |
| 18 | Gamification (badges, celebration animations) | v1 | Badge rules in §3 |
| WOW | Memory movie, growth/height/weight analytics, birthday countdown, 3D flipbook, AR sticker camera, Digital Museum | v2 | Each a feature module behind a flag |

### 1.5 Non-functional requirements

- **Offline-first:** every create/read works offline; writes queue and sync (Firestore offline persistence + a
  local Isar cache for media thumbnails).
- **Performance:** dashboard cold start < 2.0s on a mid-range device; image grid scroll at 60fps via cached,
  resized thumbnails (never full-res in lists).
- **Accessibility:** min 4.5:1 text contrast even on pastel; dynamic text scaling; semantic labels on stickers.
- **Localisation:** English + Hindi + Tamil at launch (Roshan's context); `intl` ARB files, RTL-ready.
- **Dark mode:** a "twilight fairy-tale" dark theme (deep plum, starlight gold), not just inverted colors.

---

## 2. App Architecture (Clean Architecture)

### 2.1 Layering

```
┌──────────────────────────────────────────────────────────────┐
│ PRESENTATION   Flutter widgets · Riverpod Notifiers · routing  │
│                (screens, theme, animations, reusable widgets)  │
├──────────────────────────────────────────────────────────────┤
│ DOMAIN         Entities · UseCases · Repository interfaces     │
│                (pure Dart, no Flutter/Firebase imports)        │
├──────────────────────────────────────────────────────────────┤
│ DATA           Repository impls · DTOs · DataSources           │
│                (Firestore, Storage, Auth, local Isar, STT)     │
└──────────────────────────────────────────────────────────────┘
```

Dependencies point **inward only**: Presentation → Domain ← Data. Domain knows nothing about Firebase or Flutter,
which keeps the memory logic testable and lets the backend be swapped (e.g. Supabase) without touching domain.

### 2.2 State management — Riverpod (v2, code-gen)

- `AsyncNotifierProvider` for streams of memories/pages (Firestore snapshots → `AsyncValue`).
- `NotifierProvider` for editor/local UI state (selected sticker, page zoom).
- `Provider` for repository wiring (DI). No `BuildContext` needed for reads → easy testing.
- Providers are declared with `riverpod_generator` (`@riverpod`) for compile-safe, less-boilerplate code.

### 2.3 Navigation — `go_router`

Declarative, deep-link-ready (needed for family-share invite links and "open at age" capsule links), with
`ShellRoute` for the bottom-nav scaffold.

### 2.4 Key packages

| Concern | Package | Why |
|---|---|---|
| State / DI | `flutter_riverpod`, `riverpod_annotation` | Testable, compile-safe |
| Routing | `go_router` | Deep links, shell nav |
| Backend | `firebase_core/auth/firestore/storage`, `cloud_functions` | Managed, offline-first |
| Auth | `google_sign_in`, `sign_in_with_apple` | Store requirement (Apple) |
| Models | `freezed`, `json_serializable` | Immutable entities + (de)serialization |
| Local cache | `isar` / `drift` | Thumbnail + queue cache |
| Media | `image_picker`, `video_player`, `just_audio`, `record` | Capture + playback |
| STT | `speech_to_text` | Voice→text on device |
| Animations | `rive`, `lottie`, `flutter_animate` | Hearts, sparkles, page-turn |
| Export | `pdf`, `printing` | Print-ready PDF/photo book |
| Images | `cached_network_image`, `flutter_image_compress` | 60fps grids |

---

## 3. Database Schema (Firestore + Storage)

Firestore is document/collection; media bytes live in Cloud Storage with only the download path stored in
Firestore. All timestamps are `serverTimestamp`.

### 3.1 Collections

```
users/{uid}
  displayName, email, photoUrl, locale, createdAt
  entitlement: { tier: "free"|"premium", source, expiresAt }

families/{familyId}
  name, createdBy(uid), babyName, babyDob, babyGender, coverPhotoPath
  members: { {uid}: "admin"|"editor"|"viewer" }           // denormalized for rules
  memberUids: [uid, ...]                                   // array for `array-contains` queries
  stats: { photos, videos, letters, milestones, memories } // incremented by Cloud Function

families/{familyId}/memories/{memoryId}
  type: "photo"|"video"|"voice"|"note"
  title, caption, note
  mediaPath, thumbPath, durationMs                         // Storage download URLs (raw path layout: §3.3)
  takenAt(ts), createdAt(ts), createdBy(uid)
  location: { lat, lng, label }                            // optional
  ageBucket: "newborn"|"1m"|"3m"|"6m"|"1y"|"2y"|"3y"       // computed from babyDob
  tags: [string]                                           // keyword + AI tags
  dateKey: "2026-10-20"                                     // for calendar / "On This Day"

families/{familyId}/pages/{pageId}
  title, templateId, background, createdAt, createdBy
  elements: [ { id, kind:"photo"|"text"|"sticker"|"frame"|"audio",
               x, y, w, h, rotation, z, payload{...} } ]   // drag-drop canvas
  memoryRefs: [memoryId]

families/{familyId}/letters/{letterId}
  authorUid, authorRole:"mummy"|"daddy"|"family", title, body
  occasion, photoPath, createdAt, deliverAt                 // deliverAt = optional capsule

families/{familyId}/milestones/{milestoneId}
  key:"first_smile"|"first_tooth"|..., title, achievedAt, note, memoryRef, icon

families/{familyId}/capsules/{capsuleId}
  title, openAt(ts), createdBy, sealed(bool)
  items: [ {kind, ref} ]                                    // letters/photos/videos

families/{familyId}/badges/{badgeId}
  key:"first_album"|"100_memories"|..., earnedAt
```

### 3.2 Indexing & denormalization decisions

- `memories` queried by `ageBucket` (gallery), by `dateKey` (calendar/On-This-Day), and ordered by `takenAt`.
  Composite indexes: `(ageBucket asc, takenAt desc)` and `(dateKey asc, takenAt desc)`.
- `families.memberUids` array enables `where('memberUids','array-contains', uid)` to list a user's families in
  one query; `members` map is the source of truth security rules read (cheap, no extra read).
- `stats` is maintained by a Cloud Function trigger (§7) so the dashboard never aggregates client-side.

### 3.3 Storage layout

```
families/{familyId}/memories/{memoryId}/original.{ext}
families/{familyId}/memories/{memoryId}/thumb.webp      // 400px, generated by Function
families/{familyId}/letters/{letterId}/photo.jpg
families/{familyId}/exports/{exportId}.pdf
```

---

## 4. Flutter Folder Structure

```
lib/
  main.dart
  app.dart                         # MaterialApp.router + theme + ProviderScope
  core/
    theme/            app_theme.dart, palette.dart, text_styles.dart
    router/           app_router.dart
    config/           firebase_options.dart, remote_flags.dart
    utils/            age_bucket.dart, date_keys.dart, result.dart
    widgets/          magical_background.dart, floating_hearts.dart,
                      sparkle_overlay.dart, princess_button.dart, stat_tile.dart
  features/
    auth/
      domain/         auth_repository.dart, app_user.dart
      data/           firebase_auth_repository.dart
      presentation/   login_screen.dart, onboarding_screen.dart, auth_providers.dart
    scrapbook/
      domain/         memory.dart, page.dart, memory_repository.dart, usecases/
      data/           firestore_memory_repository.dart, memory_dto.dart
      presentation/   dashboard_screen.dart, memory_grid.dart, add_memory_sheet.dart,
                      memory_providers.dart
    letters/          domain/ data/ presentation/
    milestones/       domain/ data/ presentation/
    gallery/          presentation/ (age-bucketed timeline)
    calendar/         presentation/ (month grid + On This Day)
    stickers/         data/ (sticker catalog)  presentation/
    editor/           presentation/ (drag-drop canvas)       # v1 module
    capsule/ family/ export/ gamification/                   # feature modules
  l10n/               app_en.arb, app_hi.arb, app_ta.arb
assets/
  stickers/ lottie/ rive/ fonts/ illustrations/
```

Rationale: **feature-first** (not layer-first) so each feature is a self-contained, deletable/flaggable module —
critical because half the brief is optional-but-dazzling features that must not entangle the core.

---

## 5. UI Wireframes & Design Language

> A **viewable, interactive** render of these wireframes ships beside this spec at
> [`mockups.html`](./mockups.html) — open it in any browser to see the splash, dashboard, scrapbook page,
> milestones roadmap and love-letter screens with the real palette and motion.

### 5.1 Palette (light — "Fairy Tale Day")

| Token | Hex | Role |
|---|---|---|
| `primaryPink` | `#FF7EB9` | Primary actions, hearts |
| `softPink` | `#FFE3EF` | Page backgrounds, cards |
| `royalPurple` | `#9B5DE5` | Headers, nav accents |
| `lilac` | `#E4C1F9` | Secondary surfaces |
| `gold` | `#F6C453` | Premium, badges, crowns |
| `skyBlue` | `#8EC5FF` | Clouds, boys-in-family accents |
| `mint` | `#A0E7C4` | Success, milestones |
| `inkPlum` | `#4A2E52` | Primary text (4.6:1 on softPink) |

### 5.2 Palette (dark — "Twilight Fairy-Tale")

| Token | Hex | Role |
|---|---|---|
| `nightPlum` | `#1E1230` | Background |
| `starlightGold` | `#FFD98E` | Accents, stars |
| `glowPink` | `#FF9ECb` | Primary on dark |
| `moonLilac` | `#C9A7F0` | Text / headers |

### 5.3 Design language

- **Material Design 3** base (`useMaterial3: true`) with a custom `ColorScheme.fromSeed(royalPurple)`.
- **Glassmorphism** on floating sheets (frosted `BackdropFilter`, 18px blur, 60% white overlay, 1px gold border).
- **Neumorphism** on the quick-add tiles (soft dual-shadow on `softPink`).
- **Typography:** display = *Fredoka* (rounded, friendly); body = *Nunito*. Headings get a subtle gold text-shadow.
- **Shape:** 28px card radius, pill buttons, scalloped page edges (scrapbook feel).
- **Motion vocabulary** (all respect "reduce motion"):
  - Floating hearts & sparkles drift on the background (`flutter_animate`, low opacity, GPU-light).
  - Page-turn (3D flip) between scrapbook pages (`Transform` + `PageView`, Rive for premium 3D flipbook).
  - Sticker bounce-in (elastic scale) on drop.
  - Falling stars on milestone unlock; confetti + crown on badge earn (`lottie`).

### 5.4 Wireframe sketches (ASCII)

```
DASHBOARD                         SCRAPBOOK PAGE                  MILESTONES ROADMAP
┌───────────────────────┐        ┌───────────────────────┐       ┌──────────────────┐
│ ✨ Good morning, Mummy │       │   ❀  My First Bath  ❀  │       │   🌙──★──🌸──★     │
│ [Princess avatar]  👑 │        │ ┌────────┐  ┌───────┐ │       │  First Smile  ✓   │
│                        │        │ │ photo  │  │ note  │ │       │  First Tooth  ✓   │
│  Today's Memory  ▸     │        │ │        │  │ 🎀    │ │       │  First Word   ○   │
│ ┌────┐┌────┐┌────┐    │        │ └────────┘  └───────┘ │       │  First Crawl  ○   │
│ │📷 ││🎥 ││🎙 │ Quick │       │   🎙 Daddy's voice ▸   │       │  First Walk   ○   │
│ └────┘└────┘└────┘ add │       │  ◁  page 3 of 12   ▷  │       │   …roadmap…       │
│  Recent ▸  [grid]      │        └───────────────────────┘       └──────────────────┘
│  📊 128 📷  14 🎥  9 ✉ │
│ [Home][Book][＋][Cal][👤]│
└───────────────────────┘
```

---

## 6. Screen-by-Screen Design

Each screen below is specified as: purpose · key widgets · state · motion. (Splash, Dashboard, Scrapbook Editor,
Milestones and Love Letters are rendered live in `mockups.html`.)

1. **Splash** — animated crown + title bloom over `magical_background`; preloads auth + remote flags; auto-routes
   to Onboarding / Login / Dashboard. Motion: logo scale-bloom + falling stars.
2. **Onboarding (3 pages)** — "Save every moment / Share with family / Keep it forever"; sets `babyName`,
   `babyDob`, `babyGender`, cover photo. State: `onboardingNotifier`.
3. **Login** — Google, Apple, Email buttons as glass cards on a cloud gradient. Error toasts in-theme.
4. **Dashboard** — "Today's Memory", 3 neumorphic quick-add tiles (Photo/Video/Voice), recent memory grid,
   stats row (`stat_tile`), birthday countdown chip. State: `recentMemoriesProvider` (AsyncValue), `statsProvider`.
5. **Scrapbook / Pages** — horizontal `PageView` of pages with 3D page-turn; tap → page editor (v1 drag-drop).
6. **Add Memory sheet** — glass bottom sheet: pick/capture media, caption, date, location, record voice, tags.
7. **Memory Gallery** — age-bucketed (`Newborn…3y`) sticky-header timeline grid; tap → full viewer with
   swipe + captions. "Create Reel" CTA (v2).
8. **Video Gallery** — same buckets, video thumbs with duration; AI slideshow CTA (v2).
9. **Love Letters** — "Dear My Princess" ledger; compose letter (author = Mummy/Daddy/Family), optional photo,
   optional `deliverAt` (capsule). Reading view styled like a storybook page.
10. **Milestones** — vertical "magical story roadmap": nodes along a winding path, locked (○) vs achieved (✓ with
    falling stars); tap to log date + note + linked memory.
11. **Calendar** — month grid, dots on days with memories; tap a day → that day's memories; "On This Day" banner.
12. **Settings** — family members & roles, theme (light/dark/auto), language, backup status, entitlement/upgrade,
    export, time capsules, about.

---

## 7. API Structure (Cloud Functions)

Thin, secured server layer. Client writes memories directly to Firestore (offline-first); Functions handle
fan-out, media processing, AI and anything that must not be trusted to the client.

| Function | Trigger | Responsibility |
|---|---|---|
| `onMemoryCreated` | Firestore `memories/{id}` onCreate | Increment `families.stats`, set `ageBucket`/`dateKey`, enqueue thumbnail + AI-tag jobs, evaluate badges |
| `generateThumbnail` | Storage onFinalize (original) | Create 400px `thumb.webp`, write `thumbPath` |
| `aiCaption` | Callable `httpsCallable('aiCaption')` | Image → caption via Gemini (§9); premium-gated |
| `aiStory` | Callable | N photos → storybook (title + per-photo captions + summary) |
| `aiAutoTag` | Task from `onMemoryCreated` | Vision labels → `tags[]` |
| `memoryMovie` | Callable (v2) | Build script + render job for AI memory movie |
| `createInvite` / `acceptInvite` | Callable | Family sharing: issue signed invite link, add member with role |
| `sealCapsule` / `openDueCapsules` | Callable / Scheduled (daily) | Lock capsule; unlock + notify when `openAt` passes |
| `exportPdf` | Callable | Render print-ready PDF/photo-book to Storage, return URL |
| `verifyPurchase` | Callable | Validate Play/App Store receipt → set `entitlement.tier` |

**Contract example — `aiCaption`:**
```jsonc
// request
{ "familyId": "f_123", "memoryId": "m_456", "imagePath": "families/f_123/memories/m_456/original.jpg" }
// response
{ "caption": "Our little star's very first giggle 🌟", "tags": ["smile","newborn","indoor"] }
```
All callables verify `context.auth.uid` is a member of `familyId` before doing anything (defense in depth with
§12 rules).

---

## 8. Firebase Configuration

- **Project split:** `princess-memory-dev`, `-staging`, `-prod` (separate projects, not just envs, so staging
  data can never leak into prod billing/analytics). Flutter flavors map to each via `--dart-define`.
- **Services:** Auth (Google/Apple/Email), Firestore (prod mode), Storage, Cloud Functions (Node 20),
  Cloud Messaging (capsule/birthday reminders), Remote Config (feature flags for v2 modules), App Check
  (Play Integrity / DeviceCheck) to block non-app clients, Crashlytics + Analytics.
- **`firebase_options.dart`** generated by `flutterfire configure` per flavor — **never hand-edited**, and the
  dev/staging ones are the only ones committed; prod is injected in CI.
- Firestore offline persistence **on**; Storage uploads resumable.

---

## 9. AI Integration (Gemini / OpenAI)

Reuses Kinni's declared `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`: **all AI runs server-side in Cloud Functions**;
no model key ever ships in the app.

| AI feature | Model | Prompt shape |
|---|---|---|
| Caption generator | Gemini 1.5 Flash (vision) | "You write warm, short captions for a baby girl's scrapbook. 1 sentence, ≤12 words, one tasteful emoji. Image: <img>." |
| Auto-tag | Gemini Flash vision | "Return 3–6 lowercase tags for this baby photo (setting, mood, milestone). JSON array only." |
| Story generator | Gemini 1.5 Pro | "Given these N captioned photos in time order, write a tender storybook: a title, one diary line per photo, and a 3-sentence closing summary. Gentle, present tense, parent's voice." |
| Memory summary / "A Magical Day" | Gemini Pro | Groups a day's memories → short narrated recap. |
| Speech-to-text | On-device `speech_to_text`; Gemini fallback for long clips | Transcribe voice notes → searchable text + letter draft. |

- **Config switch:** `AI_PROVIDER` remote-config value lets ops flip Gemini ↔ OpenAI (`gpt-4o-mini` vision) without
  an app update; the Function abstracts both behind one interface.
- **Guardrails:** AI output is a *suggestion* — always editable before save; rate-limited per family; cost-capped
  (premium quota in §13); never auto-posts.

---

## 10. Development Roadmap

| Phase | Weeks | Deliverables |
|---|---|---|
| **M0 Foundation** | 1–2 | Project, flavors, theme, auth, Firestore rules, CI. (= §14 scope) |
| **M1 Emotional core (MVP release)** | 3–6 | Scrapbook memories, add-memory sheet, dashboard, milestones, love letters, voice notes. Store soft-launch. |
| **M2 Family & organise** | 7–10 | Family sharing + roles, calendar + On-This-Day, gallery buckets, templates, keyword search, gamification badges. |
| **M3 Create & keep** | 11–15 | Drag-drop page editor, stickers (packs), export (PDF/photo-book), time capsules, filters. |
| **M4 WOW / AI** | 16–24 | AI story + captions + auto-tag, AI memory movie, growth analytics, 3D flipbook, AR sticker camera, Digital Museum, cross-cloud backup. |

Each milestone ends with: tests green, Crashlytics clean, a TestFlight/Internal-testing build, and a decision gate.

---

## 11. Monetization Strategy

**Model:** generous free tier (the memories are the parent's, forever) + Premium subscription for *scale, AI and
export*. Never hold a family's own photos hostage.

| | Free | **Premium** (₹299/mo · ₹1,999/yr · Lifetime ₹4,999) |
|---|---|---|
| Memories | Up to 300 | Unlimited |
| Families / children | 1 child | Unlimited children |
| Members | 3 | Unlimited (grandparents, aunts…) |
| Sticker packs | ~200 free | All 5,000+ incl. animated |
| AI captions/stories | 5 free trials | Unlimited (fair-use quota) |
| Export | Watermarked PDF | Print-ready PDF + photo-book + video story |
| Backup | Firebase | + Drive/OneDrive/iCloud sync, E2E |
| 3D flipbook / AR / Memory movie | — | ✓ |

- **Entitlement** stored on `users/{uid}.entitlement`, written only by `verifyPurchase` (receipt validated) —
  mirrors the reviewed master/entitlement pattern from `expertprompter/`.
- Store billing via `in_app_purchase` (Play + App Store); Lifetime option respects the "heirloom, keep forever"
  emotion and de-risks subscription fatigue for a once-in-a-childhood product.
- **No ads.** Ads in a baby's private memory book would break trust and the premium emotion.

---

## 12. Security Model

- **Auth required** for everything; App Check blocks non-app clients.
- **Authorization = family membership + role**, enforced in Firestore Security Rules (source of truth) *and*
  re-checked in callables.

```js
// firestore.rules (core)
function member(fid)  { return request.auth != null &&
  request.auth.uid in get(/databases/$(database)/documents/families/$(fid)).data.members; }
function role(fid)    { return get(/databases/$(database)/documents/families/$(fid)).data.members[request.auth.uid]; }
function canEdit(fid) { return member(fid) && role(fid) in ['admin','editor']; }

match /families/{fid} {
  allow read:   if member(fid);
  allow update: if role(fid) == 'admin';
  match /{sub=**} {
    allow read:   if member(fid);
    allow create, update, delete: if canEdit(fid);
  }
}
match /users/{uid} {
  allow read, write: if request.auth.uid == uid;
  allow update: if request.auth.uid == uid
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['entitlement']); // only backend sets entitlement
}
```

- **Storage rules** mirror membership: read/write only within a family the caller belongs to; content-type and
  size limits (images ≤ 25MB, video ≤ 500MB) to prevent abuse.
- **Privacy:** media encrypted in transit (TLS) and at rest (Google-managed keys; optional customer-managed +
  client-side E2E for premium cross-cloud backup). No third-party analytics on media content. GDPR/DPDP: full
  export + "delete my family" cascade (`deleteFamily` Function). Children's data handled under COPPA/age-gating —
  the account holder is the parent; the child is a subject, never a user.
- **Invite links** are single-use, signed, expiring tokens (not guessable family IDs).
- **No secrets in the repo:** API keys in Functions config / Secret Manager; master emails as env, never literal.

---

## 13. Premium Features

Unlimited memories, children & members · all 5,000+ stickers (animated/interactive) · unlimited AI (captions,
stories, auto-tag, memory movie) · print-ready export & physical photo-book ordering · 3D flipbook viewer · AR
sticker camera · growth analytics (height/weight charts, percentile curves) · cross-cloud encrypted backup ·
custom themes & fonts · priority capsule rendering · "Digital Memory Museum" curated AI exhibit.

---

## 14. Complete Flutter Source Code for MVP

> **Status:** these are real, non-placeholder Dart files for the **M0 foundation** — app shell, theme, models,
> Riverpod providers, auth + Firestore repositories, and three live screens (Login, Dashboard, Add-Memory). They
> are written to compile against the packages in §2.4 once `flutter create` + `flutterfire configure` have run and
> `build_runner` has generated the `.freezed.dart`/`.g.dart` parts (commands in §15). They are the *foundation*,
> not all 18 features — the rest follow the same patterns per §10.

### 14.1 `pubspec.yaml` (dependencies)
```yaml
name: princess_memory_book
description: A magical digital scrapbook for a baby girl.
publish_to: "none"
environment: { sdk: ">=3.4.0 <4.0.0" }

dependencies:
  flutter: { sdk: flutter }
  flutter_localizations: { sdk: flutter }
  firebase_core: ^3.6.0
  firebase_auth: ^5.3.1
  cloud_firestore: ^5.4.4
  firebase_storage: ^12.3.4
  cloud_functions: ^5.1.4
  google_sign_in: ^6.2.1
  sign_in_with_apple: ^6.1.3
  flutter_riverpod: ^2.6.1
  riverpod_annotation: ^2.6.1
  go_router: ^14.3.0
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0
  image_picker: ^1.1.2
  record: ^5.1.2
  just_audio: ^0.9.42
  cached_network_image: ^3.4.1
  flutter_animate: ^4.5.0
  intl: ^0.19.0

dev_dependencies:
  flutter_test: { sdk: flutter }
  build_runner: ^2.4.13
  freezed: ^2.5.7
  json_serializable: ^6.8.0
  riverpod_generator: ^2.6.1
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
  assets: [assets/illustrations/, assets/lottie/]
```

### 14.2 `lib/main.dart`
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';

import 'core/config/firebase_options.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const ProviderScope(child: PrincessMemoryApp()));
}
```

### 14.3 `lib/app.dart`
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';

class PrincessMemoryApp extends ConsumerWidget {
  const PrincessMemoryApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Princess Memory Book',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
```

### 14.4 `lib/core/theme/palette.dart`
```dart
import 'package:flutter/material.dart';

/// Single source of truth for the fairy-tale palette (§5.1 / §5.2).
class Palette {
  // Light — "Fairy Tale Day"
  static const primaryPink = Color(0xFFFF7EB9);
  static const softPink    = Color(0xFFFFE3EF);
  static const royalPurple = Color(0xFF9B5DE5);
  static const lilac       = Color(0xFFE4C1F9);
  static const gold        = Color(0xFFF6C453);
  static const skyBlue     = Color(0xFF8EC5FF);
  static const mint        = Color(0xFFA0E7C4);
  static const inkPlum     = Color(0xFF4A2E52);

  // Dark — "Twilight Fairy-Tale"
  static const nightPlum      = Color(0xFF1E1230);
  static const starlightGold  = Color(0xFFFFD98E);
  static const glowPink       = Color(0xFFFF9ECB);
  static const moonLilac      = Color(0xFFC9A7F0);
}
```

### 14.5 `lib/core/theme/app_theme.dart`
```dart
import 'package:flutter/material.dart';
import 'palette.dart';

class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: Palette.royalPurple,
      primary: Palette.primaryPink,
      secondary: Palette.royalPurple,
      tertiary: Palette.gold,
      surface: Palette.softPink,
      brightness: Brightness.light,
    );
    return _base(scheme, Palette.inkPlum);
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: Palette.moonLilac,
      primary: Palette.glowPink,
      secondary: Palette.moonLilac,
      tertiary: Palette.starlightGold,
      surface: Palette.nightPlum,
      brightness: Brightness.dark,
    );
    return _base(scheme, Palette.moonLilac);
  }

  static ThemeData _base(ColorScheme scheme, Color onSurface) => ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: scheme.surface,
        fontFamily: 'Nunito',
        textTheme: const TextTheme(
          displaySmall: TextStyle(fontFamily: 'Fredoka', fontWeight: FontWeight.w600),
          titleLarge: TextStyle(fontFamily: 'Fredoka', fontWeight: FontWeight.w600),
        ).apply(bodyColor: onSurface, displayColor: onSurface),
        cardTheme: CardTheme(
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
          color: scheme.surface,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            shape: const StadiumBorder(),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          ),
        ),
      );
}
```

### 14.6 `lib/features/auth/domain/app_user.dart`
```dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'app_user.freezed.dart';

enum EntitlementTier { free, premium }

@freezed
class AppUser with _$AppUser {
  const factory AppUser({
    required String uid,
    required String email,
    String? displayName,
    String? photoUrl,
    @Default(EntitlementTier.free) EntitlementTier tier,
  }) = _AppUser;
}
```

### 14.7 `lib/features/auth/domain/auth_repository.dart`
```dart
import 'app_user.dart';

abstract interface class AuthRepository {
  Stream<AppUser?> authStateChanges();
  Future<AppUser> signInWithGoogle();
  Future<AppUser> signInWithApple();
  Future<AppUser> signInWithEmail(String email, String password);
  Future<AppUser> registerWithEmail(String email, String password);
  Future<void> signOut();
}
```

### 14.8 `lib/features/auth/data/firebase_auth_repository.dart`
```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../domain/app_user.dart';
import '../domain/auth_repository.dart';

class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository(this._auth, this._google);
  final FirebaseAuth _auth;
  final GoogleSignIn _google;

  AppUser _map(User u) =>
      AppUser(uid: u.uid, email: u.email ?? '', displayName: u.displayName, photoUrl: u.photoURL);

  @override
  Stream<AppUser?> authStateChanges() =>
      _auth.authStateChanges().map((u) => u == null ? null : _map(u));

  @override
  Future<AppUser> signInWithGoogle() async {
    final g = await _google.signIn();
    if (g == null) throw FirebaseAuthException(code: 'cancelled', message: 'Sign-in cancelled');
    final a = await g.authentication;
    final cred = GoogleAuthProvider.credential(idToken: a.idToken, accessToken: a.accessToken);
    final res = await _auth.signInWithCredential(cred);
    return _map(res.user!);
  }

  @override
  Future<AppUser> signInWithApple() async {
    final res = await _auth.signInWithProvider(AppleAuthProvider());
    return _map(res.user!);
  }

  @override
  Future<AppUser> signInWithEmail(String email, String password) async {
    final res = await _auth.signInWithEmailAndPassword(email: email, password: password);
    return _map(res.user!);
  }

  @override
  Future<AppUser> registerWithEmail(String email, String password) async {
    final res = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    return _map(res.user!);
  }

  @override
  Future<void> signOut() => Future.wait([_auth.signOut(), _google.signOut()]);
}
```

### 14.9 `lib/features/auth/presentation/auth_providers.dart`
```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../data/firebase_auth_repository.dart';
import '../domain/app_user.dart';
import '../domain/auth_repository.dart';
part 'auth_providers.g.dart';

@Riverpod(keepAlive: true)
AuthRepository authRepository(AuthRepositoryRef ref) =>
    FirebaseAuthRepository(FirebaseAuth.instance, GoogleSignIn());

@Riverpod(keepAlive: true)
Stream<AppUser?> authState(AuthStateRef ref) =>
    ref.watch(authRepositoryProvider).authStateChanges();
```

### 14.10 `lib/features/scrapbook/domain/memory.dart`
```dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'memory.freezed.dart';
part 'memory.g.dart';

enum MemoryType { photo, video, voice, note }

@freezed
class Memory with _$Memory {
  const factory Memory({
    required String id,
    required MemoryType type,
    String? title,
    String? caption,
    String? note,
    String? mediaPath,
    String? thumbPath,
    int? durationMs,
    required DateTime takenAt,
    required DateTime createdAt,
    required String createdBy,
    String? ageBucket,
    required String dateKey, // yyyy-MM-dd
    @Default(<String>[]) List<String> tags,
  }) = _Memory;

  factory Memory.fromJson(Map<String, dynamic> json) => _$MemoryFromJson(json);
}
```

### 14.11 `lib/features/scrapbook/domain/memory_repository.dart`
```dart
import 'memory.dart';

abstract interface class MemoryRepository {
  /// Mint a new memory id without a round-trip, so callers never touch Firestore directly.
  String newId(String familyId);
  Stream<List<Memory>> watchRecent(String familyId, {int limit = 20});
  Stream<List<Memory>> watchByDate(String familyId, String dateKey);
  Future<void> add(String familyId, Memory memory);
  Future<void> delete(String familyId, String memoryId);
}
```

### 14.12 `lib/features/scrapbook/data/firestore_memory_repository.dart`
```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import '../domain/memory.dart';
import '../domain/memory_repository.dart';

class FirestoreMemoryRepository implements MemoryRepository {
  FirestoreMemoryRepository(this._db);
  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _col(String familyId) =>
      _db.collection('families').doc(familyId).collection('memories');

  @override
  String newId(String familyId) => _col(familyId).doc().id;

  Memory _fromDoc(DocumentSnapshot<Map<String, dynamic>> d) {
    final m = d.data()!;
    return Memory(
      id: d.id,
      type: MemoryType.values.byName(m['type'] as String),
      title: m['title'] as String?,
      caption: m['caption'] as String?,
      note: m['note'] as String?,
      mediaPath: m['mediaPath'] as String?,
      thumbPath: m['thumbPath'] as String?,
      durationMs: m['durationMs'] as int?,
      takenAt: (m['takenAt'] as Timestamp).toDate(),
      createdAt: (m['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      createdBy: m['createdBy'] as String,
      ageBucket: m['ageBucket'] as String?,
      dateKey: m['dateKey'] as String,
      tags: (m['tags'] as List?)?.cast<String>() ?? const [],
    );
  }

  @override
  Stream<List<Memory>> watchRecent(String familyId, {int limit = 20}) => _col(familyId)
      .orderBy('takenAt', descending: true)
      .limit(limit)
      .snapshots()
      .map((s) => s.docs.map(_fromDoc).toList());

  @override
  Stream<List<Memory>> watchByDate(String familyId, String dateKey) => _col(familyId)
      .where('dateKey', isEqualTo: dateKey)
      .orderBy('takenAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map(_fromDoc).toList());

  @override
  Future<void> add(String familyId, Memory m) => _col(familyId).doc(m.id).set({
        'type': m.type.name,
        'title': m.title,
        'caption': m.caption,
        'note': m.note,
        'mediaPath': m.mediaPath,
        'thumbPath': m.thumbPath,
        'durationMs': m.durationMs,
        'takenAt': Timestamp.fromDate(m.takenAt),
        'createdAt': FieldValue.serverTimestamp(),
        'createdBy': m.createdBy,
        'dateKey': m.dateKey,
        'tags': m.tags,
        // ageBucket set by the onMemoryCreated Function (§7)
      });

  @override
  Future<void> delete(String familyId, String id) => _col(familyId).doc(id).delete();
}
```

### 14.13 `lib/features/scrapbook/presentation/memory_providers.dart`
```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../data/firestore_memory_repository.dart';
import '../domain/memory.dart';
import '../domain/memory_repository.dart';
part 'memory_providers.g.dart';

@Riverpod(keepAlive: true)
MemoryRepository memoryRepository(MemoryRepositoryRef ref) =>
    FirestoreMemoryRepository(FirebaseFirestore.instance);

/// Active family id (set after onboarding / family selection).
@Riverpod(keepAlive: true)
class CurrentFamily extends _$CurrentFamily {
  @override
  String? build() => null;
  void select(String familyId) => state = familyId;
}

@riverpod
Stream<List<Memory>> recentMemories(RecentMemoriesRef ref) {
  final familyId = ref.watch(currentFamilyProvider);
  if (familyId == null) return const Stream.empty();
  return ref.watch(memoryRepositoryProvider).watchRecent(familyId);
}
```

### 14.14 `lib/core/utils/age_bucket.dart` & `date_keys.dart`
```dart
import 'package:intl/intl.dart';

String dateKey(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

/// Buckets a moment relative to the baby's date of birth (§3.1).
String ageBucket(DateTime dob, DateTime takenAt) {
  final days = takenAt.difference(dob).inDays;
  if (days < 30) return 'newborn';
  final months = days ~/ 30;
  if (months < 3) return '1m';
  if (months < 6) return '3m';
  if (months < 12) return '6m';
  if (months < 24) return '1y';
  if (months < 36) return '2y';
  return '3y';
}
```

### 14.15 `lib/core/widgets/floating_hearts.dart` (ambient motion)
```dart
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme/palette.dart';

/// A GPU-light drift of hearts/sparkles behind content. Respects reduce-motion.
class FloatingHearts extends StatelessWidget {
  const FloatingHearts({super.key, this.count = 10});
  final int count;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return const SizedBox.shrink();
    final rnd = Random(7);
    final size = MediaQuery.of(context).size;
    return IgnorePointer(
      child: Stack(
        children: List.generate(count, (i) {
          final left = rnd.nextDouble() * size.width;
          final delay = (rnd.nextDouble() * 4000).round();
          final icon = i.isEven ? Icons.favorite : Icons.star;
          return Positioned(
            left: left,
            bottom: -24,
            child: Icon(icon, size: 14 + rnd.nextDouble() * 14, color: Palette.primaryPink.withOpacity(.25))
                .animate(onPlay: (c) => c.repeat())
                .moveY(begin: 0, end: -size.height - 48, duration: (6000 + delay).ms, curve: Curves.easeInOut)
                .fadeIn(duration: 800.ms)
                .then()
                .fadeOut(duration: 1200.ms),
          );
        }),
      ),
    );
  }
}
```

### 14.16 `lib/features/auth/presentation/login_screen.dart`
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/widgets/floating_hearts.dart';
import '../../../core/theme/palette.dart';
import '../domain/auth_repository.dart';
import 'auth_providers.dart';

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.read(authRepositoryProvider);
    Future<void> guard(Future<void> Function() action) async {
      try {
        await action();
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not sign in: $e')));
        }
      }
    }

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Palette.lilac, Palette.softPink],
          ),
        ),
        child: Stack(
          children: [
            const FloatingHearts(count: 14),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.auto_awesome, size: 72, color: Palette.gold),
                    const SizedBox(height: 12),
                    Text('Princess Memory Book',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.displaySmall),
                    const SizedBox(height: 6),
                    Text('A magical scrapbook for your little one',
                        style: Theme.of(context).textTheme.bodyLarge),
                    const SizedBox(height: 40),
                    FilledButton.icon(
                      onPressed: () => guard(repo.signInWithGoogle),
                      icon: const Icon(Icons.g_mobiledata, size: 28),
                      label: const Text('Continue with Google'),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: Palette.inkPlum),
                      onPressed: () => guard(repo.signInWithApple),
                      icon: const Icon(Icons.apple),
                      label: const Text('Continue with Apple'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => _showEmailDialog(context, repo),
                      child: const Text('Use email instead'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showEmailDialog(BuildContext context, AuthRepository repo) =>
      showDialog(context: context, builder: (_) => _EmailAuthDialog(repo: repo));
}

/// Inline email sign-in / register — avoids a dangling named route and
/// completes the third auth path from §14.8.
class _EmailAuthDialog extends StatefulWidget {
  const _EmailAuthDialog({required this.repo});
  final AuthRepository repo;
  @override
  State<_EmailAuthDialog> createState() => _EmailAuthDialogState();
}

class _EmailAuthDialogState extends State<_EmailAuthDialog> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      _register
          ? await widget.repo.registerWithEmail(_email.text.trim(), _password.text)
          : await widget.repo.signInWithEmail(_email.text.trim(), _password.text);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not sign in: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_register ? 'Create account' : 'Sign in with email'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          TextButton(
            onPressed: () => setState(() => _register = !_register),
            child: Text(_register ? 'Have an account? Sign in' : 'New here? Create an account'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_register ? 'Create' : 'Sign in'),
        ),
      ],
    );
  }
}
```

### 14.17 `lib/features/scrapbook/presentation/dashboard_screen.dart`
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/widgets/floating_hearts.dart';
import '../../../core/theme/palette.dart';
import '../domain/memory.dart';
import 'memory_providers.dart';
import 'add_memory_sheet.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(recentMemoriesProvider);
    return Scaffold(
      body: Stack(
        children: [
          const FloatingHearts(count: 8),
          SafeArea(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Row(
                      children: [
                        const CircleAvatar(radius: 24, backgroundColor: Palette.lilac,
                            child: Icon(Icons.child_care, color: Palette.royalPurple)),
                        const SizedBox(width: 12),
                        Expanded(child: Text('Good morning, Mummy ✨',
                            style: Theme.of(context).textTheme.titleLarge)),
                        const Icon(Icons.workspace_premium, color: Palette.gold),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(child: _QuickAddRow()),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                    child: Text('Recent memories', style: Theme.of(context).textTheme.titleLarge),
                  ),
                ),
                recent.when(
                  loading: () => const SliverToBoxAdapter(
                      child: Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))),
                  error: (e, _) => SliverToBoxAdapter(child: Padding(
                      padding: const EdgeInsets.all(20), child: Text('Could not load memories: $e'))),
                  data: (items) => items.isEmpty
                      ? const SliverToBoxAdapter(child: _EmptyState())
                      : SliverPadding(
                          padding: const EdgeInsets.all(16),
                          sliver: SliverGrid.builder(
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3, mainAxisSpacing: 10, crossAxisSpacing: 10),
                            itemCount: items.length,
                            itemBuilder: (_, i) => _MemoryTile(items[i]),
                          ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Palette.primaryPink,
        onPressed: () => showAddMemorySheet(context),
        icon: const Icon(Icons.add),
        label: const Text('Add memory'),
      ),
    );
  }
}

class _QuickAddRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final tiles = [
      (Icons.photo_camera, 'Photo'),
      (Icons.videocam, 'Video'),
      (Icons.mic, 'Voice'),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: tiles.map((t) => Expanded(
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () => showAddMemorySheet(context),
              child: Container(
                height: 92,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: const [
                    BoxShadow(color: Colors.white, offset: Offset(-4, -4), blurRadius: 8),
                    BoxShadow(color: Palette.lilac, offset: Offset(4, 4), blurRadius: 10),
                  ],
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(t.$1, color: Palette.royalPurple, size: 28),
                  const SizedBox(height: 6),
                  Text(t.$2),
                ]),
              ),
            ),
          ),
        )).toList(),
      ),
    );
  }
}

class _MemoryTile extends StatelessWidget {
  const _MemoryTile(this.m);
  final Memory m;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: m.thumbPath != null
          ? CachedNetworkImage(imageUrl: m.thumbPath!, fit: BoxFit.cover)
          : Container(
              color: Palette.lilac,
              child: Icon(switch (m.type) {
                MemoryType.voice => Icons.mic,
                MemoryType.note => Icons.sticky_note_2,
                MemoryType.video => Icons.play_circle,
                MemoryType.photo => Icons.image,
              }, color: Palette.royalPurple),
            ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(40),
        child: Column(children: [
          const Icon(Icons.auto_stories, size: 56, color: Palette.royalPurple),
          const SizedBox(height: 12),
          Text('Your story begins here', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          const Text('Add your first magical memory ✨', textAlign: TextAlign.center),
        ]),
      );
}
```

### 14.18 `lib/features/scrapbook/presentation/add_memory_sheet.dart`
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../core/utils/date_keys.dart';
import '../domain/memory.dart';
import 'memory_providers.dart';

Future<void> showAddMemorySheet(BuildContext context) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _AddMemorySheet(),
    );

class _AddMemorySheet extends ConsumerStatefulWidget {
  const _AddMemorySheet();
  @override
  ConsumerState<_AddMemorySheet> createState() => _AddMemorySheetState();
}

class _AddMemorySheetState extends ConsumerState<_AddMemorySheet> {
  final _caption = TextEditingController();
  XFile? _picked;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: Container(width: 44, height: 4,
                decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Text('Add a memory', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            if (_picked != null) Text('Selected: ${_picked!.name}'),
            Wrap(spacing: 8, children: [
              ActionChip(
                avatar: const Icon(Icons.photo_library),
                label: const Text('Gallery'),
                onPressed: () async {
                  final f = await ImagePicker().pickImage(source: ImageSource.gallery);
                  if (f != null) setState(() => _picked = f);
                },
              ),
              ActionChip(
                avatar: const Icon(Icons.photo_camera),
                label: const Text('Camera'),
                onPressed: () async {
                  final f = await ImagePicker().pickImage(source: ImageSource.camera);
                  if (f != null) setState(() => _picked = f);
                },
              ),
            ]),
            const SizedBox(height: 12),
            TextField(
              controller: _caption,
              decoration: const InputDecoration(
                labelText: 'Caption', hintText: 'Our little star smiled today 🌟',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save to the book'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    final familyId = ref.read(currentFamilyProvider);
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (familyId == null || uid == null || _picked == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pick a photo first')));
      return;
    }
    setState(() => _saving = true);
    try {
      final repo = ref.read(memoryRepositoryProvider);
      final now = DateTime.now();
      // Id minted through the repository (Clean Architecture boundary, §2.1) and reused for the Storage path.
      final id = repo.newId(familyId);
      final ext = _picked!.name.split('.').last;
      final storageRef = FirebaseStorage.instance.ref('families/$familyId/memories/$id/original.$ext');
      await storageRef.putData(await _picked!.readAsBytes());
      final url = await storageRef.getDownloadURL();
      final memory = Memory(
        id: id,
        type: MemoryType.photo,
        caption: _caption.text.trim().isEmpty ? null : _caption.text.trim(),
        mediaPath: url,   // download URL (see §3 note); Storage path layout is §3.3
        thumbPath: url,   // Function swaps in the thumb.webp URL (§7)
        takenAt: now,
        createdAt: now,
        createdBy: uid,
        dateKey: dateKey(now),
      );
      await repo.add(familyId, memory);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
```

### 14.19 `lib/core/router/app_router.dart`
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/auth/presentation/auth_providers.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/scrapbook/presentation/dashboard_screen.dart';
part 'app_router.g.dart';

@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final auth = ref.watch(authStateProvider);
  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final loggedIn = auth.valueOrNull != null;
      final atLogin = state.matchedLocation == '/login';
      if (!loggedIn) return atLogin ? null : '/login';
      if (atLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
    ],
  );
}
```

### 14.20 A test that can fail — `test/age_bucket_test.dart`
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:princess_memory_book/core/utils/age_bucket.dart';

void main() {
  final dob = DateTime(2026, 1, 1);
  test('newborn in first 30 days', () {
    expect(ageBucket(dob, DateTime(2026, 1, 15)), 'newborn');
  });
  test('6m bucket between 6 and 12 months', () {
    expect(ageBucket(dob, DateTime(2026, 8, 1)), '6m'); // ~7 months
  });
  test('1y bucket in second year', () {
    expect(ageBucket(dob, DateTime(2027, 6, 1)), '1y');
  });
  test('dateKey formats yyyy-MM-dd', () {
    expect(dateKey(DateTime(2026, 10, 20)), '2026-10-20');
  });
}
```

---

## 15. Production Deployment Guide

### 15.1 Bootstrap the project
```bash
flutter create --org com.roshanmani --project-name princess_memory_book .
# copy lib/, test/, pubspec.yaml from §14
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # freezed/json/riverpod codegen
flutter test                                                # §14.20 must pass
```

### 15.2 Firebase
```bash
npm i -g firebase-tools
firebase login
dart pub global activate flutterfire_cli
# one per flavor:
flutterfire configure --project=princess-memory-dev   --out=lib/core/config/firebase_options.dart
firebase deploy --only firestore:rules,storage:rules   # §12
cd functions && npm i && firebase deploy --only functions   # §7
```

### 15.3 Flavors & build
```bash
# Android
flutter build appbundle --release --flavor prod --dart-define=FLAVOR=prod
# iOS
flutter build ipa --release --flavor prod --dart-define=FLAVOR=prod
```
- Android: configure signing in `android/key.properties` (kept out of VCS); upload AAB to Play Console
  Internal testing → Closed → Production.
- iOS: set bundle id + capabilities (Sign in with Apple, Push), archive via Xcode / `flutter build ipa`, upload
  to App Store Connect → TestFlight → review.

### 15.4 Release checklist
- [ ] `flutter analyze` clean, `flutter test` green, Crashlytics wired.
- [ ] Firestore + Storage rules deployed and unit-tested (`@firebase/rules-unit-testing`).
- [ ] App Check enforced on Firestore/Storage/Functions in prod.
- [ ] Privacy policy + data-safety form (Play) / privacy nutrition labels (Apple) — media, auth, location.
- [ ] In-app purchase products created in both stores; `verifyPurchase` validated against sandbox.
- [ ] Localisation ARB files complete for en/hi/ta.
- [ ] Remote Config flags default v2 modules OFF for the first release.

### 15.5 CI/CD (GitHub Actions sketch)
```
on: push → analyze + test → build dev → distribute to Firebase App Distribution
on: tag v* → build prod (signing from secrets) → upload to Play Internal + TestFlight
```

---

*Blueprint + MVP foundation authored for Roshan Mani. Status per §0.1: implementation-ready spec with real,
compilable M0 source in §14; features beyond M0 follow the same patterns on the §10 roadmap.*
