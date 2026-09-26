# ExpertPrompter

Type any idea or task in plain words. ExpertPrompter:

1. detects the task category (Writing, Business, Coding, Image, Video, Music, Marketing, Education, Data Analysis, Research, General Writing),
2. writes a detailed, structured prompt for it,
3. recommends the AI tools best suited to the task (ChatGPT, Claude, GitHub Copilot, Midjourney, Suno…),
4. lets you pick a prompt style and constraints (tone, length, format, audience, language),
5. offers one-click copy, regenerate, download, and saved history,
6. lets you attach files: an **Upload file** (the document or code to work on) and **Reference files** (examples of the style you want),
7. gives every account 5 free prompts, then offers Premium for $10/month (Stripe), with sign-in through Google, Facebook, GitHub or email.

All prompt generation is **pure, deterministic TypeScript**. When you attach a photo, a free AI model running **in the visitor's browser** describes it so the prompt can recreate it (see §5c). No API key or server AI is needed.

---

## 1. Stack and why

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (pages router) + React + TypeScript + Tailwind CSS** | One project serves both the UI and the API, and it deploys to Vercel in a single step. `darkMode: 'class'` gives a dark/light toggle with no extra dependencies |
| API | **Next.js API routes** (`pages/api/*`, serverless functions on Vercel) | Same origin as the UI, so there's no CORS setup and no separate server to host |
| Database | **PostgreSQL via Prisma 5** | Typed queries, migrations, native enums and `String[]` columns for tool lists |
| Validation | **zod** | One schema serves as the runtime check and the TypeScript type |
| Auth | **Email/password + Google, Facebook, GitHub (OAuth 2.0) → JWT** | One-click sign-up. Every sign-in method ends in the same stateless session token |
| Payments | **Stripe Checkout + Billing Portal + webhooks** | Stripe hosts the card forms and cancellation page, so no card data touches the app |
| Hosting | **Vercel + Supabase Postgres** | Vercel runs the app. Supabase provides a free hosted Postgres with a connection pooler that suits serverless functions |
| Tests | **Vitest** | Services and API route handlers are tested without a database |

**Access rules** (`lib/server/services/entitlementService.ts`):

| Plan | Who | Limit |
|---|---|---|
| **Master** | Accounts an admin flagged `isMaster` in the database (e.g. a shared username/password login), or emails in `MASTER_EMAILS` once Google/Facebook/GitHub has confirmed the email | Unlimited, free |
| **Premium** | Accounts with an `active` or `trialing` Stripe subscription | Unlimited, $10/month |
| **Free** | Everyone else | 5 generations in total (Generate, Regenerate and category switches each count as one) |

- **Sign-in required:** in production you must sign in to generate. The API returns `401 AUTH_REQUIRED`, and the UI opens the sign-in dialog.
- **Paywall:** after 5 generations the API returns `402 PAYWALL`, and the UI shows the upgrade dialog. The counter is a single conditional `UPDATE`, so parallel requests can't go over the limit.
- **Protected master access:** typing the owner's email into the password sign-up never grants Master. When the real owner signs in with a provider that has confirmed the email, the account is linked, and any password set by someone else stops working.
- **Local and preview builds:** without `DATABASE_URL`, guests can still generate freely for development.
- **Sessions:** JWTs are stateless (HS256, 7-day expiry by default), and passwords are hashed with bcrypt (12 rounds).

**Username sign-in:** the sign-in form accepts an email *or* a username. Usernames are only set by an admin, typically for a shared master account that has no personal email. Sign-up never sets `isMaster`, and an admin creates a shared master account like this (run in the database):

```sql
-- password hash from: node -e "console.log(require('bcryptjs').hashSync('<password>', 12))"
insert into expertprompter."User" (id, email, username, "isMaster", "passwordHash", "updatedAt")
values ('master-shared', 'shared-master@users.expertprompter.invalid', 'teammaster', true, '<bcrypt hash>', now());
```

