# AI Face Studio — Product & Technical Specification

> by SplitFire Production · Tagline: "Transform Your Imagination." · "One Photo. Unlimited Possibilities."
> All-in-one AI visual transformation studio: Face, Body, Fashion, Hair & Beauty, Character, Photo, Video,
> Restore & Enhance — one unified app instead of ten single-purpose AI apps.
> Version 1.0 · Status: Blueprint (implementation-ready; not yet built — see §0.1)
> Related specs in this repo: [`docs/ai-media-editor/SPEC.md`](../ai-media-editor/SPEC.md) ("NeonForge AI" —
> an enhancement/face-swap/outfit-swap editor with an overlapping feature set; see §0.3 for how the two are
> positioned relative to each other), [`docs/neonforge-studio/SPEC.md`](../neonforge-studio/SPEC.md)
> ("NeonForge Studio" — the general-purpose free photo editor & design suite built as a companion to this app).

---

## Table of Contents

0. [Scope, Status & Safety Policy](#0-scope-status--safety-policy)
1. [Product Vision](#1-product-vision)
2. [Feature Catalog](#2-feature-catalog)
3. [The Face Swap Engine](#3-the-face-swap-engine)
4. [Smart Edit Locks, Identity Lock & Multi-Face / Batch](#4-smart-edit-locks-identity-lock--multi-face--batch)
5. [AI Creator & the Smart Prompt Engine](#5-ai-creator--the-smart-prompt-engine)
6. [UI/UX System](#6-uiux-system)
7. [Non-Destructive Editing: History, Versions, Region Regenerate](#7-non-destructive-editing-history-versions-region-regenerate)
8. [Technical Architecture](#8-technical-architecture)
9. [Database Schema](#9-database-schema)
10. [API Endpoints](#10-api-endpoints)
11. [Video Studio (Forward-Looking Architecture)](#11-video-studio-forward-looking-architecture)
12. [Safety System & Consent](#12-safety-system--consent)
13. [Privacy](#13-privacy)
14. [Monetization](#14-monetization)
15. [Owner / Admin Mode & Master Access](#15-owner--admin-mode--master-access)
16. [Feedback Loop & Analytics](#16-feedback-loop--analytics)
17. [Performance, Offline Mode & Error Recovery](#17-performance-offline-mode--error-recovery)
18. [Build Roadmap](#18-build-roadmap)

---

## 0. Scope, Status & Safety Policy

### 0.1 Implementation status

This is a **blueprint-level deliverable**: a complete, implementation-ready product and engineering spec —
problem mapping, feature catalog, pipeline design, UI/UX flows, architecture, database schema, API contracts
and a phased build plan. It is not a working app in this commit. The underlying AI (face swap, identity
embedding, diffusion-based generation, video sync) is multi-month, multi-specialist work (ML engineers,
computer-vision engineers, mobile/web engineers) and is designed here as a **provider-agnostic interface**
(§8.4) so real models can be plugged in without redesigning the app, exactly as the brief's §46/§77 ask for.

### 0.2 Safety deviation from a literal reading of the brief — and why

The brief's §48 and §49 already require blocking non-consensual intimate imagery, nudification, sexual
content involving minors, fraudulent documents and harmful impersonation, and require a consent notice before
face manipulation. This spec keeps every one of those requirements and makes them **non-negotiable,
server-side, and un-disableable by the Owner/Admin role** (§15.5) — because a face-swap product that skips
this, or lets an "unlimited mode" switch it off, is both an app-store rejection (Apple Guideline 1.1.4, Google
Play's AI-Generated Content policy) and a product that can be used to make real people's deepfakes without
their consent. "Unlimited Free Mode" (§15) only ever removes **credit/paywall** limits for the owner's own
account — it never removes a safety check, a consent screen, or a provenance watermark. This is a stricter
reading of the brief's own §48/§76, not a looser one.

### 0.3 Relationship to other specs in this repo

| Spec | Relationship |
|---|---|
| `docs/ai-media-editor/SPEC.md` ("NeonForge AI") | A narrower, already-specced product: AI enhancement, face editing/swap, and outfit replacement for photo & video, with its own safety section (§0 there). AI Face Studio is the **broader studio** (adds Body/Character/Beauty/Photo-restoration/Discover/Templates/AI-Creator-with-plan-preview/Owner-dashboard on top). Where both specs cover the same ground — face-swap pipeline stages, NSFW/minor gating, provenance watermarking — this spec reuses NeonForge AI's policy decisions rather than re-deriving them, and the two products should share one `FaceSwapModel` / `SafetyService` implementation rather than building two. |
| `docs/neonforge-studio/SPEC.md` ("NeonForge Studio") | A separate, general-purpose free editor (crop/filters/fonts/stickers/collage/templates) with no identity-manipulation tools. Cross-links to this app for anything face-related rather than re-implementing face swap. |
| `expertprompter/`, `docs/mixforge-studio/SPEC.md`, `docs/dj-radicalmix/SPEC.md` | Source of the **Owner/Master-access pattern** reused unchanged in §15: email-based recognition, no plaintext password ever stored or committed, audit-logged. |

**Naming note:** two unrelated specs in this repo now contain "NeonForge" in the title (`ai-media-editor` =
"NeonForge AI", and the new `neonforge-studio` = "NeonForge Studio"). They are different products built in
different commits. Before shipping either under that brand, pick one app to rename to avoid user-facing brand
confusion — this spec does not resolve that naming collision on its own.

---

## 1. Product Vision

A single flow, never a maze of unrelated screens:

```
UPLOAD → ANALYZE → CHOOSE WHAT TO CHANGE → EDIT → GENERATE → COMPARE → REFINE → SAVE → SHARE
```

### 1.1 The 15 problems this product is built to solve

| # | Problem with existing AI photo apps | AI Face Studio's answer |
|---|---|---|
| 1 | Poor face consistency | Identity Lock + embedding reference carried through every stage (§4.2) |
| 2 | Unwanted changes to clothing/background | Smart Edit Locks, default-ON for clothing/background on face/hair edits (§4.1) |
| 3 | Bad eyes/teeth/artifacts | Pre-delivery Quality Control gate, auto-regenerate on failure (§3.4) |
| 4 | Wasted credits on failed results | Failed/invalid generations never deduct credit (§14.4) |
| 5 | Excessive ads | At most one *optional* rewarded ad, never forced (§14.5) |
| 6 | Watermarks used to force upgrades | No artificial free-tier watermark; monetize via speed/quality/storage instead (§14) |
| 7 | Complicated navigation | Home → Tool → Upload → Edit in ≤3 taps, plus a global AI command bar (§6.2) |
| 8 | Poor privacy transparency | Private Mode with real technical effect, not just a label (§13) |
| 9 | Aggressive paywalls | Genuinely useful free tier (§14.2) |
| 10 | Lack of editing control | Manual masking, brush/eraser, smart selection (§6.5) |
| 11 | Lack of version history | Non-destructive timeline + versioning (§7) |
| 12 | Lack of batch processing | Queue-based batch face swap, 10–100+ images (§4.3) |
| 13 | Poor regeneration controls | Region Regenerate — only the flagged region reruns (§7.3) |
| 14 | Inconsistent AI characters | Saved "My Character" identity profile reusable across tools (§5.3 of brief → §2.D below) |
| 15 | Lack of precise masking | Auto Mask + Smart Selection + manual brush, same engine across every tool (§6.5) |

---

## 2. Feature Catalog

Ten studios, reachable from Home in one tap each (brief §2–§27, consolidated):

### A. Face Studio
Face Swap · Multi Face Swap · Batch Face Swap · Animal Face Swap · Head Swap · Face Replace · Face Blend ·
Expression Changer · Age Transformation · Face Style Transfer · Symmetry Analysis · Face Shape Detector ·
Celebrity Look-Alike (resemblance only, never identity claims — §12.4) · AI Portrait Generator · AI Profile
Picture Generator (Corporate/Casual/Luxury/Creative/Gamer/Influencer/Executive/Travel presets, multi-output).

### B. Body Studio
Body Swap · Body Shape Visualizer · Pose Changer · Muscle Definition Visualizer · Fitness Transformation
Preview · Posture Correction · Full-Body Character Generator. **All outputs are labeled "AI visual
transformation," never presented as a factual body assessment (brief §13).**

### C. Fashion / Clothing Studio
AI Clothes Changer · Virtual Try-On · Outfit/Suit/Wedding Generator · Traditional/Business/Casual/Sport/
Street/Luxury/Seasonal/Uniform/Costume · Shoe/Accessory/Glasses/Hat/Jewelry Try-On · free-text prompt
("Change my outfit to a luxury black suit"). **Clothing Preservation Mode** ("Change ONLY Clothing") is a
one-tap toggle that locks face/hair/body/pose/background/lighting — same mechanism as §4.1.

### D. Hair & Beauty Studio
Hairstyle/Color/Length/Volume/Density Changer · Beard/Mustache/Eyebrow Styler · Makeup Studio (foundation,
lipstick, eyeliner, eyeshadow, blush, contour, highlight; Natural/Professional/Party/Wedding/Fantasy/Editorial
presets; intensity slider 0–100) · Skin Tone/Texture Editor · Facial Hair Generator.

### E. Character Studio
Character Swap into Fantasy/Superhero/Sci-Fi/Cyberpunk/Anime/Cartoon/Warrior/Royal/Robot/Alien/Magical/
Game-style/Historical/Movie-style presets · **"Create My Character"**: upload once → generate a reusable
`CharacterProfile` (identity embedding + style metadata) that stays consistent across every later clothing/
background/pose/style request — the brief's "Personal AI Character" (§15), implemented as one shared record
rather than a separate feature (see `characters` table, §9).

### F. Photo Studio & Restore/Enhance
Photo Enhancer · Upscaler (2x/4x) · Background Remover/Generator/Changer · Object Remover/Replacer · Old
Photo Restoration · Colorization (labeled "AI-generated reconstruction," never presented as verified history
— brief §20) · Blur/Noise Removal · Low-Light/HDR Enhancement · Sharpening. Professional presets: Passport ·
LinkedIn · CV · Corporate Headshot · Dating Profile · Social Profile · YouTube Thumbnail · Instagram Photo.

### G. AI Analysis
Face Shape/Symmetry Analysis · Photo/Lighting/Composition/Resolution/Background Quality Analysis · Visual
Style Analyzer (clothing/hair/palette/lighting/composition → suggests a matching tool, e.g. "studio aesthetic
detected → try Corporate Headshot"). AI-detection style outputs are always qualified ("AI estimate,"
"possible," with a confidence score) — never stated as fact (brief §21).

### H. AI Creator
Universal natural-language editor — see §5.

### I. Video Studio
Architecture only in v1 (provider interface defined, no model connected yet) — see §11.

### J. Discover, Templates & Style Library
Trending/New/Popular/Editor's Picks/Community feed, filterable by category; reusable `Template` records
("CEO Portrait," "Cyberpunk Hero," "Dubai Luxury," "Wedding Portrait," …) that bundle a tool + preset
parameters + an edit plan; searchable `Style` tags ("cyberpunk," "vintage," "cinematic," …).

---

## 3. The Face Swap Engine

### 3.1 The pipeline (never a direct paste-over)

```
1. Face detection
2. Landmark detection (478-pt mesh)
3. Face alignment
4. Identity embedding extraction (source)
5. Pose analysis (target)
6. Lighting analysis (target)
7. Skin-tone analysis (target)
8. Occlusion detection (hair/hand/glasses over face)
9. Expression analysis (target)
10. Target-region mask generation
11. Face synthesis (identity-conditioned)
12. Edge blending
13. Skin-texture reconstruction
14. Color matching to target lighting/skin tone
15. Quality Control gate (§3.4) → pass: deliver · fail: auto-regenerate, no credit charged
```

### 3.2 Default preservation

**"Preserve Everything Except Face" is the default mode** for every face operation. Preserved by default:
target body, target clothing, target hairstyle (unless hair tool explicitly invoked), target background,
target pose, target lighting, target expression. Each is also an individually togglable Smart Edit Lock
(§4.1) so an advanced user can intentionally change more than the face in one pass.

### 3.3 Identity Lock

| Control | Behavior |
|---|---|
| "Preserve my face" toggle | Keeps the source identity embedding pinned through every downstream tool call in the same project (clothing change, background change, style change) |
| Identity Strength slider | 0–100%, **default 90%** — how strongly the embedding constrains synthesis vs. how much the target pose/expression is allowed to reshape the result |

### 3.4 Quality Control (runs before any credit is deducted)

Automated checks, each a go/no-go gate: missing/distorted eyes · distorted teeth/deformed mouth · incorrect
skin boundary/face stretching · double face · misalignment · unnatural hairline/neck · identity drift above
threshold (cosine distance between source embedding and result embedding) · resolution/artifact check ·
color-match check.

- **Fail → automatic regenerate**, up to 2 additional attempts, still free to the user.
- **Still failing after retries →** show "AI detected an issue and is improving your result," offer manual
  retry / switch model / adjust settings (§17.3), and the attempt is logged to `AIJobs` with
  `billable: false`.
- A generation is only marked `billable: true`, and only then decremented from the user's quota, once it
  passes this gate (§14.4 implements the brief's §30/§41 directly).

---

## 4. Smart Edit Locks, Identity Lock & Multi-Face / Batch

### 4.1 Smart Edit Locks

Per-project toggle set, shown as chips above every editor canvas:

`Face` `Hair` `Body` `Clothing` `Background` `Skin` `Pose` `Accessories` `Person 1` `Person 2` … `Person N`

Example: user sets `Face = Change`, `Clothing/Background/Body = Lock` → only the face region is eligible for
the diffusion mask regardless of what the prompt or preset would otherwise touch. Locks are enforced at the
mask-generation stage (pipeline step 10, §3.1), not as a post-hoc crop, so locked regions are bit-identical to
the source except for blend-edge anti-aliasing.

Defaults (brief §35/§36): `Background = Lock` and `Clothing = Lock` are pre-enabled for Face Swap, Hair
Change and Clothes Change tools; user can unlock either explicitly.

### 4.2 Multi-face mapping

Detected faces are numbered `Person 1…N` with bounding-box overlays. Each is independently mapped to a
reference face (`Person 1 → Reference A`, …) via a drag-or-tap assignment UI before generation; unmapped
faces are left untouched.

### 4.3 Batch processing

Upload 10/20/50/100+ images → automatic per-image face detection → job queue with pause/resume/cancel/retry-
failed/download-all/ZIP export. Implemented as one `AIJobs` row per image, grouped by a `batch_id`, so partial
failures retry independently without re-processing the whole batch (brief §8).

---

## 5. AI Creator & the Smart Prompt Engine

### 5.1 Natural-language command bar

"What do you want to change?" — free text, e.g. *"Change my hair to silver and put me in a cyberpunk city."*

### 5.2 Edit-plan compiler

The prompt is parsed into a structured, human-readable plan **shown before any generation runs**:

```json
{
  "face": "preserve",
  "hair": { "action": "change", "color": "silver" },
  "clothing": "preserve",
  "background": { "action": "change", "scene": "cyberpunk city" },
  "lighting": { "action": "change", "style": "neon" }
}
```

Rendered to the user as an editable checklist (`AI EDIT PLAN`): each line can be toggled off, or its value
edited, before the user taps Generate. The parser routes each resolved field to the specific tool/model that
owns it (Hair Color Changer, Background Generator, …) rather than running one monolithic image-to-image pass,
so Smart Edit Locks (§4.1) still apply per field.

### 5.3 Ambiguity & safety interception

If the parsed plan would require removing clothing, altering a minor's face, or targeting a face the user has
not confirmed rights to edit, the plan step is replaced with a blocked marker and a reason, and generation of
that field is refused server-side regardless of client state (§12).

---

## 6. UI/UX System

### 6.1 Onboarding
5 screens (Welcome → Transform Your Photos → Change Faces/Hair/Clothes → Create Your Character → Everything
in One Studio) → **Start Creating**.

### 6.2 Navigation
Bottom nav: `🏠 Home` `✨ Create` `🧰 Tools` `📁 Projects` `👤 Profile`, with a floating center **✨ AI Create**
button. Every tool reachable in `Home → Tool → Upload → Edit` (≤3 taps). Global search ("hair" → Hair Color /
Hairstyle / Beard / Makeup; "professional" → Headshot / CV / LinkedIn / Corporate).

### 6.3 Universal toolbar
Present on every editor screen: `← Back` `Original` `Undo` `Redo` `Reset` `Compare` `Save` `Share` `Download`
`More`.

### 6.4 Before/After
Draggable slider, side-by-side, split-screen and swipe comparison — available on every generated result.

### 6.5 Masking
Auto Mask (from pipeline step 10) · Smart Selection (tap a detected region) · Brush · Eraser — all feed the
same mask tensor used by the generation call, so manual correction of AI detection (brief §39/§40) is a first-
class input, not a separate tool.

### 6.6 Accessibility
Large text, screen-reader labels on every control, high-contrast theme, reduced-motion setting, full keyboard
navigation on web.

---

## 7. Non-Destructive Editing: History, Versions, Region Regenerate

### 7.1 Edit timeline
`Original → Face Swap → Hair Change → Clothing Change → Background Change → Enhancement`, each a node the
user can jump back to without losing later branches (branches are versions, §7.2).

### 7.2 Versioning
Every generation creates a new `ProjectVersion`. Compare / Restore / Duplicate / Continue-Editing are
available from any version; restoring creates a new version rather than deleting history.

### 7.3 Region Regenerate
Post-generation feedback ("Face is good but hair is wrong") maps a named region to a re-run of only that
region's mask against the *same* seed/context — not a full re-generation. Implemented via the same Smart Edit
Lock machinery (§4.1): the feedback UI simply locks everything except the flagged region before re-invoking
the pipeline.

---

## 8. Technical Architecture

### 8.1 Client
- Mobile: React Native (iOS 15+/Android 8+) sharing one TypeScript codebase with:
- Web: Next.js (App Router), shared design-system package (`@aifacestudio/ui`).
- Local/offline editor (crop, resize, filters, adjustments, gallery) runs entirely on-device; anything calling
  a model clearly shows a "Requires internet" state rather than silently failing (brief §53).

### 8.2 Backend
- API: Node.js (NestJS) or Python (FastAPI) — REST + signed webhooks for async job completion.
- Job queue: Redis/BullMQ (or SQS) for AI jobs, with per-job retry policy from §3.4/§4.3.
- Object storage: S3-compatible + CDN for generated assets; temp uploads auto-expire (§13).
- DB: PostgreSQL (relational: users, projects, billing) + a document/blob layer for job payload metadata.

### 8.3 AI service layer — provider abstraction

```
interface AIProvider {
  faceSwap(req: FaceSwapRequest): Promise<AIJobHandle>;
  faceAnalyze(req: FaceAnalysisRequest): Promise<FaceAnalysisResult>;
  imageGenerate(req: PromptRequest): Promise<AIJobHandle>;
  imageEdit(req: EditRequest): Promise<AIJobHandle>;
  upscale(req: UpscaleRequest): Promise<AIJobHandle>;
  video(req: VideoRequest): Promise<AIJobHandle>;      // §11
  vision(req: VisionRequest): Promise<VisionResult>;   // analysis tools
}
```

Concrete adapters (`ProviderA`, `ProviderB`, `LocalModel`, `CustomModel`, …) implement this interface; the app
never calls a vendor SDK directly outside the adapter layer, so swapping or adding a provider is a new adapter
file, not an app-wide refactor (brief §46/§77).

### 8.4 Model router & cost control

| Request profile | Routed to |
|---|---|
| Simple (single preset, low-res preview) | Cheapest/fastest model |
| Complex (multi-field edit plan, high identity-strength) | Mid-tier model |
| Explicit "Ultra Quality" | Premium model |
| Batch (10–100+ images) | Throughput-optimized batch endpoint, same provider contract |

**Primary/Fallback:** admin configures a primary model per task type; on provider error/timeout the router
automatically retries on the configured fallback before surfacing a failure to the user (brief §77).

### 8.5 Quality modes
`Fast` / `Balanced` / `High Quality` / `Ultra` — each maps to a router hint plus an estimated-time label shown
to the user before they commit to the mode.

---

## 9. Database Schema

```
Users(id, email, auth_provider, role[user|owner|admin], created_at, private_mode, deleted_at)
Projects(id, user_id, title, category, cover_thumbnail, created_at, is_favorite, share_enabled)
ProjectVersions(id, project_id, parent_version_id, tool, params_json, result_image_id, created_at)
Images(id, project_id, storage_key, width, height, format, is_temp, expires_at)
Characters(id, user_id, name, identity_embedding_ref, style_metadata_json, created_at)
AIJobs(id, user_id, project_id, batch_id, tool, provider, model, status, billable, quality_mode,
       input_refs_json, output_refs_json, qc_result_json, cost_actual, created_at, completed_at)
AIResults(id, job_id, image_id, version_number, quality_score_json)
Tools(id, slug, studio, name, icon, is_premium_only)
Templates(id, slug, name, tool_id, preset_params_json, category, is_featured)
Styles(id, slug, name, tags)
Favorites(user_id, project_id, created_at)
Credits(user_id, balance, unlimited_free_mode, updated_at)
Subscriptions(id, user_id, plan[free|premium], status, renews_at)
Usage(id, user_id, date, generations_count, failed_count, storage_bytes)
Feedback(id, job_id, user_id, rating[great|ok|poor], issue_tags_json, comment)
Reports(id, reporter_user_id, target_job_id, reason, status, reviewed_by, reviewed_at)
Notifications(id, user_id, type, payload_json, read_at, created_at)
Settings(user_id, quality_default, identity_strength_default, locks_default_json, locale)
SafetyEvents(id, user_id, job_id, check_type, verdict[pass|block], reason, created_at)
AuditLogs(id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
```

---

## 10. API Endpoints

```
POST   /v1/projects                        create project
GET    /v1/projects/:id                    get project + version tree
POST   /v1/projects/:id/upload              upload source image(s)

POST   /v1/jobs/face-swap                   body: { sourceFaceId, targetImageId, locks, identityStrength, quality }
POST   /v1/jobs/multi-face-swap              body: { targetImageId, mappings: [{personId, sourceFaceId}], locks }
POST   /v1/jobs/batch                       body: { tool, imageIds[], params }
POST   /v1/jobs/ai-creator                  body: { prompt, projectId }            → returns draft Edit Plan
POST   /v1/jobs/ai-creator/confirm          body: { planId, editedPlan }           → runs confirmed plan
POST   /v1/jobs/:id/region-regenerate       body: { region, params }
GET    /v1/jobs/:id                         poll status / result
POST   /v1/jobs/:id/feedback                body: { rating, issueTags[], comment }

GET    /v1/templates?category=
GET    /v1/styles?search=
GET    /v1/discover?tab=trending|new|popular|editors|community

POST   /v1/characters                       create "My Character" profile
GET    /v1/characters/:id

GET    /v1/projects/:id/versions
POST   /v1/projects/:id/versions/:vid/restore

POST   /v1/safety/report                    body: { jobId, reason }
GET    /v1/admin/dashboard/*                owner/admin only — see §15.4
```

All AI job endpoints are async: they return `{ jobId, status: "queued" }` immediately; completion is
delivered by webhook/push + polling, and the client never blocks its UI thread on a generation (brief §68).

---

## 11. Video Studio (Forward-Looking Architecture)

Interface defined now, no model wired in v1:

```
interface VideoProvider {
  faceSwapVideo(req): Promise<AIJobHandle>;
  styleTransferVideo(req): Promise<AIJobHandle>;
  talkingPortrait(req): Promise<AIJobHandle>;
  imageToVideo(req): Promise<AIJobHandle>;
  lipSync(req): Promise<AIJobHandle>;
  expressionAnimate(req): Promise<AIJobHandle>;
}
```

Same job-queue/billing/QC pattern as image jobs (§3.4, §9 `AIJobs`), gated behind the same consent/safety
checks (§12) — video face-swap is consent-gated per source identity, not merely per account.

---

## 12. Safety System & Consent

All checks run **server-side, before generation starts**, and are not configurable by the Owner role (§0.2):

| Blocked | Allowed |
|---|---|
| Non-consensual intimate imagery / nudification | Fashion, makeup, hairstyle, costume, character creation |
| Sexual content involving minors (age estimator + hash-matching on upload) | Family photo restoration/colorization |
| Exploitative sexual imagery | Artistic/style transformation |
| Fraudulent identity documents | Passport/LinkedIn/CV professional photo presets (clearly labeled as self-photos, not ID documents) |
| Harmful impersonation / harassment-based manipulation | Celebrity **resemblance** search (never an identity claim — "visual resemblance," never "you are X") |
| Illegal content | — |

- **Consent notice**: shown before any face-manipulation tool runs — "Only upload images you have the right
  or permission to edit."
- **Sensitive-transformation confirmation**: age transformation, character swap of a real identifiable third
  party, etc. require an explicit "I confirm I have the right to edit this photo" checkbox, logged to
  `SafetyEvents`.
- **Report / Block / Appeal**: any result or shared project can be reported (`/v1/safety/report`); reported
  content is held pending `Safety Review`; repeat/severe violations block the account.
- **Provenance**: optional visible "AI Generated" badge; underlying C2PA-style metadata preserved where the
  format supports it; the app never strips another creator's existing watermark.

---

## 13. Privacy

**Private Mode** (toggle, with a persistent `🔒 Private Processing` indicator when on):

- Uploaded images are not permanently retained; temp processing files are deleted automatically after job
  completion (TTL on `Images.expires_at`).
- Images are never used for model training.
- Processing explained in plain language at the point of upload (which provider, cloud vs. local).
- Users can delete any project (hard delete, not just unlist), export their account data, and delete their
  account entirely (cascades through `Projects`, `Images`, `AIJobs` per user, retaining only anonymized
  `Usage`/billing records required for legal/accounting purposes).
- No privacy claim appears in the UI unless the corresponding technical control actually exists — this is a
  product rule, not just copy guidance.

---

## 14. Monetization

### 14.1 Principle
Never pretend an external AI provider's generation is free to the business — "unlimited" only ever describes
the **app-level** credit gate (brief §76). Real infrastructure cost is tracked per job regardless of what the
user is charged (`AIJobs.cost_actual`, rolled up in the Owner dashboard, §15.4).

### 14.2 Free tier (genuinely usable, not crippled)
Basic face swap, multi-face swap, hair tools, clothing tools, background tools, photo enhancement, character
tools, basic AI Creator, basic projects — all included, no artificial watermark.

### 14.3 Premium
Higher resolution, faster processing, video, batch processing, advanced models, larger storage, advanced
character consistency, professional workflows.

### 14.4 Credit protection
No credit is deducted when: generation technically fails, output is corrupted, QC gate fails (§3.4), server
error occurs, or output lacks the requested transformation. Failed jobs auto-retry (≤2 extra attempts) before
being shown to the user as failed; the job log is visible to the user in-app.

### 14.5 Advertising
No ad before every generation, no stacked ads, no ads blocking core editing. If/when implemented: at most one
*optional* rewarded ad ("Watch an ad to support free processing"), chosen by the user, never forced.

---

## 15. Owner / Admin Mode & Master Access

### 15.1 Configuration (server-side only, never hard-coded)

```
OWNER_EMAIL=roshanmani1987@gmail.com
OWNER_ACCESS_KEY=<set via secret manager, never committed>
UNLIMITED_FREE_MODE=true|false
```

Reused unchanged from the pattern already shipped in `expertprompter/`, `docs/mixforge-studio/SPEC.md §11.3`
and `docs/dj-radicalmix/SPEC.md §11.3`: the owner's account is recognized automatically once
`roshanmani1987@gmail.com` signs in and is verified — **no separate password is created, typed or stored** for
that path. If a shared device needs a separate master login with no personal email, it is created by a
bootstrap script run once, interactively, storing only an Argon2id hash — never a plaintext credential in any
spec, ticket or chat log, consistent with the same rule already on record in this repo.

### 15.2 What `UNLIMITED_FREE_MODE` actually changes

Unlimited generations, no credit deduction, no artificial watermark, no ads, all tools unlocked (including
batch), premium UI, storage up to real infrastructure limits, developer testing access. It is purely an
`ent: ["*"]` style entitlement on the Owner's own account.

### 15.3 What it never changes (§0.2)

Safety checks (§12), consent screens, age-estimation gating, provenance watermarking on flagged content, and
other users' data access. Enabling it does not create a backdoor into other accounts.

### 15.4 Owner dashboard (`/owner`, role-gated)

Sections: Users · Projects · AI Jobs · AI Models · Usage · System Health · Storage · Errors · Revenue ·
Subscriptions · Safety · Reports · Analytics. Top-line metrics: total/successful/failed generations, average
processing time, most-used tools/models, storage consumption, **actual AI cost** vs. owner usage vs.
daily/monthly cost (direct implementation of brief §76).

Owner-togglable switches shown on `/owner`: Unlimited Mode (on/off), current AI model + fallback, default
quality, watermark (off), ads (off), credits (unlimited), batch (unlimited), video (enabled), all tools
(unlocked) — each change is written to `AuditLogs`.

### 15.5 Enforcement

Every owner/admin action (toggling a flag, viewing another user's job for support, issuing a safety override
on a report) is written to the append-only `AuditLogs` table and is itself subject to the safety constraints
in §12 — "Owner" is an entitlement role, not a bypass of the safety pipeline.

---

## 16. Feedback Loop & Analytics

Post-generation prompt: `👍 Great` / `😐 Needs improvement` / `👎 Poor`. On "Poor," a checklist (`Face
changed` / `Clothing changed` / `Background changed` / `Poor quality` / `Wrong hairstyle` / `Wrong
expression` / `Other`) is stored to `Feedback` and rolled into the Owner dashboard's Analytics section to
prioritize model/pipeline fixes.

---

## 17. Performance, Offline Mode & Error Recovery

- Image compression, caching, lazy loading, background processing, CDN delivery, progressive image loading —
  the UI thread is never blocked while an AI job runs (jobs are async, §10).
- Offline: crop, resize, filters, basic adjustments and local gallery management work with no network; any
  control that needs a model clearly shows a "requires internet" state instead of silently doing nothing.
- On failure: the original image is never lost; the user can retry, switch model, change settings, or try a
  different tool without losing their place in the project timeline (§7).

---

## 18. Build Roadmap

| Phase | Scope |
|---|---|
| 1 | Core UI, navigation, auth, Home, Tools, Projects, Profile |
| 2 | Upload, image editor shell, face detection, masking, Before/After |
| 3 | Face Swap, Multi Face Swap, Hair, Clothing, Background tools |
| 4 | Character, Body, Beauty, Enhancement, Restoration |
| 5 | AI Creator prompt engine, Edit Plan, Region Regenerate, Identity Lock, Smart Edit Locks |
| 6 | Video architecture (interfaces only), batch processing, advanced model tiers |
| 7 | Owner dashboard, analytics, safety review tooling, privacy controls |
| 8 | Performance hardening, test coverage, error-recovery paths, production deploy |

Each phase ships behind the provider-abstraction layer (§8.3) so AI model work can proceed in parallel with
UI work without either blocking the other.
