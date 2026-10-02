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