**Sign-in flow:** `/api/auth/oauth/<provider>` stores a random state value in an HttpOnly cookie and redirects to the provider. The callback checks the state, exchanges the code, and finds or links the user. It then redirects to `/#auth=<token>`. The URL fragment is never sent to servers, so the token stays out of logs.

**Billing flow:** `/api/billing/checkout` creates a Stripe Checkout subscription session. The $10/month price is defined in code unless `STRIPE_PRICE_ID` is set. `/api/billing/webhook` checks Stripe's signature and then re-reads the subscription from Stripe, so repeated or out-of-order events still end in the correct state. `/api/billing/portal` opens Stripe's page for changing the card or cancelling.

---

## 2. Architecture

```
┌──────────────────────── Browser ────────────────────────┐
│ pages/index.tsx                                          │
│  InputPanel → AdvancedOptionsPanel                       │
│  CategoryBadge · PromptCard · AIRecommendationPanel      │
│  HistoryPanel · AuthModal · ThemeToggle                  │
│  lib/api.ts (same-origin fetch + JWT from localStorage)  │
└──────────────┬───────────────────────────────────────────┘
               │ REST / JSON  (/api/*, same origin)
┌──────────────▼──── Next.js API routes (Vercel functions) ┐
│ lib/server/http.ts: method dispatch · zod validation ·   │
│   optional/required JWT · rate limit · error format      │
│ next.config.js: security headers on every response       │
│                                                          │
│ lib/server/services (pure, no I/O):                      │
│   InputAnalysisService     clean · filler strip · lang   │
│   CategoryDetectionService weighted keyword rules        │
│   PromptGenerationService  templates + style + limits    │
│   AIRecommendationService  category/template → tools     │
│   expertPrompterService    orchestrates the four         │
│ lib/server/services/authService (bcrypt / JWT / Prisma)  │
└──────────────┬───────────────────────────────────────────┘
               │ Prisma Client (pooled connection)
┌──────────────▼──────────────────────────────┐
│ PostgreSQL (Supabase), schema expertprompter │
│ User · Prompt · Template                     │
└──────────────────────────────────────────────┘
```

- **UI to API:** plain REST with JSON on the same origin. `lib/api.ts` adds the bearer token when one is stored and turns error bodies (`{ error: { message, details } }`) into an `ApiError`.
- **API to database:** only the API routes and `authService` import Prisma. The generation services are pure functions, which is why they can be unit-tested and run for guests without a database.
- **Guest-only mode:** if `DATABASE_URL` is not set, generation still works. Sign-in and history return `503 Accounts are not configured on this deployment`. Vercel preview deployments run this way.
- **Prompt generation** is template-driven: each category has specific task templates (for example resignation letter, business plan, YouTube script, logo, lesson plan) plus a fallback. See §6.
- **Category detection** is rule-based: weighted keyword and phrase scoring, a bonus for the leading verb, tie-breaking by priority, and a confidence threshold that falls back to General Writing. See §7.

---

## 3. Folder structure

