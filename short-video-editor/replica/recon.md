# Recon map: CapCut (web + desktop first, mobile web responsive)

Scope: the core editing loop. Import clips, then edit on a multi-track timeline (trim, split, speed, text, audio), then auto-captions, templates and effects, then export an MP4 at 9:16, 1:1 or 16:9.
For: Roshan Mani's product line. It is a browser-first short-form video editor for creators, DJs and small brands, sold on fair pricing with no export hostage. Distribution via MixForge / DJ RadicalMix audiences.
Date: 2026-10-10

> Clean-room recon. Everything here comes from public pages and third-party guides,
> read through search. Some notes came from no source and are marked "guess".
> No CapCut code, assets, copy, templates or private APIs were read or saved. capcut.com and
> apps.apple.com did not resolve from the build sandbox. Re-verify the "medium"
> confidence rows by hand in a free account before `/replica-diff`.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center (editing & exporting) | https://www.capcut.com/help/editing-and-exporting?pageNo=5 | trimming, transitions, export troubleshooting, Split Subtitle |
| 2 | marketing: how to use | https://www.capcut.com/resource/how-to-use-capcut | core loop in their words |
| 3 | marketing: PC editor | https://www.capcut.com/resource/pc-professional-video-editor | desktop feature list |
| 4 | marketing: keyframes | https://www.capcut.com/tools/keyframe-animation | keyframe properties: position, scale, rotation, opacity, colour |
| 5 | marketing: desktop AI | https://www.capcut.com/tools/desktop-ai-power | AI feature set |
| 6 | Google Play listing | https://play.google.com/store/apps/details?id=com.lemon.lvoverseas&hl=en_US | multi-track timeline, ratings ~3.6 |
| 7 | Microsoft Store listing | https://apps.microsoft.com/detail/xp9kn75rrb9nhs?hl=en-US&gl=US | desktop listing |
| 8 | App Store reviews | https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews&platform=mac | ~4.6 / 1.1M ratings |
| 9 | pricing guide | https://socialrails.com/blog/capcut-pricing-guide | Free / Standard $9.99 / Pro $19.99 |
| 10 | pricing guide | https://bigvu.tv/blog/capcut-free-vs-pro-what-2026s-restructure-actually-gives-you/ | 2026 restructure, 4K gated to Pro |
| 11 | pricing guide | https://www.eesel.ai/blog/capcut-pricing | tiers, cloud storage |
| 12 | shortcuts | https://www.skillademia.com/shortcuts/capcut-shortcuts/ | 49 hotkeys, Ctrl/⌘+B split |
| 13 | beginner guide | https://www.hooked.so/guides/how-to-use-capcut | split, export flow |
| 14 | captions guide | https://www.ruzuku.com/learn/tools/capcut/edit-course-videos | auto-captions flow |
| 15 | captions to SRT | https://gotranscript.com/en/blog/add-captions-subtitles-capcut-export-srt | caption export |
| 16 | review analysis | https://unstar.app/blog/capcut-everything-is-pro-now-cant-export-reviews-2026 | 900 negative reviews, Pro-lock themes |
| 17 | reviews | https://www.trustpilot.com/review/www.capcut.com | ~1.2–1.3/5, billing complaints |
| 18 | reviews | https://www.producthunt.com/products/capcut/reviews | |
| 19 | market data | https://www.businessofapps.com/data/top-grossing-apps/ | top-grossing non-game app list 2025 |
| 20 | market data | https://sensortower.com/press/press-release-boosted-by-gen-ai-services-consumers-spent-more-money-in-apps-than-games-for-first-time | non-game > games spend |

## Why this app

Business of Apps (src 19) lists CapCut among the top non-game grossing apps for 2025. TikTok, Google One, ChatGPT, YouTube, Tinder and Disney+ rank above it, but each of those sells a network, storage or licensed content. CapCut's value is mostly *tooling*, which can be rebuilt. Its users also complain loudly about the thing we can fix: Pro-locked exports (src 16, 17).

## Core loop

