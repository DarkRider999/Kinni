# Components: short-video-editor

Source of truth for every primitive the screens are built from. Each one is built and on show at `#/design` (`web/src/routes/DesignGallery.tsx`), styled only with tokens (`tokens.json` → `npm run tokens` → `tokens.css` / `tokens.ts`), and keyboard- and screen-reader-complete before any screen uses it.

How this was measured: capcut.com and the store listings were not reachable from the build sandbox, so `replica/screens/` is empty. The system follows the recon's component list (recon.md › Components) and the conventions of the category: dark chrome, dense inspector, colour-coded tracks. Nothing was copied from any app's assets. When screenshots exist, run `imgdiff.py` against them in `/replica-diff` and adjust the tokens, not the components.

Assets: icons are Lucide (ISC), the font is Inter Variable (OFL, self-hosted via @fontsource), and all copy is original. The accent `#9b8cff` is a placeholder until `/replica-brand`.

Contrast: `npm run contrast` checks 35 pairs with 0 AA failures (the list is in `tokens.json › pairs`).

---

```
Button
  variants  primary (accent), secondary (raised + border), ghost, danger
  sizes     sm 32px, md 36px, lg 44px (min hit target 32px from layout.hit-target-min)
  states    default, hover, active, focus-visible (2px ring, focus), disabled (45% opacity), loading (spinner, aria-busy)
  tokens    bg accent|surface-raised|danger, text on-accent|text|on-danger, radius md, font sm/600
  a11y      real <button type=button>; loading disables but keeps the label for screen readers
  used on   S01, S02, S16, S17, S18, S19, every dialog footer
```

```
IconButton
  variants  plain, toggle (aria-pressed: mute, lock, snap, keyframe mode)
  size      32×32
  states    default, hover, pressed (accent icon), focus-visible, disabled
  tokens    text text-muted → text on hover, bg surface-raised on hover
  a11y      `label` prop is required and becomes aria-label and the tooltip; optional shortcut is shown in the tooltip (e.g. "Split ⌘B")
  used on   S03 top bar (undo/redo), timeline toolbar (split, delete, snap, zoom), track headers (mute, lock, hide)
```

```
Badge
  tones     pro (gold on dark), neutral, success, danger
  tokens    pro/on-pro, surface-raised, text-muted, success, danger; radius pill, 2xs/700 uppercase
  a11y      text content only, never colour alone ("Pro", "Saved", "Offline")
  used on   S01 project status, S11 template cards, S16 resolution options, S18
```

```
Field / NumberField
  parts     label (xs/500 text-muted), input (32px, sunken bg, border-input), unit suffix, error (danger, role=alert)
  states    default, focus (2px focus ring), invalid (danger border + message), disabled
  keyboard  ↑/↓ step, Shift ×10, Enter commits, Esc reverts, blur commits; garbage reverts to the last value
  rules     clamp to [min,max] and snap to the step's precision (no 0.30000000000000004)
  a11y      role=spinbutton with aria-valuenow/min/max; visible <label for>
  used on   S12–S15 inspector (position, scale, rotation, opacity, volume, speed), S16
```

```
SliderField
  parts     label, optional KeyframeToggle, Radix slider (4px track, accent range, 14px thumb), linked NumberField (72px)
  states    default, dragging, focus-visible on the thumb, disabled
  keyboard  Radix: arrows step, PageUp/PageDown, Home/End
  a11y      slider and number input share one label (aria-labelledby)
  used on   S08 filter intensity, S12 transform/opacity, S13 text size, S14 volume/fades
```

```
KeyframeToggle
  states    none (outline diamond, text-subtle), has-keyframes (filled, text-muted), on-playhead (filled, accent)
  a11y      button, aria-pressed = on-playhead; label "Add/Remove <property> keyframe at playhead"
  used on   S12, S13 next to every animatable property
```

```
Switch
  states    off (sunken + border-input), on (accent), focus-visible, disabled
  a11y      Radix switch (role=switch) with a <label for>
  used on   S15 (pitch preserve), S16 (burn in captions), S20 settings, timeline snap
```

```
Select
  parts     trigger (32px), popper content (raised, shadow pop), items with an optional right-aligned hint (Pro badge, size estimate)
  states    closed, open, highlighted item, disabled item (e.g. 4K on free tier), focus-visible
  a11y      Radix select: typeahead, arrows, Esc closes, focus returns to trigger
  used on   S02 aspect ratio (alt to cards), S07 caption language, S16 resolution/fps/format
```

```
Tabs (horizontal)
  states    inactive (text-muted), active (text + 2px accent underline), focus-visible
  a11y      Radix tabs: roving tabindex, ←/→ moves, automatic activation
  used on   S12 inspector (Basic / Speed / Animation / Adjust), S18 monthly/annual
```