```
expertprompter/
├── docker-compose.yml             # local Postgres
└── web/                           # the whole app (Vercel root directory)
    ├── package.json · tsconfig.json · next.config.js · vitest.config.mts
    ├── tailwind.config.ts · postcss.config.js · .env.example
    ├── prisma/
    │   ├── schema.prisma          # User, Prompt, Template + enums
    │   ├── migrations/            # generated SQL (init)
    │   └── seed.ts                # upserts Template rows from the catalog
    ├── scripts/migrate.mjs        # vercel-build step: migrate + seed (skipped without a DB)
    ├── pages/
    │   ├── _app.tsx · _document.tsx · index.tsx
    │   ├── privacy.tsx · terms.tsx
    │   └── api/                   # generate-prompt, health, meta, templates,
    │       ├── auth/              #   register, login, me, providers, oauth/[provider](/callback)
    │       ├── billing/           #   checkout, portal, webhook
    │       └── prompts/           #   list, save, [id] (get/delete), [id]/favorite
    ├── lib/
    │   ├── api.ts · auth.tsx · useTheme.ts · types.ts · fileText.ts   # browser side
    │   └── server/                                         # server side only
    │       ├── http.ts            # apiHandler, auth helpers, error mapping
    │       ├── env.ts · prisma.ts · schemas.ts · httpError.ts · rateLimit.ts
    │       ├── oauth.ts · cookies.ts · stripe.ts
    │       ├── types.ts           # Category, PromptStyle, result types
    │       └── services/          # inputAnalysis, categoryDetection, promptTemplates,
    │                              # promptGeneration, aiRecommendation, expertPrompter,
    │                              # auth, entitlement, billing, attachmentSections
    ├── components/                # Header, ThemeToggle, InputPanel, AdvancedOptionsPanel,
    │                              # CategoryBadge, PromptCard, AIRecommendationPanel,
    │                              # HistoryPanel, AuthModal, PaywallModal, FileUploadPanel,
    │                              # LegalPage, Icons
    ├── styles/globals.css
    ├── public/favicon.svg
    └── tests/                     # services, api, plans, db.integration (needs DATABASE_URL)
```

---

## 4. Data model

Defined in `web/prisma/schema.prisma`. In production the tables live in a dedicated `expertprompter` schema, which Supabase's public Data API does not serve:

- **User**: `id`, `email` (unique), `username?` (unique), `isMaster` (admin-only), `passwordHash?` (null for provider-only accounts), `name?`, `image?`, `emailVerified?`, `freeRunsUsed`, `stripeCustomerId?` (unique), `stripeSubscriptionId?`, `subscriptionStatus?`, `currentPeriodEnd?`, `createdAt`, `updatedAt`.
- **Account**: one linked sign-in provider per row: `provider` + `providerAccountId` (unique together), `userId`.
- **Prompt**: `id`, `userId?` (cascade delete), `rawInput`, `detectedCategory` (enum), `promptStyle` (enum), `options` (JSON: tone, length, format, audience, language), `generatedPrompt`, `recommendedTools` (`String[]`), `title`, `isFavorite`, `createdAt`.
  - Index `(userId, createdAt DESC)` serves the history query, and `(detectedCategory)` serves category filters.
- **Template**: `id`, `key` (unique, e.g. `business.business-plan`), `name`, `category`, `baseStructure` (JSON: mode, role, sections, defaultFormat, tone, qualityChecks), `createdBy` (`SYSTEM`/`USER`), `ownerId?`.
- **Enums:** `Category`, `PromptStyle`, `TemplateSource`.

Guest prompts are never stored. `userId` is nullable so that anonymous saves can be added later.

---

## 5. API reference