Drop clips in, cut them into a vertical short with captions and music, and export it ready to post. The tools that make that loop fast are what people pay for: AI captions, templates, 4K export and no watermark.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Home / projects | `/` after sign-in | list projects, start new, pick aspect ratio | project grid, New project button, aspect picker, search | empty, filled, loading |
| S02 | New project: aspect & import | New project | choose 9:16 / 16:9 / 1:1 / 4:5, drop media | aspect cards, dropzone | empty, uploading, error (unsupported codec) |
| S03 | Editor shell | `/editor/:projectId` | main workspace | top bar (name, undo/redo, export), left media panel, centre player, right inspector, bottom timeline | empty project, filled, saving, offline (guess) |
| S04 | Media panel | editor left tab "Media" | imported files, drag to timeline | media grid, import button, filter by type | empty, filled, importing (progress) |
| S05 | Audio panel | left tab "Audio" | music, sound effects, voiceover record, extract audio | track list, preview play, record button | empty, playing, mic permission denied |
| S06 | Text panel | left tab "Text" | add text, text templates, auto-captions entry | style presets, Add text, Auto captions | default |
| S07 | Captions panel / editor | Text → Auto captions | generate timed subtitles from speech, edit, restyle, split | language select, Generate, caption list (time + text), style presets | idle, generating (progress), done, failed (no speech) |
| S08 | Effects & filters panel | left tab "Effects" / "Filters" | apply visual effects and colour filters | effect grid, intensity slider | default, applied |
| S09 | Transitions panel | left tab "Transitions" | drop transitions between clips | transition grid, duration | default |
| S10 | Stickers / overlays | left tab "Stickers" | overlays, emoji, shapes | grid | default |
| S11 | Templates browser | home or left tab "Templates" | start from a template, replace media slots | template cards, preview, "Use template", slot list | browsing, previewing, Pro-locked |
| S12 | Inspector: video clip | select video clip | transform, opacity, blend, speed, volume, keyframes, chroma key, background removal, auto reframe | numeric inputs, sliders, keyframe diamond, tabs (Basic / Speed / Animation / Adjust) | none-selected, clip-selected, multi-select |
| S13 | Inspector: text clip | select text clip | font, size, colour, stroke, shadow, animation in/out | font picker, colour picker, toggles | |
| S14 | Inspector: audio clip | select audio clip | volume, fade in/out, speed, beat marks, noise reduction | sliders, toggles | |
| S15 | Speed curve editor | Inspector → Speed → Curve | ramp speed over time with presets | curve graph, presets (montage, hero, bullet, jump cut) | default, custom |
| S16 | Export dialog | top bar Export | name, resolution, fps, codec, format, captions file | selects, size estimate, Export button | idle, Pro-gated (4K), exporting (progress), done, failed |
| S17 | Export complete / share | after export | download, copy, share to TikTok / YouTube | download button, share buttons | done |
| S18 | Paywall / plans | gated feature or Upgrade | upsell to Standard / Pro | plan cards, monthly/annual toggle | default |
| S19 | Sign in / sign up | first visit | account | email, Google, TikTok login | default, error |
| S20 | Settings | avatar menu | account, subscription, storage, language, shortcuts | form, storage meter | |

## Flows

```
F01 Make a vertical short from raw clips (the core loop)
    S01 -> S02 (pick 9:16, drop 3 clips) -> S03/S04 (drag to timeline) -> trim/split on timeline
    -> S05 add music -> S06/S07 auto captions -> S16 export 1080p -> S17 download
    happy path clicks: ~14 (guess, from guides 13/14)
    edge: unsupported codec, very long file (>2 GB), portrait + landscape mixed,
          export tab closed mid-render, no speech found for captions, out of storage

F02 Generate and fix auto-captions
    S03 -> S06 -> S07 pick language -> Generate -> edit text in list -> restyle preset -> split a caption
    happy path clicks: 5
    edge: music-only audio, two speakers, non-English, wrong word timings, captions past clip end

F03 Start from a template
    S01/S11 browse -> preview -> Use template -> replace each media slot -> S16 export
    happy path clicks: ~6 + 1 per slot
    edge: too few clips for slots, clip shorter than slot, template is Pro

F04 Cut to the beat
    S03 add music -> S14 beat marks (auto) -> clips snap to beat marks -> split at marks
    happy path clicks: 4
    edge: tempo changes, no clear beat

F05 Polish a clip
    select clip -> S12 keyframe position/scale -> S15 speed curve -> S08 filter -> S09 transition
    edge: keyframe outside clip after trim, speed change shifts later clips

F06 Remove background / green screen
    select clip -> S12 Cutout -> Auto remove | Chroma key (pick colour, intensity)
    edge: low-light footage, hair edges

F07 Export
    S16 choose res/fps/format -> Export -> progress -> S17
    edge: 4K requested on free tier, Pro effect present (original blocks export: complaint theme)

F08 Upgrade
    any Pro-locked item -> S18 -> checkout -> back to S03 with feature unlocked
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, hover, focus, disabled, loading | all |
| Top bar | editor, home | saving, saved, offline | S01, S03 |
| Side tab rail | icon + label | active, inactive, Pro badge | S03–S11 |
| Asset grid card | media, effect, transition, sticker, template | default, hover-preview, selected, Pro-locked, loading | S04–S11 |
| Dropzone | full-page, panel | idle, drag-over, uploading, error | S02, S04 |
| Video player / canvas | 9:16, 16:9, 1:1, 4:5 | playing, paused, scrubbing, safe-area overlay | S03 |
| Transport | play/pause, timecode, fullscreen, ratio | | S03 |
| Timeline | tracks: main video, overlay, text, audio, effect | zoom, playhead, snapping, selection, drag, trim handles, split | S03 |
| Timeline clip | video, image, audio (waveform), text, caption, effect | default, selected, trimming, muted, locked | S03 |
| Inspector panel | tabbed | none-selected, single, multi | S12–S14 |
| Slider + numeric input | | default, focus, keyframed | S12–S15 |
| Keyframe toggle (diamond) | | off, on-at-playhead, has-keyframes | S12, S13 |
| Colour picker | swatch, hex, eyedropper | | S13, S06 |
| Font picker | | loading, selected | S13 |
| Curve editor | | | S15 |
| Modal | export, confirm, paywall | | S16, S18 |
| Progress bar | determinate, indeterminate | | S02, S07, S16 |
| Toast | info, success, error | | all |
| Context menu | clip | | S03 |
| Keyboard shortcut overlay | | | S20 |

## Inferred data model

```
User        id, email, name, auth_provider, plan (free|standard|pro), created_at
            evidence: S19, S18, pricing sources 9–11   confidence: high

