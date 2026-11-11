# Architecture: short-video-editor (a rebuild of CapCut's core editing features)

Inputs: `recon.md` (S01–S20, F01–F08), `features.csv` (20 must / 15 should / 9 could).
Outputs: this file, `schema.sql` (first migration, tested against Postgres 16 with Supabase `auth`/`storage` stubs).

## Principles

1. **Local-first editor, cloud optional.** The whole core loop (import → edit → captions → export ≤1080p) runs in the browser with no server and no upload. Media sits in the Origin Private File System (OPFS), and projects sit in IndexedDB. That gives zero GPU/egress cost per free user and instant edits. Privacy is also part of the selling angle. Cloud sync, templates, billing and 4K render are added on top.
2. **One timeline document.** The edit is a single typed JSON document (`Timeline`) changed only through commands. Undo/redo, autosave, sync, export and server render all read the same document.
3. **Same renderer for preview and export.** One compositor draws a frame for time `t`. Preview calls it at display rate, and export calls it frame by frame into the encoder. That way what you see is what you export.
4. **Reuse what this repo already has.** Vite + React 19 + TS + Vitest + oxlint + Playwright and the Vercel hosting are the same as `dj-radicalmix-web`. Beat detection is `dj-radicalmix-web/src/engine/analysis.ts` (`analyzeTrack` → `bpm`, `firstBeatSec`), lifted into a shared package.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Vite 8 + React 19 + TypeScript (SPA) | Matches `dj-radicalmix-web`. The editor is 100% client-heavy, so it gains nothing from SSR. |
| landing / SEO pages | Static Vite pages (prerendered) in the same app | One deploy. Next.js isn't needed for 5 marketing pages. |
| state | Zustand store + command pattern (immer patches for undo) | Undo/redo needs patches. Zustand is tiny, and selector subscriptions keep timeline renders cheap. |
| styling | CSS custom properties from `replica-design` tokens (`tokens.css`) + CSS modules | Same approach as the existing apps. No runtime CSS-in-JS on a 60 fps canvas page. |
| decode / encode | WebCodecs (`VideoDecoder`, `VideoEncoder`, `AudioEncoder`) | Hardware decode and encode in Chrome, Edge and Safari 17+. |
| demux / mux | Mediabunny (MPL-2.0, pure TS) | Reads MP4/MOV/WebM/MKV and writes MP4/WebM. Pairs with WebCodecs. One dependency. |
| compositor | WebGL2 (one shader pipeline: transform, opacity, LUT filter, chroma key, blend) with a Canvas2D text layer | Real-time at 1080p on laptops. Text and captions are drawn to an OffscreenCanvas texture. |
| audio | Web Audio (preview), `OfflineAudioContext` (export mix) | Volume, fades and speed (via `playbackRate` plus a pitch-preserve option later). |
| captions (ASR) | Whisper (`whisper-base` / `whisper-small`, MIT weights) via transformers.js in a Web Worker, WebGPU with a WASM fallback | Free to run and on-device. Word timestamps come out of the box. Server ASR is a later swap behind the same interface. |
| background removal | MediaPipe Selfie Segmentation (Apache-2.0) in a worker | Could-have. Runs per frame on the GPU. |
| beat detection | `analyzeTrack` from dj-radicalmix (moved to `packages/audio-analysis`) | Already unit-tested in this repo. Gives BPM plus first beat, and the beat grid follows from those. |
| local storage | OPFS (media blobs, derived waveforms/filmstrips) + IndexedDB via `idb` (projects, asset metadata) | Handles multi-GB files with no upload. `navigator.storage.persist()` is requested on first import. |
| database | Supabase Postgres | One managed database with auth and storage in the same place. RLS keeps the browser from needing an API server for CRUD. |
| auth | Supabase Auth (email magic link + Google OAuth) | Must-have S19. Anonymous use stays allowed: sign-in is only needed for sync and billing. |
| files | Supabase Storage (private buckets, signed URLs). Move `exports` to Cloudflare R2 if egress grows | 4 GiB/file cap is set in the bucket config. RLS on the folder `{user_id}/`. |
| payments | Stripe Checkout + Billing + Customer Portal | Self-serve cancellation in one click. That answers the biggest billing complaint in the recon (src 17). |
| email | Resend | Magic links (via Supabase SMTP), receipts, export-ready emails. |
| server functions | Supabase Edge Functions (Deno) | `create-checkout`, `billing-portal`, `stripe-webhook`, `export-request`. Small, next to the database. |
| render worker | Docker container on Fly.io: Node + FFmpeg + headless Chromium running the same compositor bundle | Handles 4K and long exports. It reuses the browser renderer so output matches preview. It scales to zero when the queue is empty. |
| jobs | Postgres queue (`export_jobs` + `claim_export_job` with `skip locked`) + Supabase `pg_cron` | No extra queue service needed at this scale. |
| hosting | Vercel (static SPA). Required headers: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` | COOP/COEP is needed for `SharedArrayBuffer` (WASM threads for Whisper fallback). |
| tests | Vitest (units), Playwright (e2e on Chromium with fake media) | Same as `dj-radicalmix-web`. |
| CI | GitHub Actions workflow scoped to `short-video-editor/**` | Same pattern as `dj-nexus-engine.yml`. |
| mobile | Phase 2: Capacitor wrapper of the same SPA. Native Media3 / AVFoundation export plugin if WebCodecs is too slow on the device | One codebase. Revisit after `/replica-diff` shows the web parity. |

Browser support for the editor: Chrome/Edge 114+, Safari 17.4+, Firefox 130+ (WebCodecs video). Anything else gets a clear message and the server-render path for export.

## Repo layout

```
short-video-editor/
  replica/                    recon, features, architecture, schema, design (never shipped)
  web/                        Vite app
    src/
      timeline/               types.ts, commands.ts, selectors.ts (pure, unit-tested)
      engine/                 decoder pool, frame cache, compositor (WebGL2), audio graph, exporter
      workers/                asr.worker.ts, segment.worker.ts, analyze.worker.ts, export.worker.ts
      storage/                opfs.ts, db.ts (IndexedDB), sync.ts (Supabase)
      features/               editor panels per S-ID (media, audio, text, captions, inspector, export ...)
      app/                    routes, shell, auth, billing
  supabase/
    migrations/0001_init.sql  = replica/schema.sql
    functions/                create-checkout, billing-portal, stripe-webhook, export-request
  render-worker/              Dockerfile, worker.ts (claims jobs, renders with headless compositor + ffmpeg mux)
packages/audio-analysis/      analyzeTrack moved from dj-radicalmix-web (both apps import it)
```

## Timeline document (the core data structure)

```ts
type Ms = number;                    // integer milliseconds, timeline time
interface Timeline {
  schema: 1;
  fps: 24 | 25 | 30 | 50 | 60;
  canvas: { width: number; height: number; background: string };  // from aspect ratio
  tracks: Track[];                   // render order: index 0 = bottom
  captions: CaptionTrack[];
  markers: { at: Ms; kind: 'beat' | 'user' }[];
}
interface Track { id: string; kind: 'main' | 'overlay' | 'text' | 'audio'; muted: boolean; locked: boolean; hidden: boolean; clips: Clip[] }
interface ClipBase {
  id: string; start: Ms; duration: Ms;           // placement on the timeline
  transitionIn?: { kind: string; duration: Ms };
  keyframes: Partial<Record<AnimProp, Keyframe[]>>;
}
interface MediaClip extends ClipBase {
  type: 'video' | 'image' | 'audio';
  assetId: string; in: Ms;                        // source in-point; out = in + duration * speed
  speed: number | { curve: [number, number][] };  // 0.1–100 or a curve (could-have)
  volume: number; fadeIn: Ms; fadeOut: Ms;
  transform: Transform; filter?: { lut: string; intensity: number };
  chromaKey?: { color: string; similarity: number; smoothness: number };
  cutout?: boolean;
}
interface TextClip extends ClipBase { type: 'text'; text: string; style: TextStyle; transform: Transform; animIn?: string; animOut?: string }
interface CaptionTrack { id: string; language: string; style: TextStyle; position: 'bottom' | 'middle' | 'top';
  cues: { id: string; start: Ms; end: Ms; text: string; words: { start: Ms; end: Ms; text: string }[] }[] }
```

Invariants (checked by `validateTimeline`, run in tests and before every save and export):
- clips on one track do not overlap; `duration > 0`;
- the `main` track is magnetic (no gaps) by default;
- source range is inside the asset: `in >= 0 && in + duration*avgSpeed <= asset.duration`;
- keyframe times are relative to the clip start and inside `[0, duration]`, and they are clamped on trim;
- caption cues are sorted and non-overlapping, and every word sits inside its cue.

Every edit is a `Command { do(t): Timeline; label: string }`. Undo/redo stores immer inverse patches (cap 200). Commands are pure functions, so each one gets a unit test.

## Schema

Tables: 7 (`profiles`, `subscriptions`, `stripe_events`, `projects`, `assets`, `export_jobs`, `templates`) + 4 private storage buckets. Access rules: **Postgres RLS on every table**. The service role is used only in Edge Functions and the render worker. See `schema.sql`.

Decisions:
- **The timeline is `projects.timeline jsonb`, not track/clip rows.** A drag creates dozens of changes per second, and the editor needs atomic snapshots for undo, export and server render. Relational rows would add N writes per edit and give nothing back, because nobody queries clips across projects. `timeline_version` + `save_timeline()` gives optimistic concurrency (a stale save returns `null` and the client shows "edited on another device: keep mine / load theirs").
- **Assets are deduped per user by `content_sha256`.** The same clip in 3 projects is uploaded once.
- **The storage quota is enforced in the database** (`track_storage` trigger), not just in the UI. Shrinks and deletes never fail, so account deletion always cascades.
- **`profiles.plan` can't be written by users.** Table update is revoked and only `display_name` is granted. Plan comes from the Stripe webhook alone.
- **`export_jobs` stores a `timeline_snapshot`.** The render is exactly what the user clicked, even if they keep editing. `(user_id, idempotency_key)` is unique, so a double click is one job.
- **Money**: `price_cents integer` + `currency`.
- **Times**: `timestamptz` (UTC) for records. Media times are integer ms in the timeline JSON.

Tested locally (Postgres 16 + Supabase auth/storage stubs):
- the owner can CRUD their own rows and another user sees 0 rows;
- writing as another user is rejected by RLS;
- a user can't upgrade their own plan;
- a stale `save_timeline` is rejected;
- the quota trigger blocks overflow;
- a user can't mark their own export `done` and can't call `claim_export_job`;
- the worker claim works;
- deleting an auth user cascades everything.

## API

Most CRUD is the Supabase client under RLS. There is no custom API server.

### F01 Make a vertical short (local-first: no network)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| local `projects.create` | new project with aspect + fps | anyone | `{name, aspect, fps}` | `Project` | F01 |
| local `assets.import` | copy file to OPFS, probe (Mediabunny), build filmstrip + waveform in worker | anyone | `File[]` | `Asset[]` (progress events) | F01 |
| local `timeline.apply(cmd)` | apply command, push undo, schedule autosave (500 ms debounce) | anyone | `Command` | `Timeline` | F01, F05 |
| local `analyze.beats` | `analyzeTrack` on decoded audio → beat markers | anyone | `assetId` | `{bpm, firstBeatMs, markers}` | F04 |
| local `export.browser` | render frames → VideoEncoder/AudioEncoder → MP4 → download | anyone | `{width,height,fps,format,burnCaptions}` | `Blob` | F01, F07 |

### F02 Captions

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| local `asr.transcribe` | mix the speech tracks to 16 kHz mono and run Whisper in the worker, returning word timestamps | anyone | `{language \| 'auto', range}` | `CaptionTrack` (progressive) | F02 |
| local `captions.exportSrt` / `exportVtt` | serialise cues | anyone | `captionTrackId` | text file | F02 |

### Sync and account (signed in)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET  /rest/v1/projects?select=id,name,aspect_ratio,updated_at,thumbnail_path&deleted_at=is.null&order=updated_at.desc` | project list | owner (RLS) | – | `Project[]` | S01 |
| `POST /rest/v1/projects` | create a cloud copy | owner | project row | `Project` | sync |
| `POST /rest/v1/rpc/save_timeline` | versioned save | owner | `{p_id, p_expected_version, p_timeline, p_duration_ms}` | new version \| `null` (conflict) | sync |
| `POST /storage/v1/object/media/{uid}/{assetId}` (TUS resumable) | upload media | owner | file | key | sync |
| `POST /rest/v1/assets` | register asset (quota enforced) | owner | asset row | `Asset` \| `P0001 storage quota exceeded` | sync |
| `GET  /rest/v1/templates?published=eq.true` | browse templates | anyone | – | `Template[]` | F03 |

### Billing (F08)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `POST /functions/v1/create-checkout` | Stripe Checkout session for a plan/period | signed-in user | `{plan, period}` | `{url}` | F08 |
| `POST /functions/v1/billing-portal` | Stripe Customer Portal (cancel, invoices, card) | signed-in user | – | `{url}` | F08 |
| `POST /functions/v1/stripe-webhook` | verify signature, insert into `stripe_events` (skip if dup), upsert `subscriptions`, set `profiles.plan` + quota | Stripe | event | 200 | F08 |

### Server export (F07, 4K / long / unsupported browser)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `POST /functions/v1/export-request` | check the plan allows the resolution, check every asset is uploaded, insert `export_jobs` with snapshot + idempotency key | signed-in user | `{projectId, width, height, fps, format, burnCaptions, idempotencyKey}` | `{jobId}` | F07 |
| `GET  /rest/v1/export_jobs?id=eq.{id}` + Realtime channel | progress | owner | – | `{status, progress, error}` | F07 |
| `PATCH /rest/v1/export_jobs?id=eq.{id}` `{status:'canceled'}` | cancel | owner | – | – | F07 |
| `POST /storage/v1/object/sign/exports/{uid}/{jobId}.mp4` | 24 h download link | owner | – | `{signedURL}` | F07 |

Webhooks in: Stripe (`checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`).
Webhooks out: none in v1.
Jobs (`pg_cron`):
- `export-reaper`, every 5 min: mark jobs `failed` that are `running`, older than 10 min and on `attempts >= 3`.
- `purge-deleted`, daily 03:17 UTC: hard-delete projects that have been soft-deleted for 30 days, and their orphaned storage objects.
- `expire-exports`, daily 03:29 UTC: delete export files older than 7 days.
- `reconcile-storage`, weekly: recompute `storage_used_bytes` from `assets`.

Only official, public APIs with the user's own keys (Stripe, Supabase, later TikTok Content Posting API / YouTube Data API). Never anything from the original app.

## The parts that bite

- **Codec coverage.** iPhone HEVC and 10-bit HDR don't decode in every browser. Probe with `VideoDecoder.isConfigSupported` on import. If it's unsupported, offer "convert on server" (signed-in) or show a clear message. Never fail silently on the timeline.
- **Variable frame rate.** Phone footage is VFR. Always seek by timestamp, never by frame index. The compositor asks for "the frame at t" and the decoder pool returns the nearest one ≤ t.
- **Decoder memory.** `VideoFrame`s are GPU-backed and must be `close()`d. Use a frame cache LRU (~1.5 s ahead, 0.5 s behind per active clip) and a decoder pool capped at 4 live decoders. A leak here means a tab crash after 2 minutes. Add a unit test plus a soak test in Playwright.
- **Audio/video sync.** The preview clock is the `AudioContext.currentTime`, and video frames follow it. Export is offline and frame-exact, so it has no drift.
- **Export reliability.** Use the Wake Lock API, warn on tab close, and write the encoded output to OPFS as it goes. A refresh resumes from the last keyframe chunk, so a 4-minute export isn't lost.
- **Idempotency.** Stripe events are deduped by `stripe_events.id`, export requests by `(user_id, idempotency_key)`, and uploads by `content_sha256`.
- **Races.** A save from two tabs/devices is handled by `timeline_version` (conflict prompt, never silent overwrite). The worker claim uses `for update skip locked`, so two workers never render one job.
- **File size limits.** Local: whatever OPFS quota the browser grants (`navigator.storage.estimate()`, shown in S20). Cloud: 4 GiB per file and the plan quota, both enforced in the database and the bucket.
- **Whisper cost and quality.** `whisper-base` is about 75 MB, cached after the first download. Real time is about 0.3× on WebGPU and about 2× on WASM. Warn before running on audio over 10 min, and process it in 30 s windows with 1 s overlap. Music-only audio gives "no speech found", which is a state in S07. Languages beyond English use `whisper-small` (about 250 MB) and need a download prompt.
- **Pricing gates must never hold an export hostage.** The paywall check runs when a Pro item is *added*, not at export. If a user downgrades, the project still exports and only the Pro items are flagged. This is the #1 complaint in the original's reviews (src 16).
- **Fonts and licences.** Ship only OFL fonts (self-hosted woff2), our own LUTs and effects, and our own templates. `replica-brand`'s sweep will block the deploy if anything of the original slips in.
- **Security.** Media files are untrusted: parse them only in workers and never inject filenames as HTML. Set a CSP: `default-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com; worker-src 'self' blob:`. Service-role keys live only in Edge Function and Fly secrets.
- **GDPR deletion.** Deleting a row in `auth.users` cascades every table (tested). Storage objects for that user prefix are removed by `purge-deleted`. Local data is erased from Settings → "Delete local data".
- **Time zones / DST.** Not a concern for media timing (integer ms). Record times are UTC `timestamptz`, shown in local time.

## Build order

1. **Vertical slice** (proves WebCodecs end to end, ugly is fine). Screens S01, S02, S03 (player + one video track), S16, S17. Tables: none (IndexedDB only). Routes: local `projects.create`, `assets.import`, `timeline.apply` (add, trim, split, delete), `export.browser` at 1080p30.
   Done when: drop 3 phone clips, cut them, and download an MP4 that plays in QuickTime and VLC. Duration within ±1 frame, audio in sync.
2. **Must-haves** (`features.csv`, 20 rows), by area:
   - timeline: multi-track, drag/reorder, snapping, ripple delete, zoom, scrub, undo/redo (S03)
   - text + captions: text clips (S06, S13), Whisper captions, edit list, style presets (S07)
   - audio: music track, volume, fades, mute (S05, S14)
   - speed: constant 0.1–100× (S12)
   - projects: list, thumbnails, autosave, aspect ratios (S01, S02)
   - export: progress, cancel, resume, download (S16, S17)
   Then run `/replica-design` tokens in, `/replica-test`, and `/replica-diff` (target: must = 100%).
3. **Should-haves** (15):
   - transform + keyframes (S12)
   - filters, transitions (S08, S09)
   - text animations
   - SRT export, split cue
   - beat markers + snap (F04, shared `audio-analysis` package)
   - voiceover record, extract audio (S05)
   - shortcuts
   - auth + cloud sync (S19, Supabase migration 0001)
   - templates (S11)
   - billing (S18, Stripe functions)
   Then the could-haves: speed curves, cutout, chroma key, auto reframe, TTS, noise reduction, stickers, server 4K render (Fly worker), share via official APIs.
4. **Fixes from replica-entrepreneur.** Pending `/replica-entrepreneur`. Already designed in from recon: no export hostage, one-click cancel through the Stripe portal, a local-first free tier with no watermark on manual exports.

## Pricing constraint for the architecture (finalised in `/replica-launch`)

| plan | gates | enforced where |
| --- | --- | --- |
| free | all must-haves, 1080p export, no watermark, local-only | client (no server cost exists) |
| creator | cloud sync + 50 GiB, templates, SRT, 4K browser export | `profiles.plan` + quota trigger + `export-request` |
| studio | server render (4K / long), 500 GiB, priority queue | `export-request` + worker queue order |