All routes are served by the app itself (`http://localhost:3000` locally). Errors are always returned as `{ "error": { "message": string, "details"?: object } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | none | Liveness check (also reports whether a database is configured) |
| POST | `/api/generate-prompt` | required* | Generate a prompt and use one free run (Free plan). Auto-saves (unless `save: false`). Returns `entitlement`. *Optional when no database is configured |
| POST | `/api/auth/register` | none | `{ email, password }` → `{ user, token }` |
| POST | `/api/auth/login` | none | `{ email, password }` → `{ user, token }` |
| GET | `/api/auth/me` | required | Current user and `entitlement` (plan, free runs left) |
| GET | `/api/auth/providers` | none | Enabled sign-in providers, and whether billing is set up |
| GET | `/api/auth/oauth/:provider` | none | Start Google / Facebook / GitHub sign-in |
| GET | `/api/auth/oauth/:provider/callback` | none | Provider redirect target |
| POST | `/api/analyze-image` | required* | `{ image: base64, mediaType }` → `{ description }` (Claude vision). *Open when no database is configured |
| POST | `/api/billing/checkout` | required | Stripe Checkout URL for Premium |
| POST | `/api/billing/portal` | required | Stripe Billing Portal URL (change card or cancel) |
| POST | `/api/billing/webhook` | Stripe signature | Subscription sync |
| GET | `/api/prompts?limit&cursor&category&q` | required | Paginated history (cursor-based), with filter and search |
| POST | `/api/prompts/save` | required | Save a prompt explicitly |
| GET | `/api/prompts/:id` | required | One saved prompt (owner only) |
| PATCH | `/api/prompts/:id/favorite` | required | Toggle favourite |
| DELETE | `/api/prompts/:id` | required | Delete (owner only) → 204 |
| GET | `/api/meta` | none | Categories, styles, tool catalog |
| GET | `/api/templates` | optional | Seeded templates (falls back to the in-code catalog if the DB is down) |

**`POST /api/generate-prompt` request**

```json
{
  "rawInput": "string (3–5000 chars, required)",
  "promptStyle": "PROFESSIONAL | CREATIVE | TECHNICAL | EDUCATIONAL (any case, optional)",
  "options": { "tone": "", "length": "short|medium|long|detailed|<free text>", "format": "", "audience": "", "language": "" },
  "variation": 0,
  "category": "optional override, e.g. MARKETING",
  "save": true
}
```

**Response:** `generatedPrompt`, `detectedCategory`, `categoryLabel`, `confidence`, `alternativeCategories`, `recommendedTools` (`string[]`), `toolDetails` (rich objects for the UI), `promptStyle`, `detectedLanguage`, `variation`, `title`, `savedPromptId?`.

Rate limits: generation is limited to 60 requests/min per IP and sign-in/registration to 10/min per IP. The limiter keeps its counts in memory, so on Vercel each function instance counts separately. For strict global limits, switch it to a shared store such as Upstash Redis.

---

## 5b. File attachments

- **Two kinds of file:** the input form has two drop zones.
  - **Upload file** (`role: "source"`, up to 3): the material the task is about.
  - **Reference files** (`role: "reference"`, up to 5): examples of the wanted style, tone or look.
- **Reading happens in the browser** (`lib/fileText.ts`):
  - text and code files are read directly;
  - PDFs through `pdfjs-dist` (first 60 pages);
  - `.docx` files through `mammoth`;
  - images are recognised but not read.
  Only the extracted text (at most 40,000 characters per file), the name and the size are sent. The files themselves never leave the device and are not stored.
- **Prompt output** (`lib/server/services/attachmentSections.ts`):
  - **Source text** goes into a `## Source Material` section, in a code fence longer than any backticks the file contains, trimmed to 12,000 characters per file and 30,000 in total, with a note when trimmed.
  - **Reference text** becomes a 2,000-character quoted excerpt under `## Reference Files`, with an instruction not to copy it.
  - **Images** are listed so you attach them in your AI tool. Image prompts add Midjourney `--sref` and ChatGPT instructions, and video prompts use a source image as the first frame.
  - The summary paragraph names the attached files.
- **API:** `POST /api/generate-prompt` accepts `attachments: [{ name, role, kind: "text"|"image"|"other", size?, text? }]`, at most 8 files, with a 1 MB request limit. Regenerate reuses the same files.

## 5c. Photo descriptions ("recreate this photo")

**No AI, always:** when an image is attached, the browser measures:
- the exact aspect ratio (e.g. `4:5`);
- the colour palette as plain names (`lib/imageStats.ts`);
- the lighting: bright or dark, warm or cool, and the contrast.

These go into the prompt straight away.

**On-device AI (default, free, private):**
- **The model:** `public/photo-ai-worker.js` runs **Florence-2 base** (`onnx-community/Florence-2-base-ft`, task `<MORE_DETAILED_CAPTION>`) in a Web Worker through transformers.js, loaded from jsDelivr. It uses WebGPU when the browser has it and WebAssembly otherwise.
- **The download:** 4-bit weights with 8-bit embeddings, about **215 MB**, downloaded once from Hugging Face and cached by the browser.
- **Consent:** the first time, each visitor taps **Describe with AI** to agree to the download. After that it runs automatically.
- **The photo never leaves the device.**
- **Speed and quality:** tested on a server CPU, it took about 3.5 seconds per photo. Captions are basic and occasionally wrong.
- **How it's used:** the cleaned caption, with repeated sentences removed, becomes the recreate prompt, followed by the measured light and palette.

