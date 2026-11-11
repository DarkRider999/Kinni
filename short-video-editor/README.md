# short-video-editor (working name)

A browser-first short-form video editor: import clips, cut on a multi-track
timeline, auto-captions, music and beat-sync, export to 9:16 / 1:1 / 16:9.
It rebuilds the feature set of a top-grossing video editor using the Replica
skill pack (`.claude/skills/replica-*`), clean-room. No code, assets, templates or
copy from the original. The final name and brand come from `/replica-brand`.

## Status

| step | skill | output | state |
| --- | --- | --- | --- |
| 1 | `/replica-recon` | `replica/recon.md`, `replica/features.csv` | done |
| 2 | `/replica-architect` | `replica/architecture.md`, `replica/schema.sql` | done |
| 3 | `/replica-design` | `replica/design/` (tokens, components.md, screenshots), `web/src/design/` primitives at `#/design` | done |
| 4 | `/replica-build` | app source | next |
| 5 | `/replica-backend` | auth, storage, billing | |
| 6 | `/replica-test` | e2e specs, bug log | |
| 7 | `/replica-diff` | parity score | |
| 8 | `/replica-entrepreneur` | review themes, fix plan, angle | |
| 9 | `/replica-brand` | name, palette, sweep | |
| 10 | `/replica-launch` | landing page, pricing, store listing | |
| 11 | `/replica-deploy` | production | |

Parity score: `python3 ../.claude/skills/replica-diff/parity.py replica/features.csv`

## Web app

```bash
cd short-video-editor/web
npm install
npm run dev            # http://localhost:5173/#/design for the design system
npm test               # unit tests (format helpers, tokens sync, primitives a11y/keyboard)
npm run contrast       # WCAG AA check over every token pair
npm run tokens         # regenerate tokens.css/tokens.ts after editing replica/design/tokens.json
npm run design:shot    # build + Chromium screenshots into replica/design/ (fails on console errors or mobile overflow)
```
