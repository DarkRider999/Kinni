# NeonForge AI: Product & Technical Specification

> Cross-platform AI photo and video editor (Web, Android, iOS)
> Version 1.0 · Status: Ready for engineering kickoff

---

## Table of Contents

0. [Scope Decision: Content & Safety Policy](#0-scope-decision-content--safety-policy)
1. [Product Blueprint & Feature List](#1-product-blueprint--feature-list)
2. [UI/UX Flow & Screen Descriptions](#2-uiux-flow--screen-descriptions)
3. [Technical Architecture](#3-technical-architecture)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [AI Model Integration Plan](#6-ai-model-integration-plan)
7. [Processing Pipelines](#7-processing-pipelines)
8. [Batch Processing & Cloud Rendering](#8-batch-processing--cloud-rendering)
9. [Export System](#9-export-system)
10. [Security, Privacy & Compliance](#10-security-privacy--compliance)
11. [Monetization Plan](#11-monetization-plan)
12. [App Store & Play Store Listings](#12-app-store--play-store-listings)
13. [Marketing Strategy](#13-marketing-strategy)
14. [Delivery Roadmap & Team](#14-delivery-roadmap--team)
15. [Appendix: Model Licensing Matrix](#15-appendix-model-licensing-matrix)

---

## 0. Scope Decision: Content & Safety Policy

The brief asked for "no restriction to explicit content." **This spec does not include that requirement.** The app has face swap, video face swap, and outfit replacement. Without content limits, the same features become a tool for making non-consensual intimate imagery and sexual deepfakes of real people. That causes serious harm to the people depicted. It is also illegal in a growing number of jurisdictions (for example the US TAKE IT DOWN Act, the UK Online Safety Act, EU AI Act transparency duties, and Indian IT Rules deepfake provisions). It would also get the app **rejected or removed** from the App Store (Guideline 1.1.4) and Google Play (the Inappropriate Content and AI-Generated Content policies). Payment processors and cloud GPU providers ban it in their terms as well.

What the product does instead:

| Area | Policy |
|---|---|
| Sexual / nude output | Blocked. An NSFW classifier checks every input and every output. Outfit swap cannot remove clothing or make it more revealing than swimwear. |
| Minors | If the age estimator flags a likely minor (<18), face swap, expression edit, and outfit swap are blocked for that face. Enhancement and upscaling are still allowed. |
| Face swap consent | Source faces must be (a) the account holder, verified by a selfie liveness match, or (b) a person who has given recorded consent through an in-app consent link. Public-figure faces are blocked by a celebrity-match list. |
| Provenance | Every face-swap or outfit-swap output gets a C2PA content credential and an invisible watermark. Free-tier outputs also get a visible "AI-edited" badge. |
| Abuse handling | Report button, a 24h takedown SLA, hash-matching (PhotoDNA / StopNCII hashes) on uploads, and account bans for violations. |

All other requested features (enhancement, upscaling, face editing, face swap, outfit swap, backgrounds, batch processing, export) are fully specified below.

---

## 1. Product Blueprint & Feature List

### 1.1 Product Summary

| Item | Value |
|---|---|
| Name (working) | NeonForge AI |
| Platforms | Web (desktop + mobile web), Android 8.0+, iOS 15+ |
| Core value | Studio-grade AI photo and video editing, one file or thousands, with rendering done in the cloud |
| Target users | Content creators, YouTubers, social media managers, small studios, e-commerce sellers, wedding/event photographers |
| Modes | **Single Edit** (1 file, interactive preview) and **Batch Edit** (N files, same recipe, queued) |

### 1.2 Feature Matrix

Legend: 🟢 MVP (v1.0) · 🟡 v1.1 · 🔵 v1.2+

#### A. AI Enhancement & Upscaling

| Feature | Photo | Video | GIF | Phase |
|---|---|---|---|---|
| Auto-enhance (sharpness, clarity, color, denoise) | ✅ | ✅ | ✅ | 🟢 |
| Noise reduction (luma/chroma, strength 0–100) | ✅ | ✅ (temporal) | ✅ | 🟢 |
| Color correction (auto WB, exposure, contrast) | ✅ | ✅ | ✅ | 🟢 |
| Super-resolution 2x / 4x | ✅ | ✅ | ✅ | 🟢 |
| Super-resolution 8x (4x + 2x cascade) | ✅ | ✅ (≤720p source) | ✅ | 🟡 |
| HDR enhancement (single-image tone mapping) | ✅ | — | — | 🟢 |
| Color grading LUT presets (Cinematic, Teal-Orange, Film, Noir, Vivid) | ✅ | ✅ | ✅ | 🟢 |
| Motion stabilization | — | ✅ | ✅ | 🟢 |
| Frame interpolation (30→60 fps) | — | ✅ | ✅ | 🔵 |

#### B. AI Face Editing

| Feature | Photo | Video | GIF | Phase |
|---|---|---|---|---|
| Face detection + 478-point landmarks | ✅ | ✅ | ✅ | 🟢 |
| Face parsing / segmentation (skin, eyes, brows, lips, hair, beard) | ✅ | ✅ | ✅ | 🟢 |
| Face restoration (blur, compression artifacts) | ✅ | ✅ | ✅ | 🟢 |
| Skin smoothing (texture-preserving) + blemish removal | ✅ | ✅ | ✅ | 🟢 |
| Eye enhancement (brighten, sharpen, de-redness) | ✅ | ✅ | ✅ | 🟢 |
| Hair & beard enhancement (density, definition, color tone) | ✅ | ✅ | ✅ | 🟡 |
| Expression editing (smile, neutral, surprised, soft smile, closed-mouth) | ✅ | ✅ (short clips ≤15 s) | ✅ | 🟡 |
| Face swap image→image | ✅ | — | — | 🟢 |
| Face swap image→video | — | ✅ | ✅ | 🟢 |
| Face swap video→video (source identity from clip) | — | ✅ | ✅ | 🟡 |
| Multi-face selection (pick which face to swap/edit) | ✅ | ✅ | ✅ | 🟢 |
| Identity consistency across frames (tracking + embedding lock) | — | ✅ | ✅ | 🟢 |

#### C. AI Outfit Replacement (Dress Swap)

| Feature | Phase |
|---|---|
| Body pose + clothing region detection (upper, lower, full-body, dress) | 🟢 |
| Replace outfit from preset template | 🟢 |
| Replace outfit from user-uploaded garment reference image | 🟢 |
| Presets: Formal, Business Casual, Casual, Streetwear, Traditional (Saree, Kurta, Sherwani, Lehenga, Kimono, Hanbok, Kaftan), Party, Wedding, Sports, Winter, Uniform-style | 🟢 |
| Lighting/shadow harmonization + body-proportion preservation | 🟢 |
| Video outfit swap (≤30 s, tracked) | 🔵 |
| Color/pattern recolor of existing outfit (no regeneration) | 🟡 |

#### D. AI Background Editing

| Feature | Photo | Video | GIF | Phase |
|---|---|---|---|---|
| Background removal (transparent PNG/WebP, alpha matte) | ✅ | ✅ (green-screen out / alpha MOV) | ✅ | 🟢 |
| Replace with user-uploaded image/video | ✅ | ✅ | ✅ | 🟢 |
| Replace with AI-generated background (text prompt + style) | ✅ | ✅ (static bg) | ✅ | 🟢 |
| Background blur / bokeh (depth-aware, adjustable f-stop) | ✅ | ✅ | ✅ | 🟢 |
| Cinematic depth-of-field + rack focus (video) | ✅ | ✅ | — | 🟡 |
| Relight subject to match new background | ✅ | — | — | 🟡 |

#### E. Batch Processing

| Feature | Phase |
|---|---|
| Multi-select upload (up to 500 files/batch Pro, 50 Free) | 🟢 |
| Folder upload (web `webkitdirectory`, Android SAF, iOS Files) | 🟢 |
| Zip upload, auto-extracted server side | 🟡 |
| Apply one **Recipe** (ordered chain of edits) to all files | 🟢 |
| Per-file progress, status, retry, and cancel | 🟢 |
| Priority queue (Pro/Studio get faster lanes) | 🟢 |
| Background processing + push notification on completion | 🟢 |
| Download all as ZIP / send to cloud storage | 🟢 |
| Saved Recipes (reusable presets) | 🟢 |

#### F. File Support

| Type | Input | Output | Max size (Free / Pro / Studio) |
|---|---|---|---|
| Images | JPG, JPEG, PNG, WEBP, HEIC (converted) | JPG, PNG, WEBP | 20 MB / 100 MB / 200 MB |
| Videos | MP4 (H.264/H.265), MOV, AVI | MP4, MOV, GIF | 200 MB, 60 s / 2 GB, 10 min / 10 GB, 30 min |
| GIF | GIF (animated) | GIF, MP4, WEBP (animated) | 20 MB / 100 MB / 200 MB |

### 1.3 Automatic Model Selection ("Smart Mode")

Users choose **what** they want. The **Model Router** chooses **how** based on:
- Content analysis: face count and size, scene type (portrait, landscape, product, document, anime/illustration), noise level, blur score, resolution, and fps
- Tier and quota (quality lane vs. fast lane)
- Target output resolution and duration
- Current GPU pool load (falls back to faster models when queues are long)

Details are in [§6.3](#63-model-router-logic).

---

## 2. UI/UX Flow & Screen Descriptions

### 2.1 Design Language

| Token | Value |
|---|---|
| Theme | Dark-first "futuristic minimal". Optional light theme. |
| Background | `#07080D` (base), `#0E1117` (surface), `#161B24` (elevated) |
| Neon accents | Cyan `#00F0FF` (primary), Magenta `#FF2BD6` (secondary), Lime `#B6FF3B` (success), Amber `#FFB020` (warning), Red `#FF4D5E` (error) |
| Text | `#E8ECF3` primary, `#8A93A6` secondary |
| Glow | `box-shadow: 0 0 12px rgba(0,240,255,.45)` on focused and primary elements only |
| Typography | Inter / Space Grotesk (headings), JetBrains Mono (numbers, progress %) |
| Radius | 12 px cards, 999 px pills |
| Motion | 150–250 ms ease-out. Progress bars have a subtle animated gradient sheen. Respects `prefers-reduced-motion`. |
| Glassmorphism | Side panels: `backdrop-filter: blur(16px)` with 8% white border |
| Accessibility | WCAG 2.2 AA contrast. Neon colors are never the only signal (icons and labels too). Tap targets are 44 px or larger. |
| Icons | Lucide, 1.5 px stroke |

### 2.2 Navigation Map

```
Splash → Onboarding (3 slides + consent/terms) → Auth (Google / Apple / Email OTP)
                                                        │
                                                        ▼
┌────────────────────────── Home Dashboard ──────────────────────────┐
│  [Single Edit]   [Batch Edit]   Recent Projects   Saved Recipes     │
└───────┬───────────────┬──────────────────────────────────────┬──────┘
        ▼               ▼                                      ▼
   Upload (single)  Upload (multi/folder)                 Settings
        │               │                                  Account/Billing
        ▼               ▼
   Editor Workspace  Recipe Builder ─────► Batch Manager ──► Export
   ├ Enhance panel                          (queue, per-file   │
   ├ Face panel                              progress)         ▼
   ├ Face Swap panel                                      Save to device /
   ├ Dress Swap panel                                     Cloud / Share link
   └ Background panel
        │
        ▼
      Export
```

Bottom tab bar (mobile): **Home · Projects · Batch · Settings**. Web uses a left rail with the same items.

### 2.3 Screen Specifications

#### S1. Home Dashboard
- **Header:** avatar, credit meter (neon ring showing remaining credits for the month), notifications bell.
- **Hero quick actions:** two large glowing cards:
  - **Single Edit**: "One photo or video, live preview"
  - **Batch Edit**: "Apply one recipe to many files"
- **Quick tools row** (horizontal chips): Enhance · Upscale 4x · Remove BG · Face Swap · Dress Swap · Stabilize · Blur BG
- **Active Jobs strip:** mini progress cards for running batches (tap → Batch Manager).
- **Recent Projects grid:** thumbnails with type badge (IMG/VID/GIF) and status dot.
- **Saved Recipes:** horizontal list.
- **Empty state:** illustrated upload prompt with drag-drop zone (web).

#### S2. Upload Screen
- Tabs: **Photos · Videos · GIFs · Folder**
- Sources: device gallery, camera, Files/SAF, drag-drop (web), URL import, Google Drive / Dropbox / OneDrive pickers.
- Single mode: selecting a file goes straight to the editor.
- Batch mode: a multi-select grid with a count badge, total size, and estimated credits. Invalid files are shown greyed out with the reason (type/size/duration).
- Uploads are **resumable and chunked** (tus protocol), with a per-file progress ring and pause/resume.
- Client-side pre-checks: MIME sniffing, duration probe, and thumbnail generation.

#### S3. Editor Workspace
Layout (web / tablet landscape):

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Project name            Undo Redo   Compare ◧   Zoom 100%  Export ▶│
├──────┬──────────────────────────────────────────────┬───────────────┤
│ Tool │                                              │  Active Panel │
│ rail │            PREVIEW CANVAS                    │  (glass side  │
│      │   (before/after slider, face boxes overlay,  │   panel with  │
│ ✦ En │    mask overlay toggle)                      │   controls)   │
│ ☺ Fa │                                              │               │
│ ⇄ Sw │                                              │               │
│ 👕 Dr │                                              │               │
│ ▣ BG │                                              │               │
│ ⚙    ├──────────────────────────────────────────────┤               │
│      │ Timeline (video/GIF): scrubber, keyframes,    │ [Preview] [Apply]
│      │ face-track lanes, trim handles               │               │
├──────┴──────────────────────────────────────────────┴───────────────┤
│ Edit Stack: Enhance ✓ → Face Restore ✓ → BG Blur (pending) ⋮        │
└─────────────────────────────────────────────────────────────────────┘
```

On mobile, the side panel becomes a **bottom sheet** (peek / half / full) and the tool rail becomes a horizontal scroller above it.

Core behaviors:
- **Non-destructive edit stack.** Each operation is a node in the edit stack and can be reordered, toggled, or deleted. It becomes the Recipe JSON.
- **Fast preview:** the server renders a downscaled (≤1080 px long edge) preview, or for video a 3-second preview segment around the playhead. Final render happens at export.
- **Compare:** split slider, side-by-side, and press-and-hold toggle.
- **Mask overlay:** shows the detected face/clothing/background mask. Brush to refine (add/subtract).

#### S4. Enhancement Panel
- **Auto Enhance** toggle (one tap), with strength slider 0–100.
- Sections (collapsible):
  - *Detail:* Sharpness, Clarity, Texture
  - *Noise:* Denoise strength, Preserve detail
  - *Color:* Auto WB, Exposure, Contrast, Saturation, Vibrance, LUT picker (thumbnail strip)
  - *HDR (photo):* On/Off, Intensity, Highlight recovery, Shadow lift
  - *Upscale:* segmented control **1x · 2x · 4x · 8x**, Model: *Auto / Photo / Anime-Art / Face-priority*. Shows the output dimensions live (e.g., "1920×1080 → 7680×4320").
  - *Video only:* Stabilization (Off / Standard / Strong / Tripod-lock), Crop compensation %, Temporal denoise, Color grade LUT
- Credit estimate shown at the bottom.

#### S5. Face Panel (Face Editing)
- Detected faces are shown as circular thumbnails. Tap to select (multi-select allowed).
- **Restore:** Off / Natural / Strong, Fidelity slider (identity vs. quality)
- **Skin:** Smoothing 0–100, Blemish removal toggle, Keep texture toggle
- **Eyes:** Brighten, Sharpen, Remove red-eye
- **Hair & Beard:** Definition, Density, Tone (subtle)
- **Expression:** chips for Smile · Soft Smile · Neutral · Surprised · Serious, with an intensity slider
- Video: "Track across all frames" is on by default. Shows the track lanes on the timeline.

#### S6. Face Swap Panel
- **Mode selector:** Image→Image · Image→Video · Video→Video
- **Source face:** "Use my verified face" (default), "Invite consented person" (sends a consent link), or pick from *My Face Library* (consented faces only).
- **Target faces:** auto-detected in the target media. The user maps source→target (for multiple faces).
- Options: Blend strength, Match skin tone, Match lighting, Restore after swap (on), Keep expression of target (on).
- Safety banner: "Only swap faces you have permission to use. Outputs are labeled as AI-edited."
- A blocking modal appears if the minor/celebrity/NSFW checks fail, with the specific reason.

#### S7. Dress Swap Panel
- Region selector: Auto · Top · Bottom · Full outfit · Dress
- **Presets grid** by category tab (Formal, Casual, Traditional, Party, Wedding, Sports, Winter). Each preset has a thumbnail and a style prompt.
- **Upload garment:** a flat-lay or model photo of the garment. It is auto-segmented, and the user confirms the garment mask.
- Controls: Fit (Slim/Regular/Loose), Color override (picker), Pattern keep toggle, Lighting match (on), Keep accessories toggle.
- Variations: generate 1/2/4 variants. The user taps to pick the final one.

#### S8. Background Panel
- Mode chips: **Remove · Replace · Blur · Cinematic**
- Remove: edge refinement (hair detail), output alpha / white / color.
- Replace: *Upload* (image/video), *Library* (curated), *Generate* (prompt box + style chips: Studio, Nature, City Night, Neon, Beach, Office, Abstract). Auto relight toggle.
- Blur: Bokeh strength (f/1.4–f/16 simulated), Bokeh shape (circle/hex/anamorphic), Focus point (tap on canvas).
- Cinematic (video): depth-of-field with rack focus keyframes, letterbox 2.39:1, film grain.

#### S9. Recipe Builder (Batch)
- Shown after a batch upload. The user builds an ordered edit chain (same panels as the editor, in "recipe mode", with no per-file canvas).
- Preview on 3 sample files, randomly picked or chosen by the user.
- Per-media-type branches: e.g., "For videos also Stabilize."
- Face swap in a batch: one source face is applied to the primary (largest) face in each file, or to all faces.
- Output settings: format, resolution, naming pattern (`{original}_{recipe}_{n}`), and destination.
- Summary before submit: file count, estimated credits, and estimated time.

#### S10. Batch Manager
- Batch list: name, created, progress (e.g., 142/300), ETA, status pill (Queued / Running / Paused / Completed / Partially Failed / Cancelled).
- Batch detail: virtualized list/grid of files. Each row has a thumbnail, filename, stage label ("Upscaling 4x…"), a per-file progress bar (neon cyan fill, amber on retry, red on failure), and actions (Retry · Cancel · View · Download).
- Header actions: Pause all, Resume, Cancel remaining, Retry failed, Download completed (ZIP), Send to cloud.
- Filters: All / Running / Done / Failed. Sort by name, size, or status.
- Real-time updates over WebSocket (web) and SSE/push (mobile).

#### S11. Export Screen
- Format: JPG / PNG / WEBP (image), MP4 / MOV / GIF (video).
- Resolution: **SD 480p · HD 720p · Full HD 1080p · 4K 2160p · Original · Custom**. Options are disabled when they exceed the source × upscale capability (with a tooltip explaining why).
- Quality: slider (JPEG/WEBP quality, video CRF/bitrate presets: Small / Balanced / Max).
- Video: codec (H.264 / H.265 / ProRes 422 for MOV on Pro+), fps (source/24/30/60), audio keep/mute.
- GIF: fps (10/15/24), palette size, loop, dithering.
- Destination: **Save to device** · Google Drive · Dropbox · OneDrive · iCloud (iOS share sheet) · Copy share link (CDN, expiring).
- Metadata: strip EXIF/GPS (on by default), embed C2PA credential (always on for generative edits).

#### S12. Settings
- **Quality:** Default processing lane (Fast / Balanced / Max Quality), Default upscale model, Auto-enhance on import.
- **Output defaults:** Image format, Video format, Resolution, Naming pattern, Keep original audio.
- **Language:** English, Hindi, Spanish, Portuguese (BR), Indonesian, Arabic (RTL), French, German, Japanese, Korean. i18n via ICU message files.
- **Storage:** Auto-delete originals after N days (1/7/30), Connected cloud accounts.
- **Notifications:** Job complete, Batch complete, Promotions.
- **Privacy & Safety:** Face Library management (delete faces, revoke consent), Download my data, Delete account.
- **Account & Billing:** Plan, Credits, Invoices, Restore purchases.
- **Appearance:** Dark / Light / System, Reduce motion, Neon intensity.

### 2.4 Key User Flows

**Flow 1: Single photo enhance + upscale (≈4 taps)**
Home → Single Edit → pick photo → Enhance panel: Auto Enhance ON, Upscale 4x → Preview → Export (PNG, 4K) → Save to device.

**Flow 2: Batch product photos (background)**
Home → Batch Edit → Folder → 200 images → Recipe: Remove BG → Replace (white) → Enhance → Export WEBP 1080p → Submit → push notification when done → Download ZIP.

**Flow 3: Face swap image→video**
Home → Single Edit → pick video → Face Swap panel → Source: "My verified face" → map to target face #1 → Preview 3 s → Apply → Render (queued, cloud) → Export MP4 1080p.

**Flow 4: Dress swap with custom garment**
Editor → Dress Swap → Upload garment photo → confirm garment mask → Region: Top → Generate 4 variants → pick → Export.

---

## 3. Technical Architecture

### 3.1 Stack Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Mobile | **Flutter 3.x** (Dart) | One codebase for Android and iOS. Good canvas/GPU rendering for previews. Strong video player plugins. |
| Web | **Next.js 15 (React 19, TypeScript)** + Tailwind + Zustand + TanStack Query | SEO for the marketing site, fast editor SPA routes, and a large ecosystem |
| Shared design | Design tokens in JSON → generated to Dart and CSS variables (Style Dictionary) | Keeps neon theme identical everywhere |
| API Gateway | **Kong** or **Envoy** (or AWS API Gateway) | Auth, rate limiting, request size limits |
| Core API | **Python FastAPI** (async) | Same language as the AI stack, Pydantic schemas, auto OpenAPI → generated TS/Dart clients |
| Realtime | FastAPI WebSocket service + Redis Pub/Sub | Job progress fan-out |
| Queue | **Redis Streams** (via Celery or Dramatiq) for control-plane jobs. **RabbitMQ** optional for GPU task routing with priorities. | Priority lanes, retries, dead-lettering |
| Workflow orchestration | **Temporal** (recommended) or Celery canvas | Multi-stage video pipelines (split → process chunks → merge) with retries and durability |
| AI workers | Python 3.11, PyTorch 2.x, CUDA 12.x, TensorRT / ONNX Runtime-GPU, OpenCV, FFmpeg (NVENC) | GPU inference |
| Model serving | **NVIDIA Triton** for high-QPS models (detection, segmentation, upscale). Custom workers for diffusion. | Batching and GPU utilization |
| DB | **PostgreSQL 16** (+ pgvector for face embeddings, encrypted) | Relational data, JSONB for recipes |
| Cache | Redis 7 | Sessions, rate limits, progress |
| Object storage | S3-compatible (AWS S3 / Cloudflare R2 / GCS) | Media storage, lifecycle policies |
| CDN | **Cloudflare** or CloudFront with signed URLs | Fast downloads worldwide |
| Compute | Kubernetes (EKS/GKE) with a GPU node pool (L4 / A10G for most tasks, A100/H100 for diffusion and video) + **KEDA** autoscaling on queue depth. Burst to RunPod / Modal / Lambda Labs serverless GPUs. | Cost-efficient elastic GPU |
| Auth | Firebase Auth or Auth0 or Supabase Auth (OAuth: Google, Apple; email OTP) → JWT | Fast to integrate on mobile and web |
| Payments | Stripe (web), Google Play Billing, Apple StoreKit 2, reconciled by **RevenueCat** | Cross-platform entitlements |
| Observability | OpenTelemetry → Grafana (Tempo, Loki, Prometheus), Sentry, DCGM exporter for GPU metrics | End-to-end tracing |
| CI/CD | GitHub Actions → ArgoCD. Fastlane for mobile. Codemagic optional. | GitOps |
| IaC | Terraform + Helm | Reproducible environments |

### 3.2 Architecture Diagram

```
                           ┌───────────────────────────────────────────┐
                           │                 CLIENTS                   │
                           │  Flutter (Android/iOS)   Next.js (Web)    │
                           └──────────────┬───────────────┬────────────┘
                     HTTPS/WSS            │               │  tus resumable upload
                                          ▼               ▼
┌──────────────┐        ┌─────────────────────────────────────────────┐
│  Cloudflare  │◄──────►│          API GATEWAY (Kong/Envoy)           │
│  CDN + WAF   │        │ JWT auth · rate limit · size limits · CORS  │
└──────┬───────┘        └───────┬──────────────┬──────────────┬───────┘
       │ signed GET             │              │              │
       │                        ▼              ▼              ▼
       │              ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │              │  Core API    │ │ Upload Svc   │ │ Realtime Svc │
       │              │  (FastAPI)   │ │ (tusd → S3)  │ │ (WS/SSE)     │
       │              │ users,       │ └──────┬───────┘ └──────▲───────┘
       │              │ projects,    │        │                │ pub/sub
       │              │ recipes,     │        ▼                │
       │              │ billing      │ ┌──────────────┐ ┌──────┴───────┐
       │              └──┬────┬──────┘ │ Media Ingest │ │    Redis     │
       │                 │    │        │ probe, thumb,│ │ cache, rate, │
       │                 │    │        │ transcode,   │ │ progress     │
       │                 │    │        │ safety scan  │ └──────▲───────┘
       │                 │    │        └──────┬───────┘        │
       │                 ▼    ▼               ▼                │
       │        ┌────────────┐ ┌──────────────────────────┐    │
       │        │ PostgreSQL │ │ Orchestrator (Temporal)  │────┘
       │        │ + pgvector │ │ job DAGs, retries,       │
       │        └────────────┘ │ chunk fan-out / fan-in   │
       │                       └───────────┬──────────────┘
       │                                   │ enqueue by task type + priority
       │                                   ▼
       │           ┌───────────────────────────────────────────────┐
       │           │      TASK QUEUES (RabbitMQ / Redis Streams)   │
       │           │ q.cpu.video · q.gpu.light · q.gpu.heavy ·     │
       │           │ q.gpu.diffusion · q.safety   (priority 0-9)   │
       │           └───┬──────────┬───────────┬──────────┬─────────┘
       │               ▼          ▼           ▼          ▼
       │  ┌──────────────────── AI ENGINE (K8s GPU pool, KEDA) ─────────────┐
       │  │ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────┐ │
       │  │ │ Safety   │ │ Face Svc │ │ Enhance/  │ │ Gen Svc  │ │ Video │ │
       │  │ │ NSFW,age,│ │ detect,  │ │ Upscale   │ │ SDXL/    │ │ FFmpeg│ │
       │  │ │ celeb,   │ │ parse,   │ │ Real-ESRGAN│ │ FLUX-    │ │ OpenCV│ │
       │  │ │ hash     │ │ swap,    │ │ SwinIR,   │ │ schnell, │ │ split,│ │
       │  │ │          │ │ restore, │ │ denoise,  │ │ IP-Adapt,│ │ stab, │ │
       │  │ │          │ │ retouch  │ │ HDR       │ │ VTON,    │ │ merge,│ │
       │  │ │          │ │          │ │           │ │ inpaint  │ │ encode│ │
       │  │ └──────────┘ └──────────┘ └───────────┘ └──────────┘ └───────┘ │
       │  │      ▲ Triton Inference Server (TensorRT/ONNX) for light models │
       │  │      ▲ Model Registry (S3 + versioned weights, warm cache)      │
       │  └──────────────────────────────┬──────────────────────────────────┘
       │                                 │ write results
       │                                 ▼
       │                    ┌──────────────────────────┐
       └────────────────────│ Object Storage (S3/R2)   │
                            │ originals/ previews/     │
                            │ outputs/ (lifecycle TTL) │
                            └───────────┬──────────────┘
                                        │ optional export
                                        ▼
                         Google Drive · Dropbox · OneDrive (OAuth connectors)
```

### 3.3 Microservices

| Service | Language | Responsibility | Scales on |
|---|---|---|---|
| `api-core` | FastAPI | Auth context, users, projects, files, recipes, jobs CRUD, billing webhooks | HTTP RPS |
| `upload-svc` | tusd (Go) | Resumable chunked uploads → S3, post-finish hook | Concurrent uploads |
| `ingest-svc` | Python | ffprobe, MIME validation, thumbnail/preview proxy, HEIC→JPG, AVI→MP4 mezzanine, safety pre-scan | Queue depth |
| `orchestrator` | Temporal workers (Python) | Expands a Recipe into a DAG. Video chunking. Retries, compensation, credit settlement. | Workflow count |
| `realtime-svc` | FastAPI WS | Pushes progress events from Redis Pub/Sub | Connections |
| `safety-svc` | Python GPU (light) | NSFW, age estimation, celebrity match, CSAM/NCII hash match, output re-scan | Queue depth |
| `face-svc` | Python GPU | Detection, landmarks, parsing, tracking, swap, restore, retouch, expression | Queue depth |
| `enhance-svc` | Python GPU / Triton | Upscale, denoise, color, HDR, face-aware enhancement | Queue depth |
| `gen-svc` | Python GPU (24–80 GB VRAM) | Diffusion: BG generation, inpainting, outfit try-on, relighting | Queue depth |
| `video-svc` | Python CPU+GPU | Split/merge, stabilization, temporal consistency, encode (NVENC), GIF palette | Queue depth |
| `export-svc` | Python | Format conversion, resize, C2PA signing, watermark, ZIP bundling, cloud upload connectors | Queue depth |
| `notify-svc` | Node/Python | FCM/APNs push, email (SES/Resend) | Events |

### 3.4 Data Flow: Single Video Face Swap

1. The client uploads the target video (tus) → `upload-svc` → S3 `originals/{user}/{file}`.
2. `ingest-svc` probes the file (duration, fps, codec, resolution), creates a 480p proxy + thumbnails, and runs a safety pre-scan (sampled frames). It records a `files` row with `status=ready`.
3. The client calls `POST /v1/jobs` with a recipe `[{op:"face_swap", source_face_id, target_track:0, ...}]`.
4. `api-core` validates the entitlement, reserves credits, and inserts the `jobs` row. It then starts the Temporal workflow `FaceSwapVideoWorkflow`.
5. The workflow:
   a. `face-svc.detect_and_track` over the full video → face tracks, with an embedding per track.
   b. `safety-svc.check_faces` (age estimate per track, celeb match, consent check on the source face).
   c. Split the video into 4-second chunks (keyframe aligned, 8-frame overlap).
   d. Fan out `face-svc.swap_chunk` across N GPUs. It uses the **same source embedding** for all chunks, which keeps identity consistent.
   e. Temporal smoothing pass (landmark Kalman filter + optical-flow-guided blend on seams).
   f. `face-svc.restore` (GFPGAN) on the swapped region only.
   g. `video-svc.merge` + remux original audio + NVENC encode.
   h. `safety-svc.scan_output` + `export-svc.sign_c2pa` + watermark.
6. Progress events (`stage`, `pct`) go to Redis → `realtime-svc` → client.
7. Completion: the credit reservation is settled, `outputs` row is written, the CDN signed URL is issued, and a push notification is sent.

---

## 4. Database Schema

PostgreSQL 16. All IDs are `uuid` (v7 for time-ordering). Timestamps are `timestamptz`. Sensitive columns are encrypted with pgcrypto or envelope-encrypted via KMS.

### 4.1 ER Overview

```
users 1─┬─* projects 1─* project_files *─1 files
        ├─* files 1─* file_variants
        ├─* recipes
        ├─* batches 1─* jobs 1─* job_tasks
        │                 └─* outputs
        ├─1 user_settings
        ├─1 subscriptions
        ├─* credit_ledger
        ├─* face_identities 1─* face_consents
        ├─* cloud_connections
        ├─* devices (push tokens)
        └─* abuse_reports (as reporter)
models (registry) 1─* job_tasks
preset_templates (outfits, backgrounds, LUTs)
```

### 4.2 DDL

```sql
-- ============ USERS & AUTH ============
CREATE TABLE users (
  id               uuid PRIMARY KEY,
  auth_provider    text NOT NULL,            -- 'google' | 'apple' | 'email'
  auth_subject     text NOT NULL,            -- provider user id
  email            citext UNIQUE,
  display_name     text,
  avatar_url       text,
  country_code     char(2),
  birth_year       smallint,                 -- age gate (must be 18+ for face swap / dress swap)
  face_verified    boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'active', -- active|suspended|banned|deleted
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (auth_provider, auth_subject)
);

CREATE TABLE user_settings (
  user_id                uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language               text NOT NULL DEFAULT 'en',
  theme                  text NOT NULL DEFAULT 'dark',
  quality_lane           text NOT NULL DEFAULT 'balanced', -- fast|balanced|max
  default_image_format   text NOT NULL DEFAULT 'jpg',       -- jpg|png|webp
  default_video_format   text NOT NULL DEFAULT 'mp4',       -- mp4|mov|gif
  default_resolution     text NOT NULL DEFAULT 'original',  -- sd|hd|fhd|4k|original
  naming_pattern         text NOT NULL DEFAULT '{original}_{recipe}',
  strip_metadata         boolean NOT NULL DEFAULT true,
  auto_delete_days       smallint NOT NULL DEFAULT 30,
  notify_job_complete    boolean NOT NULL DEFAULT true,
  notify_marketing       boolean NOT NULL DEFAULT false,
  extra                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform     text NOT NULL,           -- android|ios|web
  push_token   text,
  app_version  text,
  last_seen_at timestamptz
);

-- ============ BILLING ============
CREATE TABLE plans (
  id                 text PRIMARY KEY,   -- free|pro_monthly|pro_yearly|studio_monthly|...
  name               text NOT NULL,
  monthly_credits    int NOT NULL,
  max_batch_files    int NOT NULL,
  max_video_seconds  int NOT NULL,
  max_output_res     text NOT NULL,      -- hd|fhd|4k|8k
  priority           smallint NOT NULL,  -- queue priority 0-9
  watermark          boolean NOT NULL,
  features           jsonb NOT NULL      -- feature flags
);

CREATE TABLE subscriptions (
  id                 uuid PRIMARY KEY,
  user_id            uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id            text NOT NULL REFERENCES plans(id),
  store              text NOT NULL,      -- stripe|app_store|play_store
  store_sub_id       text,
  status             text NOT NULL,      -- active|trialing|past_due|canceled|expired
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE credit_ledger (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       int NOT NULL,             -- +grant / -spend / reservation hold
  kind        text NOT NULL,            -- monthly_grant|purchase|reserve|settle|refund|bonus
  job_id      uuid,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON credit_ledger (user_id, created_at DESC);

-- ============ FILES & PROJECTS ============
CREATE TABLE files (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind             text NOT NULL,        -- image|video|gif
  original_name    text NOT NULL,
  mime_type        text NOT NULL,
  size_bytes       bigint NOT NULL,
  storage_key      text NOT NULL,        -- s3 key of original
  proxy_key        text,                 -- preview proxy
  thumb_key        text,
  width            int,
  height           int,
  duration_ms      int,
  fps              numeric(6,3),
  codec            text,
  has_audio        boolean,
  frame_count      int,
  sha256           bytea NOT NULL,
  perceptual_hash  bytea,                -- pHash for abuse hash matching
  analysis         jsonb,                -- face count, scene type, noise/blur scores
  safety_status    text NOT NULL DEFAULT 'pending', -- pending|clear|flagged|blocked
  status           text NOT NULL DEFAULT 'uploading', -- uploading|processing|ready|failed|deleted
  expires_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON files (user_id, created_at DESC);

CREATE TABLE projects (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  mode          text NOT NULL,           -- single|batch
  cover_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  edit_stack    jsonb NOT NULL DEFAULT '[]', -- current non-destructive stack (single mode)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE project_files (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  file_id    uuid REFERENCES files(id) ON DELETE CASCADE,
  position   int NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, file_id)
);

-- ============ RECIPES / PRESETS ============
CREATE TABLE recipes (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE, -- NULL = system recipe
  name        text NOT NULL,
  steps       jsonb NOT NULL,           -- see §5.4 Recipe schema
  output      jsonb NOT NULL,           -- format, resolution, quality
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE preset_templates (
  id          text PRIMARY KEY,         -- e.g. outfit.traditional.saree_silk_red
  category    text NOT NULL,            -- outfit|background|lut|expression
  subcategory text,                     -- formal|casual|traditional|party|...
  name        jsonb NOT NULL,           -- i18n {en:..., hi:...}
  thumb_url   text NOT NULL,
  payload     jsonb NOT NULL,           -- prompt, ref image keys, LUT key, params
  tier        text NOT NULL DEFAULT 'free', -- free|pro
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0
);

-- ============ FACE IDENTITIES & CONSENT ============
CREATE TABLE face_identities (
  id              uuid PRIMARY KEY,
  owner_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           text,                 -- "Me", "Priya"
  kind            text NOT NULL,        -- self|consented_other
  embedding_enc   bytea NOT NULL,       -- ArcFace 512-d, KMS envelope-encrypted
  ref_image_key   text NOT NULL,
  liveness_passed boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'active', -- active|revoked|deleted
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE face_consents (
  id               uuid PRIMARY KEY,
  face_identity_id uuid NOT NULL REFERENCES face_identities(id) ON DELETE CASCADE,
  subject_email    citext,
  subject_user_id  uuid REFERENCES users(id),
  token_hash       bytea NOT NULL,      -- consent link token
  scope            text NOT NULL DEFAULT 'face_swap',
  granted_at       timestamptz,
  revoked_at       timestamptz,
  expires_at       timestamptz,
  evidence         jsonb                -- liveness session id, IP, UA, timestamp
);

-- ============ JOBS ============
CREATE TABLE batches (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  recipe_id     uuid REFERENCES recipes(id),
  recipe_snapshot jsonb NOT NULL,       -- immutable copy used for this run
  name          text,
  total_files   int NOT NULL,
  done_files    int NOT NULL DEFAULT 0,
  failed_files  int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'queued', -- queued|running|paused|completed|partial|cancelled|failed
  priority      smallint NOT NULL,
  credits_reserved int NOT NULL DEFAULT 0,
  credits_spent    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
CREATE INDEX ON batches (user_id, created_at DESC);

CREATE TABLE jobs (
  id             uuid PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id       uuid REFERENCES batches(id) ON DELETE CASCADE, -- NULL for single edits
  file_id        uuid NOT NULL REFERENCES files(id),
  kind           text NOT NULL,         -- preview|render
  steps          jsonb NOT NULL,        -- resolved recipe steps incl. chosen models
  output_spec    jsonb NOT NULL,
  status         text NOT NULL DEFAULT 'queued', -- queued|running|succeeded|failed|cancelled|blocked
  stage          text,                  -- human label of current stage
  progress       real NOT NULL DEFAULT 0, -- 0..1
  attempt        smallint NOT NULL DEFAULT 0,
  error_code     text,
  error_message  text,
  workflow_id    text,                  -- Temporal workflow id
  gpu_seconds    real,
  credits_cost   int,
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
CREATE INDEX ON jobs (batch_id, status);
CREATE INDEX ON jobs (user_id, created_at DESC);

CREATE TABLE job_tasks (                -- per stage / per chunk telemetry
  id           bigserial PRIMARY KEY,
  job_id       uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  op           text NOT NULL,           -- upscale|face_swap|bg_remove|...
  model_id     text REFERENCES models(id),
  chunk_index  int,
  status       text NOT NULL,
  worker_node  text,
  gpu_type     text,
  duration_ms  int,
  started_at   timestamptz,
  finished_at  timestamptz,
  meta         jsonb
);

CREATE TABLE outputs (
  id            uuid PRIMARY KEY,
  job_id        uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_index smallint NOT NULL DEFAULT 0, -- for multi-variant generations
  storage_key   text NOT NULL,
  format        text NOT NULL,
  width         int, height int, duration_ms int,
  size_bytes    bigint,
  c2pa_manifest jsonb,
  watermarked   boolean NOT NULL,
  safety_status text NOT NULL,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE file_variants (           -- cached intermediate/preview renders
  id          uuid PRIMARY KEY,
  file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  stack_hash  bytea NOT NULL,           -- hash of edit stack prefix → cache hit
  storage_key text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, stack_hash)
);

-- ============ MODELS REGISTRY ============
CREATE TABLE models (
  id            text PRIMARY KEY,       -- e.g. realesrgan_x4plus@1.0
  task          text NOT NULL,          -- upscale|face_restore|face_swap|bg_remove|...
  version       text NOT NULL,
  runtime       text NOT NULL,          -- triton_trt|onnx|torch|diffusers
  min_vram_gb   smallint NOT NULL,
  license       text NOT NULL,
  commercial_ok boolean NOT NULL,
  weights_uri   text NOT NULL,
  enabled       boolean NOT NULL DEFAULT true,
  quality_score real, speed_score real,
  params        jsonb NOT NULL DEFAULT '{}'
);

-- ============ INTEGRATIONS & TRUST/SAFETY ============
CREATE TABLE cloud_connections (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      text NOT NULL,          -- gdrive|dropbox|onedrive
  account_email text,
  refresh_token_enc bytea NOT NULL,
  scopes        text[],
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE TABLE safety_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id),
  file_id     uuid, job_id uuid, output_id uuid,
  check_type  text NOT NULL,            -- nsfw|minor|celebrity|hash_match|consent
  verdict     text NOT NULL,            -- pass|block|review
  score       real,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE abuse_reports (
  id            uuid PRIMARY KEY,
  reporter_id   uuid REFERENCES users(id),
  reporter_email citext,
  target_output_id uuid REFERENCES outputs(id),
  target_url    text,
  reason        text NOT NULL,          -- ncii|impersonation|minor|other
  details       text,
  status        text NOT NULL DEFAULT 'open', -- open|actioned|dismissed
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
```

### 4.3 Retention Policy

| Object | Free | Pro | Studio |
|---|---|---|---|
| Originals | 7 days | 30 days | 90 days |
| Outputs | 7 days | 30 days | 90 days (or until deleted) |
| Previews/variants | 24 h | 24 h | 24 h |
| Face embeddings | Until user deletes or revokes consent (hard delete within 24 h) | same | same |

---

## 5. API Endpoints

Base URL: `https://api.neonforge.ai/v1`. Auth: `Authorization: Bearer <JWT>`. JSON uses snake_case. The OpenAPI 3.1 spec is generated by FastAPI, and TypeScript and Dart clients are generated with `openapi-generator`.

Errors use the format `{ "error": { "code": "QUOTA_EXCEEDED", "message": "...", "details": {} } }`.

### 5.1 Auth & User

| Method | Path | Description |
|---|---|---|
| POST | `/auth/exchange` | Exchange a Firebase/Auth0 ID token for the app JWT and refresh token |
| POST | `/auth/refresh` | Rotate the refresh token |
| POST | `/auth/logout` | Revoke the refresh token and device push token |
| GET | `/me` | Profile, plan, credits balance, feature flags |
| PATCH | `/me` | Update display name, avatar, country, birth year |
| DELETE | `/me` | Schedule account deletion (hard delete in 7 days, GDPR) |
| GET | `/me/export` | Request a data export (async, emailed link) |
| GET / PUT | `/me/settings` | Read or update user settings |
| POST | `/me/devices` | Register a push token |

### 5.2 Face Verification & Consent

| Method | Path | Description |
|---|---|---|
| POST | `/faces/verify-self` | Start a liveness session (returns SDK session token). On success, creates a `self` face identity. |
| GET | `/faces` | List the user's face library (consented identities only) |
| POST | `/faces/consent-requests` | Create a consent link for another person `{email?, label}` |
| GET | `/consent/{token}` | Public page: subject sees the request and completes liveness + consent |
| POST | `/consent/{token}/accept` | Subject grants consent and their face identity is created |
| POST | `/faces/{id}/revoke` | Revoke (owner or subject). Future jobs are blocked. |
| DELETE | `/faces/{id}` | Hard delete the embedding and reference image |

### 5.3 Files & Uploads

| Method | Path | Description |
|---|---|---|
| POST | `/uploads` | tus creation endpoint (`Upload-Length`, `Upload-Metadata: filename, mime, project_id`) |
| PATCH | `/uploads/{id}` | tus chunk upload |
| HEAD | `/uploads/{id}` | tus resume offset |
| POST | `/files/import-url` | Import from a URL or cloud-picker file id |
| POST | `/files/import-zip` | Upload a zip, which is expanded server side (batch) |
| GET | `/files` | List files (`?kind=&project_id=&cursor=`) |
| GET | `/files/{id}` | Metadata, analysis, safety status, signed proxy/thumb URLs |
| POST | `/files/{id}/analyze` | Force re-analysis (faces, scene, quality) |
| GET | `/files/{id}/faces` | Detected faces/tracks with boxes, thumbnails, and track ids |
| GET | `/files/{id}/masks?type=person\|clothing\|background\|face_parts` | Signed URL to the segmentation mask |
| DELETE | `/files/{id}` | Delete the file and its derivatives |

### 5.4 Projects & Recipes

| Method | Path | Description |
|---|---|---|
| GET / POST | `/projects` | List or create projects |
| GET / PATCH / DELETE | `/projects/{id}` | Read, rename, update the edit stack, or delete |
| POST | `/projects/{id}/files` | Attach files |
| GET / POST | `/recipes` | List (own + system) or create a recipe |
| GET / PUT / DELETE | `/recipes/{id}` | CRUD |
| POST | `/recipes/estimate` | `{recipe, file_ids}` → credits, ETA, resolved models per file |
| GET | `/presets?category=outfit&subcategory=traditional` | Preset templates (outfits, backgrounds, LUTs, expressions) |

**Recipe schema (JSON):**

```json
{
  "version": 1,
  "steps": [
    { "op": "enhance",  "params": { "auto": true, "strength": 70, "denoise": 40, "hdr": false } },
    { "op": "upscale",  "params": { "scale": 4, "model": "auto" } },
    { "op": "face_restore", "params": { "fidelity": 0.7, "faces": "all" } },
    { "op": "face_retouch", "params": { "smooth": 35, "blemish": true, "eyes": 20 } },
    { "op": "face_swap", "params": { "source_face_id": "uuid", "target": "largest", "blend": 0.9 } },
    { "op": "expression", "params": { "type": "smile", "intensity": 0.5, "faces": [0] } },
    { "op": "outfit_swap", "params": { "region": "upper", "preset_id": "outfit.formal.navy_suit", "garment_file_id": null, "variants": 2 } },
    { "op": "background", "params": { "mode": "replace", "source": "generate", "prompt": "neon city night, bokeh", "relight": true } },
    { "op": "background", "params": { "mode": "blur", "aperture": 1.8, "shape": "circle" } },
    { "op": "stabilize", "params": { "strength": "standard", "crop_pct": 8 } },
    { "op": "color_grade", "params": { "lut": "cinematic_teal_orange", "intensity": 0.6 } }
  ],
  "branches": { "video": [ { "op": "stabilize", "params": { "strength": "standard" } } ] },
  "output": { "image_format": "webp", "video_format": "mp4", "resolution": "fhd", "quality": "balanced", "strip_metadata": true }
}
```

### 5.5 Jobs & Batches

| Method | Path | Description |
|---|---|---|
| POST | `/previews` | Fast preview `{file_id, steps, at_ms?}` → `{job_id}`. Result is a low-res image or a 3 s clip. Cached by stack hash. |
| POST | `/jobs` | Single render `{file_id, recipe \| recipe_id, output}` → job |
| GET | `/jobs/{id}` | Status, stage, progress, outputs |
| POST | `/jobs/{id}/cancel` | Cancel a job and refund the unspent reservation |
| POST | `/jobs/{id}/retry` | Retry a failed job |
| POST | `/batches` | `{file_ids \| project_id, recipe \| recipe_id, name, output}` → batch (creates N jobs) |
| GET | `/batches` | List batches |
| GET | `/batches/{id}` | Aggregate status + counts |
| GET | `/batches/{id}/jobs?status=&cursor=` | Per-file job list |
| POST | `/batches/{id}/pause` · `/resume` · `/cancel` · `/retry-failed` | Batch controls |
| GET | `/batches/{id}/download` | Builds a ZIP (async) → signed CDN URL |
| WS | `/ws?token=` | Subscribe to `job.*` and `batch.*` events |
| GET | `/events/stream` (SSE) | Fallback for mobile/web without WS |

**Progress event:**

```json
{ "type": "job.progress", "job_id": "…", "batch_id": "…", "status": "running",
  "stage": "face_swap", "stage_label": "Swapping faces (chunk 7/12)",
  "progress": 0.58, "eta_s": 41, "ts": "2026-09-24T10:12:03Z" }
```

### 5.6 Outputs & Export

| Method | Path | Description |
|---|---|---|
| GET | `/outputs/{id}` | Metadata + signed CDN URL (expires 1 h) |
| POST | `/outputs/{id}/export` | Re-encode to another format/resolution `{format, resolution, quality, fps?}` |
| POST | `/outputs/{id}/share` | Create an expiring public share link (7 days, revocable) |
| DELETE | `/outputs/{id}` | Delete |
| GET | `/integrations` | Connected cloud providers |
| GET | `/integrations/{provider}/connect` | OAuth start (Google Drive / Dropbox / OneDrive) |
| POST | `/integrations/{provider}/push` | `{output_ids \| batch_id, folder_path}` → async upload |
| DELETE | `/integrations/{provider}` | Disconnect |

### 5.7 Billing

| Method | Path | Description |
|---|---|---|
| GET | `/billing/plans` | Plans + localized prices |
| POST | `/billing/checkout` | Stripe Checkout session (web) |
| POST | `/billing/portal` | Stripe customer portal |
| POST | `/billing/credits/purchase` | One-off credit packs |
| POST | `/webhooks/stripe` · `/webhooks/revenuecat` | Entitlement sync (signature verified) |
| GET | `/billing/ledger` | Credit history |

### 5.8 Safety & Admin

| Method | Path | Description |
|---|---|---|
| POST | `/reports` | Public abuse report (no auth required, captcha) |
| GET | `/admin/reports` · PATCH `/admin/reports/{id}` | Moderation queue (admin role) |
| GET | `/admin/models` · PATCH `/admin/models/{id}` | Enable/disable models, A/B weights |
| GET | `/admin/queues` | Queue depth, GPU utilization, p95 latencies |
| GET | `/health` · `/ready` | Probes |

### 5.9 Rate Limits

| Tier | API req/min | Concurrent jobs | Concurrent batch files in flight |
|---|---|---|---|
| Free | 60 | 1 | 2 |
| Pro | 240 | 3 | 10 |
| Studio | 600 | 10 | 50 |

---

## 6. AI Model Integration Plan

### 6.1 Strategy

1. **Self-host open-weight models on our GPU pool** by default. The models are free to download, but GPU compute is our main cost. Hosted "free" inference APIs (Hugging Face Inference, Replicate free credits) are rate-limited and not suitable for production batch traffic. Use them **only** for prototyping and as overflow fallback.
2. **Check every model's license for commercial use** before launch. Several popular models (InsightFace `inswapper`, CodeFormer, FLUX.1-dev) are **non-commercial**. They are marked below with a commercial-safe replacement. See [§15](#15-appendix-model-licensing-matrix).
3. Wrap each model behind a uniform `ModelAdapter` interface so the router can swap models without client changes:

```python
class ModelAdapter(Protocol):
    id: str; task: str; min_vram_gb: int
    def load(self, device: str) -> None: ...
    def infer(self, inputs: TaskInput, params: dict) -> TaskOutput: ...
    def estimate_cost(self, meta: MediaMeta, params: dict) -> float: ...  # GPU-seconds
```

### 6.2 Feature → Model Map

| Feature | Primary model | Alternative / fallback | Runtime | GPU |
|---|---|---|---|---|
| **Face detection** | **MediaPipe Face Detector** + Face Landmarker (478 pts) | RetinaFace / SCRFD (InsightFace det, MIT code) for small/occluded faces | TFLite on CPU / ONNX GPU | CPU or L4 |
| **Face tracking (video)** | SCRFD per frame + **ByteTrack** + ArcFace embedding re-ID | DeepSORT | ONNX | L4 |
| **Face parsing** | **BiSeNet face-parsing** (CelebAMask-HQ, 19 classes) | SegFormer-face | ONNX/TRT | L4 |
| **Face identity embedding** | **ArcFace (buffalo_l)**, research use. **Commercial:** AdaFace or a licensed InsightFace commercial package | FaceNet (MIT) | ONNX | L4 |
| **Face restoration** | **GFPGAN v1.4** (Apache-2.0) | CodeFormer (quality, **non-commercial**). RestoreFormer++. | Torch/TRT | L4 |
| **Face swap (image)** | **InsightFace inswapper_128** (non-commercial) → **commercial:** licensed InsightFace model, **SimSwap** (license check), or **FaceFusion**-style pipeline with in-house trained swapper | Ghost, HifiFace (research) | ONNX/TRT | L4/A10G |
| **Face swap (video)** | Swapper above + tracking + temporal smoothing + GFPGAN post | **LivePortrait**-guided refinement for expression retention | ONNX + Torch | A10G |
| **Skin smoothing / blemish** | Face parsing mask → frequency separation + guided filter (OpenCV). Blemish: small-object detection + **LaMa** inpainting (Apache-2.0) | SD inpaint at low denoise | OpenCV + Torch | L4 |
| **Eye / hair / beard enhance** | Parsing masks → local CLAHE, unsharp mask, color tone. Hair matting with **MODNet**. | GFPGAN local | OpenCV + ONNX | L4 |
| **Expression editing** | **LivePortrait** (MIT) driven by expression template keypoints | SD + ControlNet (face landmarks) inpainting of mouth/eye region | Torch | A10G |
| **Image upscale (general)** | **Real-ESRGAN x4plus** / x2plus (BSD-3) | **SwinIR** / HAT (quality lane), **4x-UltraSharp** community model (check license) | TRT | L4 |
| **Image upscale (anime/art)** | Real-ESRGAN x4plus_anime_6B | Real-CUGAN | TRT | L4 |
| **8x upscale** | Real-ESRGAN x4 → x2 cascade with face restore between passes | SD x4 upscaler (diffusion, Max lane) | TRT | A10G |
| **Video upscale** | **Real-ESRGAN (animevideov3 / general)** per frame + temporal consistency filter | **BasicVSR++** / RealBasicVSR (Apache-2.0) for temporal SR | TRT/Torch | A10G/A100 |
| **Denoise (photo)** | **NAFNet** (MIT) / **Restormer** | OpenCV fastNlMeans (Fast lane) | TRT | L4 |
| **Denoise (video)** | FFmpeg `hqdn3d` / `nlmeans` (Fast), **FastDVDnet** (Quality) | BasicVSR++ denoise | Torch | L4 |
| **Color correction / auto-enhance** | Learned 3D LUT (**Image-Adaptive-3DLUT**, Apache-2.0) + gray-world WB | Rule-based histogram stretch | Torch/ONNX | L4/CPU |
| **HDR (photo)** | Single-image exposure fusion (Mertens on synthetic brackets) + **HDRUNet** / local tone mapping | OpenCV `createTonemapReinhard` | OpenCV + Torch | L4 |
| **Video stabilization** | FFmpeg **vid.stab** (2-pass) | OpenCV feature-based (ORB + RANSAC affine, L1 path smoothing). DUT/DIFRINT for Max lane. | CPU | CPU |
| **Color grading (video)** | FFmpeg `lut3d` with .cube presets + auto-match (histogram) | — | CPU/NVENC | CPU |
| **Background removal (photo)** | **BiRefNet** (MIT), top-quality dichotomous segmentation | **rembg** (U²-Net / ISNet, MIT), RMBG-1.4 (**non-commercial**, avoid) | ONNX/TRT | L4 |
| **Background removal (video)** | **RobustVideoMatting** (GPL-3.0 → run as isolated service or replace) / **MODNet** (Apache-2.0) | SAM 2 (Apache-2.0) video propagation | Torch | A10G |
| **Depth estimation** | **Depth Anything V2 Small** (Apache-2.0) | MiDaS 3.1 (MIT) | TRT | L4 |
| **Bokeh / DoF** | Depth map → layered disparity-based lens blur (custom CUDA / OpenCV), shape kernels | — | CUDA | L4 |
| **AI background generation** | **SDXL 1.0** (OpenRAIL++) or **FLUX.1-schnell** (Apache-2.0) | SD 1.5 (Fast lane) | diffusers + TRT | A10G/A100 |
| **Subject relighting** | **IC-Light** (Apache-2.0) foreground-conditioned relight | Color-transfer harmonization (Fast) | diffusers | A10G |
| **Human parsing (clothing)** | **SCHP** (Self-Correction Human Parsing, ATR/LIP) + **SAM 2** refine | SegFormer-b2-clothes | Torch/ONNX | L4 |
| **Pose / body** | **DWPose** / MediaPipe Pose | OpenPose | ONNX | L4 |
| **Outfit swap (virtual try-on)** | **IDM-VTON** (CC BY-NC-SA → non-commercial) → **commercial:** in-house **SDXL inpainting + IP-Adapter (garment) + ControlNet (DWPose + depth)** pipeline | CatVTON, OOTDiffusion (both non-commercial, research only) | diffusers | A100 (24 GB+) |
| **Outfit from preset (text)** | SDXL inpainting + ControlNet OpenPose/Depth + preset prompt + preset garment IP-Adapter ref | FLUX.1-Fill (check license) | diffusers | A10G/A100 |
| **Temporal consistency (generative video)** | Optical flow (**RAFT**, BSD) warping + keyframe diffusion + EbSynth-style propagation | AnimateDiff for short clips | Torch | A100 |
| **GIF processing** | Decode with Pillow/FFmpeg → treat as video pipeline → `palettegen`/`paletteuse` with a **global palette** across frames for consistency | gifski (quality encoder) | CPU | CPU |
| **Safety: NSFW** | **Falconsai nsfw_image_detection** (Apache-2.0) + **NudeNet** detector | OpenAI CLIP-based safety head (SD safety checker) | ONNX | L4 |
| **Safety: age estimation** | MiVOLO (check license) / commercial age estimation API (Yoti, AWS Rekognition) | FairFace age classifier | ONNX | L4 |
| **Safety: celebrity match** | ArcFace embedding vs. curated public-figure index (pgvector / FAISS) | AWS Rekognition RecognizeCelebrities | ONNX | L4 |
| **Safety: known abuse hashes** | PhotoDNA (Microsoft, free for qualified orgs) + StopNCII hash list + PDQ (Meta, BSD) | — | CPU | CPU |
| **Liveness (face verify)** | AWS Rekognition Face Liveness / FaceTec / iProov | On-device MediaPipe + challenge-response (MVP) | SDK | — |

### 6.3 Model Router Logic

```python
def route(op: str, meta: MediaMeta, params: dict, lane: Lane) -> list[ModelSpec]:
    if op == "upscale":
        base = ("realesrgan_x4plus_anime" if meta.scene == "anime"
                else "hat_l_x4" if lane == "max" and meta.megapixels <= 4
                else "realesrgan_x4plus")
        chain = {2: ["realesrgan_x2plus"], 4: [base], 8: [base, "realesrgan_x2plus"]}[params["scale"]]
        if meta.face_count and meta.largest_face_px < 256:
            chain.append("gfpgan_v14")           # face-aware restore after SR
        if meta.kind == "video":
            chain = ["basicvsrpp"] if lane == "max" and meta.duration_s <= 30 else chain + ["temporal_filter"]
        return chain

    if op == "background" and params["mode"] == "remove":
        if meta.kind == "video": return ["rvm_mobilenetv3" if lane == "fast" else "sam2_propagate+modnet"]
        return ["birefnet"] if meta.has_hair_detail or lane != "fast" else ["isnet_general"]

    if op == "enhance":
        chain = ["img_adaptive_3dlut"]
        if meta.noise_sigma > 8: chain.insert(0, "nafnet_denoise")
        if meta.blur_score < 100: chain.append("nafnet_deblur")
        if meta.face_count: chain.append("gfpgan_v14")
        if params.get("hdr"): chain.append("hdr_fusion")
        return chain
    ...
```

Router inputs come from `ingest-svc` analysis: `scene` (CLIP zero-shot: photo / anime / document / product), `noise_sigma` (wavelet MAD estimator), `blur_score` (Laplacian variance), `face_count` and size, `megapixels`, `fps`, and `duration_s`.

**Load-aware downgrade:** if a queue's p95 wait is over 5 min and the user is on the Free/Fast lane, the router substitutes the "fast" alternative. Pro/Max lanes are never downgraded silently. They get an ETA warning instead.

### 6.4 Model Ops

- **Registry:** weights live in S3 `models/{id}/{version}/`, with a SHA-256 manifest. Node-local NVMe cache, pre-pulled via a DaemonSet.
- **Optimization:** export light models to ONNX → TensorRT FP16. Diffusion uses `torch.compile` + SDXL-Turbo/LCM-LoRA for previews (4–8 steps) and full steps for final renders.
- **Warm pools:** keep ≥1 warm replica per heavy model during peak hours to avoid cold-start (30–90 s for diffusion).
- **Evaluation harness:** golden set of 500 images and 50 clips per task. Metrics: LPIPS, NIQE, MUSIQ for enhancement/SR; ArcFace cosine identity score for swap and restore; FID/CLIP-score for generation; and flicker index (temporal warping error) for video. A model can't be promoted if it regresses more than 2%.
- **A/B:** router weights per model are set in `models.params.ab_weight`. Thumbs up/down feedback is collected in the export screen.

---

## 7. Processing Pipelines

### 7.1 Photo Pipeline (generic)

```
decode (Pillow/libvips, EXIF orient, ICC→sRGB)
 → safety.scan_input
 → analysis (faces, scene, noise, blur)          [cached per file]
 → for step in recipe.steps: router(step) → run  [each intermediate cached by stack-hash]
 → safety.scan_output
 → resize to export resolution (Lanczos3) → encode (mozjpeg / libwebp / oxipng)
 → C2PA sign + invisible watermark (e.g., TrustMark, MIT) + visible badge (free tier)
 → S3 outputs/ → CDN signed URL
```

### 7.2 Video Pipeline

```
ffprobe → mezzanine transcode if needed (AVI/odd codecs → H.264 intra-heavy, CFR)
 → safety.scan_input (1 fps sampling)
 → global analysis pass: scene cuts (PySceneDetect), face tracks, stabilization transforms (vid.stab detect)
 → split into chunks at keyframes (4 s, 8-frame overlap; never across a scene cut boundary mismatch)
 → fan-out chunk tasks → GPU workers (frames via NVDEC → torch tensors, no PNG round trips)
 → per-chunk: apply steps with **shared global state** (same face embedding, same LUT, same BG prompt seed, same stabilization transform list)
 → seam blend on overlaps (linear crossfade in overlap region)
 → temporal consistency pass (optical-flow-guided smoothing for generative/face ops)
 → concat + remux audio (copy) → NVENC encode (H.264/H.265/ProRes via CPU)
 → safety.scan_output (1 fps) → C2PA → S3 → CDN
```

### 7.3 Identity Consistency for Video Face Swap

1. **Single source embedding.** Compute one ArcFace embedding (averaged over up to 5 source images/frames, outliers removed). Apply it to every frame.
2. **Track-locked targets.** ByteTrack IDs + embedding re-ID ensure the swap applies to the same person after occlusions.
3. **Landmark smoothing.** A one-euro filter on the 5-point alignment landmarks removes jitter in the affine warp.
4. **Temporal blend mask.** Feathered masks from face parsing, eroded consistently, with mask edges smoothed over ±2 frames.
5. **Color harmonization.** Per-track LAB mean/std transfer computed once per shot, not per frame (prevents flicker).
6. **Post-restore with fidelity lock.** GFPGAN weight is kept constant across a track.
7. **QA metric.** Identity cosine similarity per frame vs. source. Frames below threshold are re-processed with a higher-resolution crop, or flagged.

### 7.4 GIF Frame-by-Frame Consistency

- Decode all frames with per-frame durations/disposal preserved.
- Run the video pipeline (GIFs are short, so there's no chunking).
- Re-encode with a **single global palette** (`palettegen=stats_mode=full`) + `paletteuse=dither=sierra2_4a`, or **gifski** for quality. Preserve the original frame delays and loop count.
- Offer animated WEBP / MP4 as higher-quality alternatives.

### 7.5 Outfit Swap Pipeline (image)

```
DWPose keypoints + SCHP human parsing + SAM2 refine → garment region mask (dilated 8 px)
 → safety: NSFW(input)=clear, age≥18 estimate for subject, region not "remove clothing"
 → conditioning: ControlNet(OpenPose + Depth Anything) + IP-Adapter(garment ref or preset ref image) + prompt(preset)
 → SDXL-inpaint (or commercial-licensed VTON model) at 1024 px on person crop, N variants, fixed seeds
 → IC-Light / color harmonization to match scene lighting; shadow preservation via luminance-residual transfer
 → paste back with feathered mask → face/hands untouched (masked out) → Real-ESRGAN if needed
 → safety.scan_output (NSFW must be "clear"; else variant dropped, and user shown "couldn't generate")
```

Negative prompt and constraints include: nudity, lingerie, see-through, cleavage emphasis, body reshaping. **Body proportions are preserved** because the pose and depth ControlNets lock the silhouette and the mask excludes skin outside the garment region.

---

## 8. Batch Processing & Cloud Rendering

### 8.1 Queue Topology

| Queue | Workers | Tasks | Priority |
|---|---|---|---|
| `q.safety` | GPU L4 | NSFW, age, celeb, hash | Always highest |
| `q.cpu.video` | CPU (c7i) | probe, split, merge, stabilize, encode (non-NVENC), GIF | 0–9 |
| `q.gpu.light` | L4 (24 GB) | detection, parsing, upscale, denoise, bg-remove, restore | 0–9 |
| `q.gpu.heavy` | A10G / L40S | video SR, face swap video, matting video | 0–9 |
| `q.gpu.diffusion` | A100 40/80 GB or H100 | outfit swap, BG generation, relight, expression | 0–9 |

Priority: Studio = 8, Pro = 6, Free = 2. Previews get +1 (interactive). Batches age-boost by +1 every 10 min waiting, to prevent starvation.

### 8.2 Batch Lifecycle

```
POST /batches
  → validate (types, sizes, plan limits, recipe allowed for plan)
  → estimate credits → reserve (ledger 'reserve' row)
  → create N jobs (status=queued) + Temporal BatchWorkflow(batch_id)
BatchWorkflow:
  concurrency = plan.batch_in_flight (2/10/50)
  for each job (bounded semaphore): start child JobWorkflow
  on child complete: done_files++ ; settle credits for that job ; emit batch.progress
  on child fail after 3 retries (exp backoff 10s/40s/160s): failed_files++ ; refund job reservation
  pause → stop scheduling new children (in-flight finish)
  cancel → cancel children, refund unspent
  finish → status = completed | partial ; build ZIP (optional) ; push notification
```

### 8.3 Autoscaling & Cost Control

- **KEDA ScaledObjects** per queue: target 3 pending tasks per GPU replica, scale to zero for diffusion pools off-peak (keep 1 warm during peak).
- **Spot/preemptible GPUs** for batch lanes, with checkpointing at chunk granularity. On-demand for previews.
- **Burst provider:** if the in-cluster queue wait exceeds 10 min, overflow tasks go to serverless GPU (Modal / RunPod) using the same container image.
- **Unit economics target:** 1 credit ≈ $0.004 of GPU cost. Blended gross margin of 70% or more on paid tiers.

### 8.4 Credit Costs (initial)

| Operation | Image | Video (per 10 s @1080p) |
|---|---|---|
| Enhance / denoise / color | 1 | 5 |
| Upscale 2x / 4x / 8x | 1 / 2 / 5 | 8 / 15 / 40 (≤720p src) |
| Face restore / retouch | 1 | 6 |
| Background remove / blur | 1 | 6 |
| Background generate / replace (AI) | 4 | 12 |
| Face swap | 3 | 15 |
| Expression edit | 4 | 20 |
| Outfit swap (per variant) | 6 | — (v1.2) |
| Stabilization | — | 3 |
| Previews | Free (rate-limited) | Free (3 s) |

---

## 9. Export System

### 9.1 Resolution Presets

| Preset | Long edge (image) | Video | Available when |
|---|---|---|---|
| SD | 854 px | 854×480 | Always |
| HD | 1280 px | 1280×720 | Always |
| Full HD | 1920 px | 1920×1080 | Source × upscale ≥ 1920 long edge (or user accepts plain resize) |
| 4K | 3840 px | 3840×2160 | Pro+ and (source ≥ 4K or upscale ≥ 2x applied) |
| 8K (image only) | 7680 px | — | Studio with 8x upscale |
| Original | source | source | Always |

Aspect ratio is always preserved. Custom width/height uses fit / fill / pad options.

### 9.2 Encoding Settings

| Format | Encoder | Settings |
|---|---|---|
| JPG | mozjpeg | q 85 (Balanced), 95 (Max), 4:2:0 / 4:4:4 at Max |
| PNG | libpng + oxipng | alpha preserved |
| WEBP | libwebp | q 82 / lossless option, alpha preserved |
| MP4 | NVENC H.264 (`p5`, CQ 23) / H.265 (CQ 25), AAC 192k | `+faststart` |
| MOV | H.264 / ProRes 422 HQ (Pro+) / ProRes 4444 with alpha (BG-removed, Studio) | PCM or AAC |
| GIF | gifski / ffmpeg palette | fps 10/15/24, max 800 px default |

### 9.3 Destinations

- **Save to device:** Android MediaStore (Scoped Storage), iOS `PHPhotoLibrary` (add-only permission), web download (File System Access API for batch folders when available, otherwise ZIP).
- **Cloud:** Google Drive (drive.file scope), Dropbox (app folder), OneDrive (Files.ReadWrite.AppFolder). Server-to-server upload so large batches don't pass through the phone.
- **Share link:** CDN signed URL, 7-day expiry, revocable, with C2PA manifest intact.

---

## 10. Security, Privacy & Compliance

| Area | Control |
|---|---|
| Transport | TLS 1.3, HSTS, certificate pinning on mobile (with rotation plan) |
| Storage | S3 SSE-KMS. Per-user key prefixes. No public buckets. CDN access via signed URLs/cookies only. |
| Face data | ArcFace embeddings are **biometric data**. Explicit opt-in consent (BIPA, GDPR Art. 9, India DPDP Act). Envelope-encrypted. Never used for training. Deletable any time. |
| Training data | User media is **never** used to train models without explicit opt-in (off by default) |
| AuthZ | Row-level ownership checks on every resource. Admin actions audited. |
| Uploads | MIME sniffing, ffprobe validation, size/duration caps, ClamAV scan, decompression-bomb guards (Pillow `MAX_IMAGE_PIXELS`), sandboxed FFmpeg (seccomp, no network) |
| Secrets | Vault / AWS Secrets Manager. Short-lived IRSA credentials for workers. |
| Content safety | See [§0](#0-scope-decision-content--safety-policy). Input + output scanning, minors block, consent-gated face swap, C2PA, watermark, abuse reporting, NCMEC reporting pipeline for CSAM (legally required in US) |
| AI labeling | C2PA manifests declare `c2pa.ai_generated` / `trainedAlgorithmicMedia`. Meets EU AI Act Art. 50 deepfake disclosure and the platform labeling rules of YouTube, Meta, and TikTok. |
| Privacy law | GDPR/UK GDPR, CCPA/CPRA, India DPDP, Brazil LGPD: DPA, data export, deletion, EU data residency option (Studio) |
| Store compliance | Apple 1.1.4, 1.2 (user-generated content: report/block/filter), 5.1.1 (data), 5.1.2; Google Play AI-Generated Content policy (in-app reporting), Data Safety form, Photo & Video permissions policy |
| Age | 18+ required for face swap, expression, and outfit features. 13+ (or 16+ in EU) for basic enhancement. Store age rating: 12+ / Teen. |

---

## 11. Monetization Plan

### 11.1 Tiers

| | **Free** | **Pro** | **Studio** |
|---|---|---|---|
| Price | $0 | **$9.99/mo** or **$59.99/yr** | **$29.99/mo** or **$239.99/yr** |
| Monthly credits | 50 (+5 daily login bonus, cap 100) | 1,500 | 6,000 |
| Max batch size | 10 files | 200 files | 1,000 files |
| Video length | 60 s | 10 min | 30 min |
| Max export | 1080p (image 2x upscale) | 4K, 4x upscale | 8K image, 4K video, 8x upscale |
| Watermark | Small "AI-edited · NeonForge" badge | None (C2PA only) | None (C2PA only) |
| Queue priority | Standard | Fast | Fastest + dedicated burst |
| Formats | JPG, PNG, MP4, GIF | + WEBP, MOV | + ProRes, alpha video |
| Cloud export | — | Drive, Dropbox, OneDrive | + scheduled sync, API access |
| Saved recipes | 3 | Unlimited | Unlimited + team sharing (3 seats) |
| Outfit / BG presets | Basic set | All presets | All + custom preset upload |
| Ads | Optional rewarded ads (+10 credits, max 3/day) | None | None |

**Credit packs (one-off):** 500 credits for $4.99 · 2,000 for $14.99 · 10,000 for $59.99. They never expire while any plan is active.

**Regional pricing:** Use purchasing-power parity via the store price tiers. For example, India Pro is ₹299/mo, ₹1,799/yr.

**Trials:** 7-day Pro trial (yearly plan) on mobile. First batch of 10 files free at Pro quality for onboarding.

### 11.2 Additional Revenue (v1.2+)

- **Developer API** (Studio+ / pay-as-you-go): the same recipe API for e-commerce platforms.
- **B2B:** Shopify app for bulk product photo background and enhancement.
- **Premium preset marketplace** (traditional outfits and background packs by creators, 70/30 revenue split).

### 11.3 KPI Targets (first 12 months)

| Metric | Target |
|---|---|
| D1 / D7 / D30 retention | 40% / 20% / 10% |
| Free → paid conversion | 3–5% |
| ARPPU | $8/mo |
| Gross margin (paid) | ≥ 70% |
| Job success rate | ≥ 99% (non-safety failures) |
| Median preview latency (image) | < 3 s |

---

## 12. App Store & Play Store Listings

### 12.1 Apple App Store

**App Name (30):** NeonForge AI: Photo & Video
**Subtitle (30):** Enhance, Upscale & Restyle
**Promotional text (170):** New: Batch Edit! Apply one AI recipe to hundreds of photos and videos at once. Enhance, upscale to 4K, swap backgrounds, and try on new outfits.

**Description:**

> **Turn every photo and video into studio quality, one at a time or hundreds at once.**
>
> NeonForge AI puts professional AI editing tools in one app, with a fast neon-styled workspace. Rendering happens in the cloud, so your phone stays cool and your battery lasts.
>
> **✦ ENHANCE & UPSCALE**
> • One-tap Auto Enhance: sharper details, cleaner noise, true-to-life color
> • Super-resolution upscaling: 2x, 4x, and 8x
> • HDR photo boost that recovers highlights and lifts shadows
> • Video stabilization, denoise, and cinematic color grading
>
> **☺ FACE STUDIO**
> • Restore blurry or old portraits
> • Natural skin smoothing and blemish removal that keeps real texture
> • Brighten eyes and define hair and beard
> • Change expressions: add a smile or switch to neutral
> • Face swap with your own verified face, or with friends who approve it in the app
>
> **👕 OUTFIT TRY-ON**
> • Try formal, casual, party, wedding, and traditional looks: saree, sherwani, kimono, hanbok, and more
> • Upload any garment photo and see it on you
> • Realistic lighting, shadows, and fit
>
> **▣ BACKGROUNDS**
> • Remove backgrounds in one tap, even around hair
> • Replace with your own image or generate one from a prompt
> • DSLR-style bokeh and cinematic depth of field for photos and video
>
> **⚡ BATCH EDIT**
> • Select a folder or many files, build a recipe once, and apply it to all of them
> • Live progress for every file, with push notifications when done
> • Download everything as a ZIP or send it straight to Google Drive, Dropbox, or OneDrive
>
> **EXPORT YOUR WAY**
> JPG, PNG, WEBP, MP4, MOV, GIF. SD, HD, Full HD, and 4K.
>
> **RESPONSIBLE AI**
> Face swap only works with faces you have permission to use. Edited media carries Content Credentials (C2PA) so viewers can see it was made with AI. We never use your photos to train our models.
>
> NeonForge Pro and Studio are auto-renewing subscriptions. Payment is charged to your Apple ID at confirmation. The subscription renews unless you cancel at least 24 hours before the end of the current period. Manage it in Account Settings.
> Terms: https://neonforge.ai/terms · Privacy: https://neonforge.ai/privacy

**Keywords (100):** `photo enhancer,upscale,4k,ai editor,background remover,face,outfit,video enhance,batch,retouch,hd`
**Category:** Photo & Video (Primary), Graphics & Design (Secondary)
**Age rating:** 12+ (Infrequent/Mild Mature Themes: none; user-generated content with moderation)

### 12.2 Google Play

**Title (30):** NeonForge AI Photo Video Editor
**Short description (80):** AI enhance, 4K upscale, background & outfit edits. Edit 1 file or 1000 at once.

**Full description (≤4000):** Same as the App Store copy above. Play-specific notes:
- Mention "Batch edit" and "AI photo enhancer" in the first 2 lines (Play search indexes the full description).
- Add a "What's inside" feature list with ★ bullets. Avoid emoji overload (Play metadata policy).
- Include the AI-generated content disclosure and the in-app reporting mention (required by the Play AI-Generated Content policy).

**Category:** Photography. **Content rating:** IARC Teen. **Data safety:** Photos/videos (collected, processed in cloud, deletable, not shared, encrypted in transit). Biometric face data only with opt-in, deletable.

### 12.3 Store Creative

- **Screenshots (6):** 1) Before/after split with upscale 4x; 2) Batch Manager with neon progress bars "Edit 500 photos at once"; 3) Background replace; 4) Outfit try-on (traditional wear carousel); 5) Face restore on an old photo; 6) Export options + 4K badge.
- **Preview video (30 s):** fast cuts synced to a beat. Each feature is a 3-second before→after wipe. End card: "One app. Every edit."
- **Localization:** EN, HI, ES, PT-BR, ID, AR, FR, DE, JA, KO at launch for metadata. The first 3 screenshots are localized.

---

## 13. Marketing Strategy

### 13.1 Positioning
"The fastest way to edit hundreds of photos and videos with AI, at studio quality." Differentiators: **batch at scale**, **video parity with photo**, **traditional outfit presets** (underserved in India, SEA, and MENA), and **responsible AI** (trusted by brands and creators who need to stay compliant with platform rules).

### 13.2 Target Segments

| Segment | Hook | Channel |
|---|---|---|
| YouTubers / short-form creators | 4K upscale old footage, stabilize, cinematic bokeh, thumbnail cutouts | YouTube Shorts, Instagram Reels, TikTok |
| E-commerce sellers (Amazon, Etsy, Shopify, Meesho) | Batch white-background + enhance for product photos | SEO, marketplace seller forums, Shopify App Store |
| Wedding/event photographers | Batch retouch, restore, traditional outfit previews | Instagram, photographer Facebook groups, WhatsApp communities |
| Nostalgia users | Restore and colorize old family photos | Facebook, Pinterest, festival campaigns (Diwali, Eid, Lunar New Year) |
| Authors / KDP publishers | Clean, upscaled cover art and author portraits (print-ready 300 DPI via 4x upscale) | KDP communities, Reddit r/selfpublish |

### 13.3 Launch Plan (12 weeks)

| Weeks | Actions |
|---|---|
| −4 to 0 (pre-launch) | Landing page + waitlist (referral queue jumping). 20 creator beta testers. Build a before/after content library of 100 posts. |
| 0 (launch) | Product Hunt launch. Press kit. Launch video. Reddit (r/photography, r/editors, r/AIArt: value-first posts). Store featuring nomination (Apple "Get featured" form, Google Play Indie/Editorial). |
| 1–4 | Daily short-form before/after reels on owned channels. Creator partnerships (10 micro-influencers, 10k–100k followers, affiliate code with 30% rev share for 12 months). |
| 5–8 | ASO iteration (A/B icon and screenshots via Play Store Listing Experiments and Apple Product Page Optimization). SEO pages: "AI photo upscaler", "remove background batch", "restore old photo" (web tools with a free tier drive app installs). |
| 9–12 | Paid UA: Apple Search Ads (exact-match brand + "photo enhancer"), Google App Campaigns, Meta Advantage+. Scale channels with CAC < 40% of 6-month LTV. |

### 13.4 Growth Loops
- **Watermark loop:** the free-tier badge links to the app ("Edited with NeonForge").
- **Referral:** give 100 credits, get 100 credits.
- **Shareable before/after:** one-tap export of a before/after split video formatted for Reels/Shorts.
- **Template gallery:** public recipes that users can share ("Wedding Glow", "Product White BG") with deep links.
- **Seasonal presets:** festival outfit and background packs (Diwali, Eid, Christmas, Holi, Lunar New Year, Onam) timed for search peaks.

### 13.5 Content Pillars for Owned Channels
1. Before/after transformations (60%)
2. How-to tutorials in 30 seconds (20%)
3. Batch speed demos: "500 photos in 4 minutes" (10%)
4. Behind-the-scenes and responsible AI explainers (10%)

### 13.6 Metrics Dashboard
Installs by channel, CAC, activation (first export within 24 h), D1/D7/D30 retention, trial start → paid conversion, credits consumed per MAU, batch adoption %, NPS, and store rating (target ≥ 4.6).

---

## 14. Delivery Roadmap & Team

### 14.1 Team (MVP)

| Role | Count |
|---|---|
| Product manager | 1 |
| Product designer (UI/UX + motion) | 1 |
| Flutter engineers | 2 |
| Web (Next.js) engineer | 1 |
| Backend engineers (FastAPI, Temporal, infra) | 2 |
| ML engineers (pipelines, optimization, eval) | 2 |
| DevOps / SRE (K8s, GPU, cost) | 1 |
| QA (automation + device lab) | 1 |
| Trust & Safety (part-time → full-time at scale) | 0.5 |

### 14.2 Milestones

| Phase | Weeks | Scope | Exit criteria |
|---|---|---|---|
| **M0: Foundations** | 1–3 | Repo/monorepo, CI/CD, Terraform, K8s + GPU pool, auth, upload (tus), DB schema, design system tokens | Upload → S3 → thumbnail visible in app |
| **M1: Photo core** | 4–8 | Enhance, upscale 2x/4x, face restore/retouch, BG remove/replace/blur, editor workspace, export, safety scanning | Single photo edit end-to-end, p50 preview < 3 s |
| **M2: Video core** | 7–12 | Video pipeline (chunking, NVENC), stabilization, video enhance/upscale, video BG remove/blur, GIF support | 60 s 1080p enhance < 3 min on L4 |
| **M3: Batch** | 10–13 | Recipes, batch workflow, Batch Manager UI, realtime progress, ZIP, cloud export | 500-image batch completes with ≥ 99% success |
| **M4: Face swap + consent** | 12–16 | Liveness verification, consent links, image/video face swap, tracking + temporal consistency, C2PA | Identity cosine ≥ 0.6 avg, flicker index under threshold, all safety tests pass |
| **M5: Outfit + generative BG** | 14–18 | Human parsing, try-on pipeline, presets, AI background generation, relight | Human eval: 70%+ "realistic" on golden set |
| **M6: Monetization + launch** | 17–20 | Stripe, StoreKit 2, Play Billing, RevenueCat, credits ledger, store listings, localization, load tests, security audit/pentest | Store approval, pentest criticals = 0 |
| **v1.1** | +6 wks | 8x upscale, expression edit, hair/beard, video→video swap, zip upload | |
| **v1.2** | +8 wks | Video outfit swap, frame interpolation, developer API, Shopify app, team seats | |

### 14.3 Monorepo Layout

```
neonforge/
├─ apps/
│  ├─ mobile/            # Flutter (android/ ios/)
│  └─ web/               # Next.js
├─ services/
│  ├─ api-core/          # FastAPI
│  ├─ realtime/          # WS/SSE
│  ├─ orchestrator/      # Temporal workflows
│  ├─ ingest/
│  ├─ export/
│  └─ notify/
├─ ai/
│  ├─ common/            # ModelAdapter, router, tensor I/O, NVDEC/NVENC utils
│  ├─ face/  enhance/  gen/  video/  safety/
│  ├─ models.yaml        # registry manifest (id, license, weights_uri, vram)
│  └─ eval/              # golden sets + metrics harness
├─ packages/
│  ├─ design-tokens/     # Style Dictionary → Dart + CSS
│  ├─ api-client-ts/     # generated
│  └─ api-client-dart/   # generated
├─ infra/
│  ├─ terraform/  helm/  argocd/
└─ docs/
```

### 14.4 Testing Strategy
- **Unit:** pytest (services, router), Dart `flutter_test`, Vitest (web).
- **Contract:** OpenAPI schema tests (Schemathesis).
- **Pipeline golden tests:** deterministic seeds. Output perceptual-hash tolerance checks per model version.
- **Safety red-team suite:** a curated set of adversarial inputs (NSFW attempts, minor faces, celebrity faces, prompt-injection-style outfit prompts). Must be 100% blocked before any release.
- **E2E:** Playwright (web), Patrol / integration_test (Flutter) on a Firebase Test Lab + BrowserStack device matrix.
- **Load:** k6 for API. A synthetic batch generator for queue/GPU autoscaling (1,000 concurrent batches).

---

## 15. Appendix: Model Licensing Matrix

> Verify every license with counsel before commercial launch. Licenses change, and model weights can carry a different license than the code.

| Model | Code license | Weights / commercial use | Action |
|---|---|---|---|
| MediaPipe | Apache-2.0 | ✅ | Use |
| SCRFD / RetinaFace (InsightFace code) | MIT | ⚠️ Pretrained weights non-commercial | License from InsightFace, or train on a commercial-safe dataset |
| ArcFace buffalo_l | MIT code | ⚠️ Non-commercial weights | License or replace (AdaFace: check weights license) |
| inswapper_128 | — | ❌ Non-commercial | License commercially from InsightFace or train in-house swapper |
| GFPGAN | Apache-2.0 | ✅ | Use |
| CodeFormer | S-Lab License 1.0 | ❌ Non-commercial | Research/eval only |
| Real-ESRGAN | BSD-3 | ✅ | Use |
| SwinIR / HAT | Apache-2.0 / MIT | ✅ (check weights) | Use |
| BasicVSR++ (MMagic) | Apache-2.0 | ✅ | Use |
| NAFNet / Restormer | MIT / Academic | ✅ / ⚠️ | NAFNet preferred |
| rembg (U²-Net, ISNet) | MIT / Apache-2.0 | ✅ | Use |
| BiRefNet | MIT | ✅ | Use |
| RMBG-1.4 / 2.0 (BRIA) | Custom | ❌ Commercial requires BRIA license | Avoid or license |
| RobustVideoMatting | GPL-3.0 | ⚠️ Copyleft | Isolate as separate network service or use MODNet/SAM 2 |
| MODNet | Apache-2.0 | ✅ | Use |
| SAM 2 | Apache-2.0 | ✅ | Use |
| Depth Anything V2 Small | Apache-2.0 | ✅ (Base/Large are CC-BY-NC) | Use Small only |
| Stable Diffusion XL | CreativeML OpenRAIL++-M | ✅ with use restrictions | Use (use-based restrictions align with §0 policy) |
| FLUX.1-schnell | Apache-2.0 | ✅ | Use |
| FLUX.1-dev / Fill-dev | FLUX.1-dev Non-Commercial | ❌ | Avoid unless licensed from Black Forest Labs |
| IP-Adapter / ControlNet (SDXL) | Apache-2.0 | ✅ (check each checkpoint) | Use |
| IC-Light | Apache-2.0 | ✅ | Use |
| IDM-VTON | CC BY-NC-SA 4.0 | ❌ | Research only |
| OOTDiffusion | CC BY-NC-SA 4.0 | ❌ | Research only |
| CatVTON | CC BY-NC-SA 4.0 (verify) | ❌ likely | Research only → in-house SDXL try-on pipeline |
| LivePortrait | MIT | ✅ (InsightFace deps are non-commercial) | Use with licensed/replaced face detector |
| LaMa | Apache-2.0 | ✅ | Use |
| DWPose | Apache-2.0 | ✅ | Use |
| SCHP | MIT | ✅ (check dataset terms) | Use |
| RAFT | BSD-3 | ✅ | Use |
| vid.stab / FFmpeg | GPL/LGPL | ✅ (build config matters) | Use LGPL build + separate vid.stab process, or comply with GPL |
| NudeNet / Falconsai NSFW | MIT/AGPL / Apache-2.0 | ⚠️ / ✅ | Falconsai preferred, NudeNet check version |
| TrustMark watermark | MIT | ✅ | Use |
| C2PA (c2pa-rs / c2pa-python) | MIT/Apache-2.0 | ✅ | Use |

---

*End of specification.*