**Server AI (optional, better quality):** set `GEMINI_API_KEY` (Google AI Studio free tier) or `ANTHROPIC_API_KEY` to describe photos on the server instead, using structured JSON with subject, details, setting, composition, camera, lighting, colours, style, mood, text and a recreate prompt. `VISION_PROVIDER=browser` forces on-device mode even when a key is set. The server path requires sign-in, and free accounts get it only while they have free prompts left. It is rate-limited, and the Privacy page says photos go to Google or Anthropic.

**How descriptions are used:**
- **Uploaded photo:** the first line of the image prompt becomes the recreate prompt, with any change the user typed in front, and the aspect ratio matches the photo.
- **Reference photos:** they drive the style, light and palette.
- **Text tasks:** they include the description as source material.
- **Every image prompt with a photo** gets steps for giving the photo itself to the tool, since that matters most for an exact match:
  - Midjourney: image URL + `--iw 2`, `--oref`/`--cref` for the same person, `--sref` for style;
  - ChatGPT / Gemini: attach and say "recreate";
  - Stable Diffusion: img2img at denoising strength 0.3–0.5 + ControlNet.

## 6. Prompt generation algorithm (`promptGenerationService.ts`)

1. **Analyse input** (`inputAnalysisService.ts`): normalise whitespace, quotes and zero-width characters. Strip conversational filler in layers ("Hi, can you please help me write…" becomes "write…"). Detect the language from script ranges and function-word counts. Extract places after locatives ("in Dubai" gives `Dubai`). Record whether the text starts with an imperative verb.
2. **Select a template** (`promptTemplates.ts`): try the category's specific templates by regex (for Writing: resignation letter → cover letter → email → ebook → blog → story), then use the category default. Each template has a *role*, a *default verb*, *default tone*, *sections* (short label plus detailed instruction), a *default format*, *quality checks*, and a *mode* (`text | image | video | music`).
3. **Build the task sentence:**
   - Imperative input keeps its wording, and the style adjective goes in after the article with the article corrected: `Write a resignation letter…` becomes `Write a professional resignation letter…`, and `Write a guide…` in Educational style becomes `Write an easy-to-follow guide…`.
   - A noun phrase gets the template's verb, and plural head nouns take no article: `business plan for a bakery` becomes `Create a professional business plan for a bakery.`
   - A question is wrapped: `Answer the following question thoroughly and accurately: "…"`.
4. **Merge tone:** user tone, then template tone, then style tone. Duplicates are removed and at most 4 are kept.
5. **Emit the summary paragraph**, which works as a prompt on its own:
   `<task>. The tone should be <tones>. Include <section labels>. Format it as <format>. [Write it for <audience>.] [<length rule>]`
6. **Emit the structured version** below `---`, with these sections: Role, Task (plus location and audience context), What to Include (numbered), Tone & Style (style guidance), Constraints (length, audience, language, no invented facts, placeholders), Output Format (extra rules triggered by format keywords such as table, JSON or letter), and Quality Checklist.
7. **Media modes** replace steps 5–6 with the shape that generators expect:
   - *image:* a single comma-separated prompt (subject, descriptors, style, mood, composition, lighting), aspect ratio taken from the format ("portrait" → 9:16), a Midjourney `--ar` suffix, a negative prompt, and settings. Logos skip lighting and composition.
   - *video:* shot description, camera move, lighting, duration, aspect ratio, and an avoid list.
   - *music:* a Suno/Udio style prompt (genre, mood, BPM), a lyrics brief with `[Verse]/[Chorus]` tags, and the output format.
