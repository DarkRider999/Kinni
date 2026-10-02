# NeonForge Studio — Ultimate Free AI Photo Editor & Design Suite: Product & Technical Specification

> Cross-platform (mobile + web + desktop) free-first photo editing and design app in the vein of Picsart,
> Snapseed and Canva: full manual editing toolkit, AI tools, fonts, stickers, filters, templates and
> lightweight video — one hub instead of five apps.
> Version 1.0 · Status: Blueprint (implementation-ready; not yet built — see §0.1)
> Author of this spec's brief: Roshan (Super Admin) · Related spec: [`docs/ai-face-studio/SPEC.md`](../ai-face-studio/SPEC.md)

---

## Table of Contents

0. [Scope, Status & Naming Note](#0-scope-status--naming-note)
1. [Product Vision](#1-product-vision)
2. [Super Admin Role](#2-super-admin-role)
3. [Core Photo Editor](#3-core-photo-editor)
4. [AI Tools](#4-ai-tools)
5. [Asset Libraries: Fonts, Stickers, Filters, Templates, Backgrounds](#5-asset-libraries-fonts-stickers-filters-templates-backgrounds)
6. [Lightweight Video Editor](#6-lightweight-video-editor)
7. [Technical Architecture](#7-technical-architecture)
8. [Database Schema](#8-database-schema)
9. [API Endpoints](#9-api-endpoints)
10. [Safety & Content Policy](#10-safety--content-policy)
11. [Monetization (Free-First)](#11-monetization-free-first)
12. [Roadmap: MVP → v1 → v2](#12-roadmap-mvp--v1--v2)

---

## 0. Scope, Status & Naming Note

### 0.1 Implementation status

This is a **blueprint-level deliverable** — feature spec, UI/UX structure, architecture, database schema, API
contracts and a phased roadmap — not a working app in this commit. The AI tools (§4) are specified against a
provider-agnostic interface (same pattern as `docs/ai-face-studio/SPEC.md §8.3`) so open models (Stable
Diffusion, Real-ESRGAN, U²-Net/MODNet, inpainting models) can be wired in without an app-wide refactor.

### 0.2 Naming collision — flagged, not resolved here

This repo already contains an unrelated spec titled **"NeonForge AI"** (`docs/ai-media-editor/SPEC.md`), a
face-swap/enhancement/outfit-swap product. **NeonForge Studio** (this document) is a different product —
Picsart/Canva-style general editing and design, with no identity-manipulation tools — but the brand name
overlaps closely enough to confuse users and app-store listings. Recommend renaming one of the two before
either ships publicly; this spec does not pick which.

### 0.3 Relationship to AI Face Studio

Any face-identity feature a user asks for in NeonForge Studio (face swap, face age edit, body reshaping) is
out of this app's scope by design and should deep-link to **AI Face Studio**
(`docs/ai-face-studio/SPEC.md`) rather than be re-implemented here. NeonForge Studio's own AI tools (§4) stay
scoped to background/object/style/upscale/text-to-image work that does not manipulate a real person's
identity.

---

## 1. Product Vision

A free-first, one-stop photo editing and design hub: every tool a Picsart/Snapseed/Canva user expects —
cropping and color tools, AI background/object tools, a full font and sticker library, filters, templates,
collage, and a lightweight video editor — in one app, with a genuinely usable free tier (§11) and a
Super Admin role (§2) for internal testing and content curation.

---

## 2. Super Admin Role

### 2.1 Configuration (server-side only, never hard-coded)

```
OWNER_EMAIL=roshanmani1987@gmail.com      # Roshan — matches the pattern already used across this repo
OWNER_ACCESS_KEY=<set via secret manager, never committed>
SUPER_ADMIN_MODE=true|false
```

Reused unchanged from the Owner/Master-access pattern already specced in `docs/ai-face-studio/SPEC.md §15.1`
and shipped in `expertprompter/`: the account tied to `roshanmani1987@gmail.com` is recognized automatically
once signed in and verified — **no plaintext password is ever created, typed, or committed** to this spec,
code, or chat. Every Super Admin action is written to an append-only `AuditLogs` table (§8).

### 2.2 What Super Admin unlocks (brief's intent, scoped safely)

- Unlimited AI credits and unlimited exports (HD, 4K, transparent PNG, layered export).
- Unlimited access to every font, sticker, filter and template, including ones still in review.
- Developer console: job logs, model configs, feature flags.
- Ability to approve/reject community asset uploads (§5.4) and manage global styles/fonts/stickers.
- Ability to change user roles, bypass rate limits, and test unreleased ("beta") features.
- An experimental "God Mode" editor surface for trying unreleased AI tools before general release.

### 2.3 Hard limits on Super Admin — never configurable, never bypassed

| Restriction | Why |
|---|---|
| Cannot disable the NSFW/minor/identity safety filters (§10) | Those checks protect real people depicted in user photos; an admin role is an entitlement, not a safety bypass — mirrors `docs/ai-face-studio/SPEC.md §0.2`. |
| Cannot generate content that violates §10's blocked list | Same reasoning — "unlimited" means unlimited *quota*, never unlimited *policy*. |
| Cannot access another user's private vault contents | User assets uploaded under **Private Vault** (§3.6) are stored with per-user envelope encryption; Super Admin has account/billing visibility but not a decryption path to vault contents, enforced the same way `docs/ai-face-studio/SPEC.md §15.3/§15.5` scopes the Owner role: broad entitlement on the admin's own usage, zero special read access into other users' private content, and every elevated action audit-logged. |

---

## 3. Core Photo Editor

Full manual toolkit, available to every user, free tier included:

| Category | Tools |
|---|---|
| Geometry | Crop, Free Crop, Shape Crop, Rotate, Flip, Perspective, Skew, Resize (with presets) |
| Tone & Color | Brightness, Contrast, Saturation, Vibrance, HSL panel, Curves (RGB + per-channel) |
| Detail | Dehaze, Clarity, Texture, Sharpen, Structure |
| Optical effects | Lens Blur, Vignette, Grain/Film, Halation, Bloom, Chromatic Aberration |
| Selective editing | Brush mask, Gradient mask, Radial mask |
| Retouch | Healing, Clone, Dodge & Burn |
| Creative | Double Exposure, HDR-scape, Vintage, Noir, Drama, Grunge, Retrolux-style presets |
| Portrait (non-identity) | Skin smoothing, eye brighten/sharpen, teeth whiten, light reshape/makeup overlays — cosmetic adjustment only, no identity swap (that lives in AI Face Studio) |
| Collage | Grid, Freestyle, Scrapbook layouts |

### 3.6 Private Vault
Opt-in encrypted storage for a user's own uploads/exports, excluded from Super Admin content review and from
any model-training pipeline (same technical commitment as `docs/ai-face-studio/SPEC.md §13` Private Mode).

---

## 4. AI Tools

| Tool | Notes |
|---|---|
| AI Background Remover | Hair-aware, edge-aware segmentation (U²-Net/MODNet class model) |
| AI Object Remover | Tap-to-remove, inpainting fill |
| AI Replace | Sky / background / object replacement via inpainting + a text or template prompt |
| AI Expand / Outpainting | Extends canvas beyond original frame |
| AI Enhance | Super-resolution + face *restoration* (sharpening/denoise of an existing face, not identity change) |
| AI Upscale | 2x / 4x (Real-ESRGAN class model) |
| AI Filters | Themed packs: 80s glam, cocktail chic, old-money, cyberpunk, neon, cinematic |
| AI Avatars | Cartoon / anime / fantasy / professional-headshot style transfer from a user's own uploaded photo, each output labeled "AI Generated" |
| AI Style Transfer | Painting, sketch, 3D, comic |
| AI Text-to-Image | Diffusion model (e.g., Stable Diffusion class) for pure generation, no uploaded-person reference |
| AI Background Generator | Autumn, neon city, studio, fantasy, etc. |
| AI Story/Post Generator | Auto-composes layout + font + stickers from a short prompt or a selected template |

All of the above stop at **cosmetic/stylistic** transformation of a user's own photo or pure generation from
text; anything that would re-identify or alter a real depicted person's face as *someone else* (face swap,
identity-preserving age/body edit) is explicitly routed to AI Face Studio (§0.3) rather than built twice.

---

## 5. Asset Libraries: Fonts, Stickers, Filters, Templates, Backgrounds

### 5.1 Fonts
Sans, Serif, Display, Script, Handwritten, Cursive, Calligraphy, Retro, Neon, Graffiti; multi-script support
(Arabic, Hindi, Tamil, Urdu, Malayalam, Telugu); weight/width variants (Bold/Light/Black/Condensed/Expanded);
text effects (stroke, shadow, highlight, gradient fill, texture fill); text-on-path (circle/wave/arc); custom
TTF/OTF upload; searchable discovery screen with live preview.

### 5.2 Stickers
Emoji, meme, shape, frame, doodle, icon, label categories; seasonal/birthday/travel/food/fashion/kids/animal/
nature packs; animated stickers for video; a custom sticker maker (remove background → save as sticker);
community sticker marketplace with the moderation flow in §5.4.

### 5.3 Filters & Templates
Filter categories: FX, B&W, Blur, Colors, AI, Film/Retro/Grain/Dust, Neon/Cyberpunk/Vaporwave, Cinematic
LUTs, Portrait, Landscape, Artistic (oil/watercolor/sketch), trending social filters. Templates: Instagram
Story/Reel, TikTok, YouTube Shorts, Poster, Flyer, Invitation, Business Card, YouTube Thumbnail, Logo, Banner
— each a `Template` record bundling layout + fonts + stickers + filter preset, auto-sized to the target
platform's dimensions.

### 5.4 Community uploads & moderation
User-submitted stickers/templates enter a `pending` review queue; Super Admin (or a delegated moderator role)
approves or rejects before an asset is listed publicly — approval is itself an audited action (`AuditLogs`).

---

## 6. Lightweight Video Editor

Trim, split, merge; filters/LUTs; text, stickers, overlays; speed control; music import plus a free licensed
library; one-tap export presets sized for Instagram/TikTok/YouTube Shorts/Facebook.

---

## 7. Technical Architecture

### 7.1 Client
Flutter (mobile + web + desktop single codebase), matching the brief's stated stack choice; shared design
tokens with AI Face Studio's `@aifacestudio/ui` package kept as separate libraries (different apps, same
design-language family).

### 7.2 Backend
Node.js or Python (FastAPI); job queue for AI tasks; object storage + CDN for assets and exports.

### 7.3 AI engine
Stable Diffusion (text-to-image, AI Replace/Expand) · Real-ESRGAN (upscale) · U²-Net / MODNet (background
removal) · an inpainting model (object remove/replace) — each behind the same `AIProvider`-style interface
defined in `docs/ai-face-studio/SPEC.md §8.3`, so NeonForge Studio and AI Face Studio can share adapters for
anything both apps need (upscaling, background tools) instead of each shipping its own.

### 7.4 Data
PostgreSQL (users, projects, billing, moderation) + MongoDB (flexible asset/template metadata) + S3-class
object storage + CDN.

---

## 8. Database Schema

```
Users(id, email, role[user|moderator|super_admin], created_at, private_vault_enabled)
Projects(id, user_id, title, canvas_json, thumbnail, created_at, is_favorite)
Assets(id, type[font|sticker|filter|template|background], name, owner_user_id|null, status[pending|approved|rejected],
       storage_key, category, is_premium_only, created_at)
AIJobs(id, user_id, project_id, tool, provider, model, status, billable, cost_actual, created_at, completed_at)
Exports(id, project_id, format[jpg|png|webp], resolution, transparent_bg, storage_key, created_at)
Favorites(user_id, asset_id, created_at)
Subscriptions(id, user_id, plan[free|premium], status, renews_at)
ModerationQueue(id, asset_id, submitted_by, status, reviewed_by, reviewed_at, reason)
AuditLogs(id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
Usage(id, user_id, date, exports_count, ai_jobs_count, storage_bytes)
```

---

## 9. API Endpoints

```
POST   /v1/projects                       create project
POST   /v1/projects/:id/export             body: { format, resolution, transparentBg }

POST   /v1/jobs/bg-remove
POST   /v1/jobs/object-remove
POST   /v1/jobs/ai-replace
POST   /v1/jobs/outpaint
POST   /v1/jobs/upscale
POST   /v1/jobs/text-to-image
POST   /v1/jobs/ai-avatar
GET    /v1/jobs/:id

GET    /v1/assets?type=font|sticker|filter|template|background&category=
POST   /v1/assets                          community upload → status: pending
POST   /v1/admin/assets/:id/approve        super_admin / moderator only
POST   /v1/admin/assets/:id/reject         super_admin / moderator only

GET    /v1/admin/dashboard/*               super_admin only (usage, cost, moderation queue)
```

---

## 10. Safety & Content Policy

Same non-negotiable, server-side, un-disableable policy family as `docs/ai-face-studio/SPEC.md §12`, scoped
to this app's tools:

- AI Avatars / Style Transfer / Enhance operate only on a user's own uploaded photo; outputs are labeled "AI
  Generated." No tool in this app performs identity replacement — that is explicitly out of scope (§0.3).
- Text-to-image and AI Replace are run through an NSFW/minor-content classifier on every output before it is
  returned, with the same blocked categories as AI Face Studio §12's table (NCII, sexual content involving
  minors, exploitative imagery, fraudulent documents, harassment-based manipulation).
- Community-submitted assets (§5.4) go through moderation before public listing; a report/appeal flow mirrors
  AI Face Studio §12.
- Super Admin cannot disable any of the above (§2.3).

---

## 11. Monetization (Free-First)

All core editing tools, AI background/object tools, and the base font/sticker/filter/template library are
free with no artificial crippling. Optional premium: extra AI credits, premium-only fonts/stickers/templates,
cloud sync, ad-free mode. No forced ad before every action, no stacked ads — at most one optional rewarded ad
a user chooses, same rule as `docs/ai-face-studio/SPEC.md §14.5`.

---

## 12. Roadmap: MVP → v1 → v2

| Stage | Scope |
|---|---|
| MVP | Core photo editor (§3), basic filter/font/sticker library, JPG/PNG/WEBP export, free tier only |
| v1 | AI tools (§4), templates (§5.3), community uploads + moderation (§5.4), Super Admin console (§2), premium tier |
| v2 | Lightweight video editor (§6), AI Story/Post Generator, cross-device cloud sync, expanded multi-script font library |