```
SideRail (vertical tabs)
  size      64px wide, 20px icon over 2xs label
  states    inactive, hover, active (raised bg + 3px accent bar), focus-visible
  a11y      Radix vertical tabs: ↑/↓ moves; each tab has a visible text label (not icon-only)
  used on   S03 left rail → S04 Media, S05 Audio, S06 Text, S07 Captions, S08 Effects, S09 Transitions, S10 Stickers, S11 Templates
```

```
Dialog
  parts     overlay (60% black), content (surface, radius lg, shadow modal, max 480px), title (xl/600), description, body, footer (right-aligned actions), close button
  states    open/closed; focus moves in on open and returns on close
  keyboard  Esc closes, Tab is trapped. The close button has no tooltip, because focus lands on it and an open tooltip would swallow the first Esc (regression-tested)
  a11y      role=dialog, labelled by its title, described by its description (sr-only fallback)
  used on   S16 export, S18 plans, S20 delete-local-data confirm, the stale-save conflict prompt
```

```
Toast
  tones     success, error, info (icon colour only; title text carries the meaning)
  timing    success/info auto-hide after 5s; errors stay until dismissed; max 4 stacked
  a11y      Radix toast live region (errors foreground/assertive, others polite); swipe right or close button to dismiss
  used on   export done/failed, import errors, autosave conflicts, quota reached
```

```
ProgressBar
  modes     determinate (percentage, tabular), indeterminate (sliding bar + detail text, e.g. "Loading speech model (75 MB, once)")
  a11y      role=progressbar with aria-valuenow, or aria-valuetext when indeterminate
  used on   S02/S04 import, S07 transcription, S16 export
```

```
Dropzone
  states    idle, hover, drag-over (accent border, surface bg), error (danger border + alert text)
  a11y      role=button, tabIndex 0; Enter/Space opens a real <input type=file> (multiple, accept filter); errors are role=alert
  copy      title "Drop videos, photos or audio", hint "or click to browse"; error text names the cause and the fix
  used on   S02 new project, S04 empty media panel, the full-window drop overlay
```

```
AssetCard
  parts     16:10 thumb (radius md), duration chip (mono 2xs on 70% black), corner badge (Pro / custom), name (xs, ellipsis)
  states    default, hover (border-input), selected (2px selection border, aria-pressed), loading (shimmer, disabled), locked (Pro badge; still selectable so the paywall check happens when the item is added, never at export)
  a11y      one <button>; accessible name = name + duration + status ("…, importing", "…, requires upgrade")
  used on   S04 media, S05 audio, S08 effects, S09 transitions, S10 stickers, S11 templates
```

```
TimelineClip
  kinds     video (track-video), image/overlay (track-overlay), audio (track-audio + waveform), text (track-text), caption (track-caption)
  parts     label (xs/600, on-track), trim handles 8px each side (selection colour when selected), optional waveform
  states    default, selected (2px selection inset), focus-visible (2px focus inset), muted (55% opacity), dragging/trimming (timeline-owned)
  geometry  left = start × pxPerSec, width = max(12px, duration × pxPerSec)
  keyboard  ← / → nudge one frame, Shift one second; the timeline adds Delete, ⌘B split, [ ] trim to playhead
  a11y      role=option inside a listbox per track; name = kind, label, start and length ("video clip Intro, starts 0:02.0, length 0:01.0")
  used on   S03 timeline
```

```
Tooltip
  look      inverted (text bg, bg text), xs, radius sm, optional <kbd> shortcut
  timing    400ms delay, 200ms skip-delay between neighbours
  a11y      hint only: everything in a tooltip is also in the control's accessible name
  used on   every IconButton, timeline toolbar
```

## Layout constants (tokens.layout)

| token | px | where |
| --- | --- | --- |
| topbar | 48 | S03 top bar |
| rail | 64 | S03 left rail |
| panel | 320 | S04–S11 panel width |
| inspector | 300 | S12–S15 right inspector |
| timeline-min | 220 | minimum timeline height (resizable) |
| track-height | 44 | each track row and each clip |
| track-header | 132 | mute/lock/hide header column |
| ruler | 24 | time ruler |
| hit-target-min | 32 | smallest clickable target (pointer); 44 on touch |
| bp-tablet / bp-desktop | 900 / 1200 | inspector collapses below 1200; the panel becomes a sheet below 900 |

## Still to build (they belong in /replica-build with their screens)

The video player canvas and transport (S03), the time ruler and playhead (S03), the curve editor (S15), the colour picker and font picker (S13), the context menu (S03), and the shortcut overlay (S20). Each one uses the tokens and primitives above.