8. **Variation:** a seeded PRNG (mulberry32 over `hash(task) + variation`) picks alternative role openers, approach lines, lighting, compositions, camera moves and tempos. Variation 0 is always the canonical output. **Regenerate** sends `variation + 1`, so the same request always gives the same output.

**Spec example.** Input: *"Write a resignation letter for a logistics coordinator."*, Professional style, `tone: "polite"`, `format: "formal letter"`. First line of the output:

> Write a professional resignation letter for a logistics coordinator. The tone should be polite, appreciative, concise, and polished. Include notice period, gratitude for opportunities, willingness to support transition, and a positive closing. Format it as a formal letter.

A test in `tests/services.test.ts` checks this output.

---

## 7. Category detection (`categoryDetectionService.ts`)

- **Rules per category** use three weights: phrases score 3 (`"business plan"`, `"lesson plan"`, `"social media"`), strong words score 2 (`bug`, `logo`, `campaign`, `lyrics`), and weak words score 1 (`design`, `plan`, `story`). A trailing `*` makes a rule a prefix (`market*`, `debug*`). Matching uses Unicode-aware boundaries, so `ad` does not match "read", and `c++` and `ci/cd` work.
- **Leading-verb bonus:** `debug` gives Coding +3, `draw` gives Image +3, `teach` gives Education +2, `write` gives Writing +1.5, and so on.
- **Ambiguity:** scores within 0.5 of each other count as a tie. Ties go to the more specific category in this order: Video > Image > Music > Coding > Data > Marketing > Business > Education > Research > Writing. A wrong specialised tool costs the user more than a generic one. Runner-up categories scoring at least half the winner's score come back as `alternativeCategories`, and the UI shows them as "Not right? Try …" chips that regenerate with a `category` override.
- **Fallback:** if the best score is below 2 (for example "birthday party ideas"), the category is `GENERAL_WRITING`, which works with any general assistant.
- **Confidence** = 0.5 × (winner's share of all points) + 0.5 × min(1, winner score / 6).
- The public function is `detectCategory(rawInput: string): Category`. `scoreCategories()` also returns scores, matched keywords and alternatives.

---

## 8. AI tool recommendations (`aiRecommendationService.ts`)

- `TOOL_CATALOG` defines each tool once: name, vendor, description and URL.
- `CATEGORY_TOOLS` gives a ranked list of `[toolId, reason]` for each category. For example, Coding → GitHub Copilot, Claude Code, ChatGPT, Claude, Cursor. Image → Midjourney, DALL·E, Stable Diffusion, Ideogram, Canva. Video → Runway, Pika, Sora, HeyGen, ElevenLabs. Music → Suno, Udio.
- `TEMPLATE_TOOLS` overrides the category list where the job differs. A YouTube **script** is a writing task, so it gets Claude, ChatGPT, ElevenLabs, HeyGen and Canva. A KDP **ebook** gets Claude, ChatGPT, Grammarly and Canva for the cover.
- **Handling multiple suitable tools:** the base score falls with rank, and contextual boosts can reorder the list. Text in images promotes Ideogram, "latest/statistics/sources" adds Perplexity, "excel/powerpoint" promotes Copilot, "deck/pitch" adds Gamma, and the Technical style promotes Claude and Claude Code. Equal scores keep the base order. The list is capped at 5 tools.
- **Output:** `recommendTools(category): string[]` returns names (the spec contract, also returned as `recommendedTools`). `recommendToolDetails()` returns `{ id, name, vendor, description, url, reason, rank }[]` for the UI cards.

---

## 9. End-to-end example

**User input:** *"Create a business plan for a cloud kitchen in Dubai."* with style Professional and options `{ tone: "confident", audience: "potential investors", length: "detailed" }`.

1. Analysis: the text is imperative (`create`), the language is English, and the location is `Dubai`.
2. Detection: Business scores 9 ("business plan" 3 + "cloud kitchen" 3 + "business" 2 + "plan" 1), so the category is **Business** with confidence 1.0.
3. Template: `business.business-plan`.
4. Tools: ChatGPT, Claude, Microsoft Copilot, Perplexity, Gamma.

**Response from `POST /api/generate-prompt`** (real output; `generatedPrompt` shortened here):

```json
{
  "generatedPrompt": "Create a professional business plan for a cloud kitchen in Dubai. The tone should be confident, data-driven, persuasive, and polished. Include an executive summary, market analysis, competitive landscape, business and revenue model, operations plan, marketing and sales strategy, financial projections, risks and mitigation, and a 12-month roadmap. Format it as a structured report with headings, bullet points and tables. Write it for potential investors. Be comprehensive: 1,500+ words, covering every section in depth.\n\n---\n\n## Role\nYou are a seasoned startup consultant and former venture-capital analyst who has written investor-ready business plans.\n\n## Task\nCreate a professional business plan for a cloud kitchen in Dubai.\n\n- Tailor everything to Dubai: local market conditions, regulations, costs (in local currency), culture and customer behaviour.\n- The intended audience is potential investors; match their knowledge level and priorities.\n\n## What to Include\n1. Executive summary: …\n…\n9. Milestones: a 12-month roadmap with measurable KPIs.\n\n## Tone & Style\n…\n## Constraints\n…\n## Output Format\n…\n## Quality Checklist\n…",
  "detectedCategory": "BUSINESS",
  "categoryLabel": "Business",
  "confidence": 1,
  "alternativeCategories": [],
  "recommendedTools": ["ChatGPT", "Claude", "Microsoft Copilot", "Perplexity", "Gamma"],
  "toolDetails": [
    { "id": "chatgpt", "name": "ChatGPT", "vendor": "OpenAI", "description": "Versatile general assistant for drafting, brainstorming and iteration.", "url": "https://chat.openai.com", "reason": "Fast structured drafts, tables and frameworks.", "rank": 1 }
  ],
  "promptStyle": "PROFESSIONAL",
  "detectedLanguage": "English",
  "variation": 0,
  "title": "Create a business plan for a cloud kitchen in Dubai."
}
```

(`savedPromptId` is also included when the request carries a valid JWT.)

**Frontend state after the response** (`pages/index.tsx`):

```ts
input      = { rawInput: 'Create a business plan…', promptStyle: 'PROFESSIONAL', options: { tone: 'confident', audience: 'potential investors', length: 'detailed' } }
lastRequest = { rawInput: 'Create a business plan…', promptStyle: 'PROFESSIONAL', options: {…}, variation: 0 }
result     = <response above>
loading = false · regenerating = false · error = null · savedId = result.savedPromptId ?? null
```

The page then shows:

- a **CategoryBadge** reading `📈 Business · 100%`, labelled "Professional · English";
- a **PromptCard** with the summary paragraph highlighted and the structured prompt below, plus Regenerate, .txt, Save (when signed in) and Copy buttons;
- an **AIRecommendationPanel** with five ranked cards: ChatGPT (1), Claude, Microsoft Copilot, Perplexity and Gamma. Each card shows its reason and links to the tool;
- for signed-in users, a **HistoryPanel** that reloads with the new entry at the top.

Clicking **Regenerate** sends the same request with `variation: 1`. The role opener and approach line change, the badge adds "· variation 1", and the text is still reproducible.

---

## 10. Running locally

```bash
cd expertprompter
docker compose up -d                      # Postgres on :5432 (optional: skip for guest-only mode)

cd web
cp .env.example .env                      # set JWT_SECRET; DATABASE_URL/DIRECT_URL point at docker Postgres
npm install                               # also runs prisma generate
npx prisma migrate dev                    # creates tables
npm run db:seed                           # loads the template catalog
npm run dev                               # UI + API on http://localhost:3000
```

Quality checks:

```bash
cd web && npm run typecheck && npm test && npm run build   # 100 tests without a DB (the Claude and Gemini SDKs are mocked)
# With a migrated local DB, 10 more integration tests run (free-run limit, master, username sign-in, OAuth linking, Stripe webhook):
DATABASE_URL=... DIRECT_URL=... npm test
```

## 11. Deployment (Vercel + Supabase)

- **Vercel project:** set the root directory to `expertprompter/web` with the Next.js framework preset. Vercel runs the `vercel-build` script: `prisma generate`, then `scripts/migrate.mjs` (`prisma migrate deploy` + seed, only when `DATABASE_URL` is set), then `next build`.
- **Environment variables** (Production):
  - `DATABASE_URL`: the Supabase *transaction* pooler (port 6543) with `?pgbouncer=true&connection_limit=1&schema=expertprompter`
  - `DIRECT_URL`: the Supabase *session* pooler (port 5432) with `?schema=expertprompter`, used by migrations
  - `JWT_SECRET`: a long random string
  - `APP_URL`: `https://expertprompter.vercel.app`
  - `MASTER_EMAILS`: the owner's email(s)
  - Optional: `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` for server-side photo descriptions (otherwise they run on the visitor's device); `VISION_PROVIDER=browser` forces on-device
  - Sign-in and billing credentials: see below
- **Database role:** the app connects as a dedicated `expertprompter_app` role that owns the `expertprompter` schema. It is not the Supabase `postgres` admin, and its tables are outside the `public` schema that the Supabase Data API serves.
### Setting up sign-in providers

Each provider shows up in the sign-in dialog once both of its variables are set on Vercel. Redeploy after adding them.

- **Google:** Google Cloud Console → APIs & Services.
  1. On the OAuth consent screen, add the app name, a support email and the privacy URL `/privacy`.
  2. Under Credentials, create an *OAuth client ID* of type *Web application*.
  3. Set the authorized redirect URI to `https://expertprompter.vercel.app/api/auth/oauth/google/callback`.
  4. Copy the values into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Publish the consent screen so anyone can sign in.
- **Facebook:** developers.facebook.com → create an app with the *Facebook Login* use case.
  1. Set the valid OAuth redirect URI to `https://expertprompter.vercel.app/api/auth/oauth/facebook/callback`.
  2. Add the privacy policy URL, and put the `/privacy` page in the data-deletion field.
  3. Make sure the `email` permission is available, then switch the app to Live.
  4. Copy the App ID and App Secret into `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`.
- **GitHub:** Settings → Developer settings → OAuth Apps → New.
  1. Set the callback URL to `https://expertprompter.vercel.app/api/auth/oauth/github/callback`.
  2. Copy the values into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

### Setting up Stripe (Premium, $10/month)

1. In the Stripe Dashboard, copy the secret key into `STRIPE_SECRET_KEY`. Use a test key (`sk_test_…`) first.
2. Go to Developers → Webhooks and add the endpoint `https://expertprompter.vercel.app/api/billing/webhook`. Subscribe it to `checkout.session.completed` and `customer.subscription.created`, `.updated`, `.deleted`, `.paused` and `.resumed`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Go to Settings → Billing → Customer portal and turn it on, allowing cancellations and card updates.
4. Optional: create a $10/month Price and set `STRIPE_PRICE_ID`. Without it, checkout creates the price automatically.

Until `STRIPE_SECRET_KEY` is set, the upgrade dialog shows "Premium is coming soon".

- **Supabase free tier** pauses a project after about a week without activity. Resume it from the Supabase dashboard if sign-in starts returning 503.

## 12. Extending

- **New category:** add it to the `Category` enum (Prisma and `lib/server/types.ts`), add rules to `CATEGORY_RULES`, add a default template and a `CATEGORY_TOOLS` entry, then run `prisma migrate dev`.
- **New task template:** add one object to `TEMPLATES` with a `match` regex, then re-run `npm run db:seed`.
- **Optional LLM refinement:** the pure prompt makes a good seed for an LLM "polish" pass. Add it as a separate service behind a feature flag so the deterministic path remains the default.
