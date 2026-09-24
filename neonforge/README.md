# NeonForge AI: MVP

Cross-platform AI photo and video editor built from [`docs/ai-media-editor/SPEC.md`](../docs/ai-media-editor/SPEC.md).
This directory holds the first working slice: spec milestones **M0 to M3** (foundations, photo core, video core, batch).

```
neonforge/
├─ backend/   FastAPI API · priority job queue · media engine (Python)
├─ web/       React + TypeScript web app (Vite)
└─ docker-compose.yml   Postgres + Redis + API + workers + web
```

## What works today

| Area | Status |
|---|---|
| Upload | JPG, PNG, WEBP, GIF, MP4, MOV, AVI. Magic-byte type check, size and duration limits per plan, thumbnails, content analysis (faces, noise, blur, scene), safety screening hook |
| Enhance | Auto enhance (denoise, white balance, levels, clarity, sharpening, saturation), manual exposure and contrast, HDR (exposure fusion), 7 colour-grade LUTs |
| Upscale | 2x, 4x and 8x. **Real-ESRGAN** when PyTorch and its weights are installed (GPU worker image); Lanczos plus detail recovery otherwise |
| Face | MediaPipe 478-point landmarks, texture-preserving skin smoothing, blemish removal, eye enhancement, face-detail restore, landmark smoothing across video frames |
| Background | Remove (transparent, white or colour fill), replace (preset backdrops, your own photo, or a colour) with light wrap and colour matching, bokeh blur. Matting: MediaPipe person segmenter fused with U²-Net, then guided-filter edge refinement and a temporally smoothed matte for video |
| Video / GIF | Frame pipeline with global statistics (no flicker), LK-flow stabilization (standard, strong, tripod), audio kept, GIF with one global palette, 3-second previews |
| Batch | One recipe applied to N files, plan-based concurrency, pause, resume, cancel, retry failed, live per-file progress (WebSocket, with SSE fallback), ZIP download |
| Credits and plans | Free, Pro and Studio limits from spec §11. Credits are reserved at submit and refunded on failure or cancel. Free-tier watermark |
| Export | SD, HD, Full HD, 4K, 8K or original (downscale only, capped by plan). JPG, PNG, WEBP, MP4, MOV, GIF. AI-edit provenance (XMP / IPTC digital source type). Signed download URLs |
| Web app | Login, Home, Upload (multi-file and folder), Editor (before/after slider, tool panels, edit stack, live preview), Export, Recipe builder, Batch manager, Settings. Dark neon theme, light theme, mobile layout |

### Not in this slice (next milestones)

- **Face swap (M4)** and **dress swap / AI backgrounds (M5)**. The API rejects these ops, and the UI shows them as "coming soon" with the consent rules. They need GPU diffusion workers, a commercially licensed swapper model, liveness-checked consent and an NSFW classifier deployed first (spec §0, §15).
- **GFPGAN** face restoration and **BiRefNet** / **Depth Anything** matting on GPU. The adapters in `engine/adapters` are the extension points.
- **Flutter mobile app**, tus resumable uploads, cloud-storage export, Stripe / StoreKit / Play billing, C2PA signing with a real certificate, and the storage janitor for retention.

## Run it locally

```bash
# backend (Python 3.11; MediaPipe needs libegl1 + libgles2 on Linux)
cd neonforge/backend
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
python scripts/fetch_models.py          # ~25 MB; add --all for Real-ESRGAN + ISNet
neonforge-api                           # http://localhost:8000/docs (embedded worker, SQLite)

# web
cd neonforge/web
npm install
npm run dev                             # http://localhost:5173
```

Or run everything together with Postgres, Redis and two separate workers: `docker compose up --build` from `neonforge/`.

## Tests

```bash
cd neonforge/backend && pytest                       # 61 tests; runs without models (fallback paths)
NF_TEST_MODELS_DIR=data/models pytest                # + real-model paths
NF_TEST_DATABASE_URL=postgresql+psycopg://… NF_TEST_REDIS_URL=redis://… pytest

cd neonforge/web && npm run typecheck && npm test    # unit
npx playwright test                                  # E2E against a running stack
```

CI (`.github/workflows/neonforge.yml`) runs all of these. The backend suite runs twice: once on SQLite without models, and once on Postgres and Redis with models.

## Architecture notes

- **Queue:** Redis sorted set (higher plan priority first, then FIFO), or in-memory for dev. Workers claim jobs with an atomic `UPDATE … WHERE status='queued'`, so no job runs twice, and cancelling a job never races with a worker picking it up.
- **Batches:** jobs start as `pending`. `fill_batch` promotes up to `plan.batch_in_flight` of them to `queued`, so one Studio batch can't starve other users.
- **Engine:** each op implements `setup(samples)` and `apply(frame, i)`. Statistics are measured once in `setup`, which keeps video output flicker-free. `stabilize` always runs first and `upscale` always runs last.
- **Web stack:** the editor is a Vite + React single-page app. The spec's Next.js choice (§3.1) was for SEO, which only matters for the future marketing site, so that site can be Next.js on its own.
- **Models:** `engine/adapters/__init__.py` holds the registry. Every listed model is licensed for commercial use. Non-commercial models (inswapper, CodeFormer, IDM-VTON, FLUX-dev) are deliberately left out (spec §15).