Project     id, user_id, name, aspect_ratio (9:16|16:9|1:1|4:5), fps, duration_ms,
            thumbnail_url, updated_at, timeline (json document)
            evidence: S01, S02, S03 autosave              confidence: high (json timeline is a guess)

Asset       id, user_id, kind (video|image|audio), filename, mime, size_bytes,
            duration_ms, width, height, storage_key, waveform/thumbs keys
            evidence: S04, cloud storage on pricing pages confidence: high

Track       id, project_id, kind (main|overlay|text|audio|effect), order, muted, locked
            evidence: S03 timeline, "multi-track" (src 6)  confidence: high

Clip        id, track_id, asset_id?, start_ms (on timeline), in_ms, out_ms (source range),
            speed (0.1–100) | speed_curve (json), volume, fade_in_ms, fade_out_ms,
            transform {x,y,scale,rotation,opacity}, keyframes (json), filters (json),
            effects (json), transition_in (json), chroma_key (json), cutout (bool)
            evidence: S12–S15, src 4, src 12              confidence: medium

TextClip    = Clip with text, style {font, size, color, stroke, shadow, bg}, anim_in, anim_out
            evidence: S13                                 confidence: high

CaptionSet  id, project_id, language, style preset, cues [{start_ms,end_ms,text,words[]}]
            evidence: S07, src 1 (Split Subtitle), src 15 (SRT export)  confidence: high

Template    id, name, aspect, duration, slots [{index, min_duration_ms}], timeline json, is_pro
            evidence: S11                                 confidence: medium

ExportJob   id, project_id, resolution, fps, format, status, progress, output_key, error
            evidence: S16, S17                            confidence: high

Subscription id, user_id, plan, period (month|year), status, renews_at, provider
            evidence: S18, billing complaints (src 17)    confidence: high
```

Relationships: User 1-n Project, User 1-n Asset, Project 1-n Track, Track 1-n Clip, Clip n-1 Asset, Project 1-n CaptionSet, Project 1-n ExportJob, User 1-1 Subscription.

## Feature matrix

See `features.csv`. Must: 20, should: 15, could: 9, skip: 6.

## Out of scope (cannot or should not be cloned)

- **Template library content**: the original's templates are creator-made content it owns or licenses. We ship our own templates.
- **Music and sound-effect catalogue**: licensed. Use user-uploaded audio plus a royalty-free set we license (or MixForge stems we own).
- **Stickers, fonts and effect packs**: proprietary assets. Use open-licence fonts (OFL) and our own effects.
- **TikTok account login and direct posting partnership**: a partner deal. Use the official TikTok / YouTube upload APIs with the user's own keys later.
- **Creator community / template marketplace**: the network and its users.
- **Proprietary AI models**: we use our own or licensed models (Whisper-class open ASR, open segmentation models).

## Size

Screens 20, flows 8, entities 9.
Hard parts:
1. **A real-time multi-track preview in the browser**: WebCodecs decode, a canvas/WebGL compositor, audio sync.
2. **Frame-accurate export in the browser**: WebCodecs encode + an MP4 muxer, with a server-side FFmpeg fallback for long or 4K jobs.
3. **AI**: speech-to-text captions with word timings, background removal, beat detection. Beat detection reuses DJ RadicalMix's DSP.
Others: an undo/redo command model over the timeline JSON, keyframe interpolation, large-file upload and storage.

Size: **L** (a quarter) for the full matrix. The must-have slice (F01 + F02 + F07, with export ≤1080p) is **M** (a few weeks).
