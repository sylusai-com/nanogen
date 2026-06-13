# Nanozen — Project Reference

A complete, end-to-end reference for the Nanozen banner-generation platform.
Covers the tech stack, every directory and file of substance, the data model,
the runtime flows for each feature, the provider/scoring/threshold pipeline,
and the operational notes you need to run, extend, or audit the system.

If `README.md` is the elevator pitch, this is the floor plan.

---

## 1. What Nanozen does

Nanozen turns a short text brief into a production-grade marketing banner.
The product surface is split into two complementary flows:

1. **Banner studio (`/dashboard/create` → `/api/banners`)**
   The default user flow. The brief goes to an admin-configured *text* model
   that returns a complete, editable HTML/CSS banner template. Three variants
   are generated, scored, and the top scorer (≥ 80, else absolute top) is
   persisted and the user is dropped into the editor.

2. **Multi-image-model studio (`/generate` → `/api/generate`)**
   The fan-out flow. The brief is fanned out across every enabled *image*
   model in the registry, each candidate is scored by a vision model, and
   the same threshold-with-top-fallback rule picks the winner.

Both flows share one infrastructure: a DB-backed model registry, a uniform
OpenAI-compatible request shape, the same scoring rubric, and the same
threshold (`SCORE_THRESHOLD = 80`).

---

## 2. Tech stack

| Layer            | Tech                                                              |
| ---------------- | ----------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, JSX, Node.js runtime for API routes)      |
| UI               | React 19 + Tailwind CSS v4                                        |
| Animation        | `motion` (Framer Motion v12)                                      |
| Charts           | `recharts` (admin model-share chart)                              |
| Icons            | `lucide-react`                                                    |
| Auth + DB        | Supabase (Postgres + Auth + RLS), `@supabase/ssr`                 |
| AI providers     | Any OpenAI-compatible chat completions endpoint (admin-managed)   |
| Default provider | OpenRouter (one of many — admins can add more)                    |
| Lint             | ESLint (`eslint-config-next`)                                     |

Every AI provider (OpenAI, Anthropic via OpenAI-compatible proxies, Google,
Groq, Together, Mistral, DeepSeek, Perplexity, custom internal LLMs, etc.)
goes through one HTTP shape: `POST {endpoint}` with `Authorization: Bearer
{apiKey}` and `{model, messages}`. Admins register them as rows in the
`models` table — see §6.

---

## 3. Repository layout

```
nanozen/
├── README.md                       # short overview + quickstart
├── PROJECT.md                      # this file
├── package.json
├── next.config.mjs
├── postcss.config.mjs
├── eslint.config.mjs
├── jsconfig.json                   # @/ → src/
├── .env.example                    # required env vars
├── public/                         # logo, favicons, marketing svgs
├── supabase/
│   ├── README.md                   # how to apply migrations
│   └── migrations/
│       ├── 0001_initial_schema.sql # profiles, runs, results, banners, RLS
│       ├── 0002_banners_profiles_fk.sql
│       ├── 0003_models.sql         # admin-managed model registry
│       ├── 0004_canvas_and_catalog.sql
│       ├── 0005_banner_editor_columns.sql
│       └── 0006_builder_and_admin_catalog.sql
└── src/
    ├── proxy.js                    # (placeholder)
    ├── app/                        # Next.js App Router
    ├── components/                 # React components by domain
    └── lib/                        # core libraries (DB, AI, helpers)
```

### 3.1 `src/app` — routes

```
app/
├── layout.js                       # root layout, theme bootstrap, providers
├── globals.css                     # Tailwind layer + CSS variables
├── (marketing)/
│   ├── layout.js
│   ├── page.js                     # landing page
│   └── generate/page.js            # public, anonymous multi-image fan-out
├── (auth)/
│   ├── layout.js
│   ├── login/page.js
│   └── signup/page.js
├── auth/callback/route.js          # OAuth callback (Supabase)
├── dashboard/
│   ├── layout.js                   # auth-gated, sidebar
│   ├── page.js                     # user dashboard home
│   ├── create/page.js              # banner studio (HTML banner generation)
│   ├── settings/page.js
│   ├── banners/page.js             # banner library
│   ├── banners/[id]/page.js        # banner detail
│   ├── banners/[id]/edit/page.js   # field-driven editor
│   └── builder/[id]/page.js        # drag-and-drop visual builder
├── admin/
│   ├── layout.js                   # admin-only, role check
│   ├── page.js                     # admin overview / activity
│   ├── models/page.js              # CRUD for models (key + URL + enable)
│   ├── styles/page.js              # CRUD for banner styles
│   ├── aspects/page.js             # CRUD for aspect ratios
│   ├── outputs/page.js             # browse all generation outputs
│   └── users/page.js               # user list
└── api/
    ├── auth/signup/route.js        # custom signup hook
    ├── banners/route.js            # generate + score 3 variants, save winner
    ├── banners/html/route.js       # return template only (used by editor)
    ├── generate/route.js           # multi-image-model fan-out + scoring
    └── score/route.js              # standalone scoring endpoint
```

### 3.2 `src/components` — UI

```
components/
├── layout/                         # AuthProvider, Navbar, Footer, theme
├── ui/                             # Card, Button, Modal, Input, Select, …
├── landing/                        # marketing components
├── auth/                           # AuthCard, SocialAuth
├── dashboard/                      # Sidebar, TopBar, StatCard, BannerThumb
├── admin/                          # ModelFormModal, AspectFormModal, …
├── generate/                       # PromptForm, ResultsPanel, BannerCard
├── editor/                         # field-driven banner editor
└── builder/                        # drag-and-drop builder (PropertiesPanel)
```

### 3.3 `src/lib` — core

```
lib/
├── cn.js                           # classnames helper
├── models.js                       # SCORE_THRESHOLD, PROVIDERS, PROVIDER_ENDPOINTS
├── openrouter.js                   # generic OpenAI-compatible HTTP client
├── bannerTemplate.js               # template generation + richness heuristic
├── scoreBanner.js                  # text + vision scoring (model + heuristic)
├── banner-template/                # (helpers used by editor / builder)
├── supabase/
│   ├── client.js                   # browser client
│   ├── server.js                   # server-component client (cookies)
│   └── admin.js                    # service-role client (bypasses RLS)
└── db/
    ├── banners.js
    ├── models.js                   # listAllModels, getDefaultTextModel, …
    ├── styles.js                   # banner styles (CRUD)
    ├── aspects.js                  # aspect ratios (CRUD)
    └── admin.js                    # admin-side queries
```

---

## 4. Data model (Supabase / Postgres)

Migrations live under `supabase/migrations/` and are append-only.

| Table                  | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `profiles`             | Mirrors `auth.users`. `role` = `'user' | 'admin'`, `plan` = `'free' | 'pro'`.            |
| `admin_emails`         | Pre-allowlist of emails auto-promoted to admin on signup.                                |
| `generation_runs`      | One row per `/api/generate` call. Stores prompt, aspect, style, model slugs.             |
| `generation_results`   | Per-model output within a run (image_url, score, latency, is_winner).                    |
| `banners`              | A saved banner — winner of a run, OR a directly generated HTML template.                 |
| `models`               | The model registry: slug, provider, model_id, enabled, is_default, config jsonb.         |
| `banner_styles`        | Admin-managed styles (Modern, Editorial, Bold, …) — colors + gradient.                   |
| `aspect_ratios`        | Admin-managed aspect ratios (16:9, 1:1, 4:5, 9:16).                                       |

### 4.1 Key columns on `models`

- `slug` (text unique) — internal id used by the API and admin tables.
- `label` (text) — display name.
- `kind` (`'image' | 'text'`) — text models drive HTML banner generation;
  image models drive `/api/generate`.
- `provider` (text) — free-form; uniform OpenAI-compatible flow regardless.
- `model_id` (text) — the provider's own model identifier.
- `enabled` (bool) — flips a model on/off without deleting the row.
- `is_default` (bool) — at most one default per `kind` (DB trigger enforces).
- `sort_order` (int) — display ordering.
- `preview_gradient` (text) — used as the thumbnail for image models.
- `config` (jsonb) — `{apiKey, endpoint, temperature, maxTokens, …}`.

### 4.2 RLS, in one paragraph

Everything is RLS-locked. Users can only read their own rows on
`profiles`, `generation_runs`, `generation_results`, `banners`. Admins
read and write everything (`is_admin()` helper + `admin_emails` allowlist).
Models / styles / aspects are readable by anyone for *enabled* rows;
writable only by admins. The `handle_new_user` trigger creates the profile
on signup and auto-promotes admin emails.

---

## 5. Authentication & authorization flow

1. Signup hits `/api/auth/signup` (or the Supabase OAuth flow → `/auth/callback`).
2. Supabase creates an `auth.users` row.
3. The `on_auth_user_created` trigger calls `handle_new_user()` which inserts
   a matching `profiles` row, setting `role = 'admin'` if the email is in
   `admin_emails`, else `'user'`.
4. The browser holds a Supabase session cookie. `src/lib/supabase/server.js`
   constructs a per-request client from those cookies for server components
   and API routes.
5. Page guards:
   - `/dashboard/*` — `RouteGuard` (in `components/dashboard/RouteGuard.jsx`)
     redirects unauthenticated users to `/login`.
   - `/admin/*` — `app/admin/layout.js` checks `profile.role === 'admin'`.
   - API routes do their own `supabase.auth.getUser()` check when an action
     requires authentication.

---

## 6. The model registry (the heart of the system)

Every AI call in the app is routed through one row in `public.models`. This
makes the platform **fully provider-agnostic**: admins can add, swap,
enable, or disable any OpenAI-compatible service from `/admin/models`
without a code change or redeploy.

### 6.1 What admins configure

The `ModelFormModal` ([src/components/admin/ModelFormModal.jsx](src/components/admin/ModelFormModal.jsx)) collects:

| Field              | Stored as                       | Notes                                              |
| ------------------ | ------------------------------- | -------------------------------------------------- |
| Kind               | `kind`                          | `image` or `text`                                  |
| Provider           | `provider`                      | Predefined list + `custom` (free-form name)        |
| Slug               | `slug`                          | Lowercased, dash-separated                         |
| Display name       | `label`                         | UI label                                           |
| Provider model ID  | `model_id`                      | What the provider expects in the body              |
| Endpoint URL       | `config.endpoint`               | Optional — falls back to OpenRouter URL            |
| API key            | `config.apiKey`                 | Stored on the row; preserved on edit if blank      |
| Sort order         | `sort_order`                    | Display order                                      |
| Enabled            | `enabled`                       | On/off toggle without deleting                     |
| Default (text)     | `is_default`                    | At most one per kind (DB trigger)                  |
| Preview gradient   | `preview_gradient`              | Image models only                                  |
| Extra config       | merged into `config` jsonb      | Free-form JSON: `{temperature, maxTokens, …}`      |

The list of providers shown in the dropdown comes from `PROVIDERS` in
[src/lib/models.js](src/lib/models.js); the placeholder URL for each comes
from `PROVIDER_ENDPOINTS` in the same file. Picking `custom` reveals a
text input where admins can name their own provider.

### 6.2 Validation rules

- API key required for any model that's actually called (the bannerTemplate /
  scoreBanner libs return a heuristic score / fallback template if it's missing).
- For non-OpenRouter providers, the endpoint URL is mandatory — the form
  blocks save until it's set, and the runtime returns a fallback with a
  diagnostic `reason` if it's somehow missing.
- The DB trigger `enforce_single_default_model()` ensures only one `text`
  model and one `image` model can be marked default at a time.

### 6.3 Runtime resolution

[src/lib/bannerTemplate.js](src/lib/bannerTemplate.js) exports two helpers:

```js
pickApiKey(model)    // → config.apiKey || config.api_key || …
pickEndpoint(model)  // → config.endpoint || config.baseUrl || config.url || null
```

[src/lib/openrouter.js](src/lib/openrouter.js) (despite the name) is the
**generic OpenAI-compatible client**. Every text-model call in the app goes
through it. It defaults the URL to OpenRouter's chat completions endpoint
when none is supplied; otherwise it uses the admin-provided `endpoint`.

---

## 7. The banner-generation pipeline (HTML banners)

The primary flow. Lives behind `/api/banners`.

### 7.1 End-to-end sequence

```
User /dashboard/create
   └── PromptForm  (prompt + aspect + style)
        └── POST /api/banners
              ├── load default text model (admin-configured)
              ├── generate 3 banner-template variants in parallel
              │     each variant = call to model.config.apiKey + endpoint
              │     with system prompt + user message (different archetype seed)
              ├── score each variant in parallel
              │     scoreBannerTemplate → calls model with rubric or
              │     falls back to richness heuristic
              ├── pick winner: top score >= 80, else absolute top
              ├── persist winner into banners table
              └── return { banner, score, threshold, passedThreshold, variants }
   └── redirect /dashboard/banners/{id}/edit
```

When `passedThreshold === false`, the dashboard shows an amber banner that
says "Showing top variant (X/100). None reached 80 — regenerate or refine
the prompt." before redirecting into the editor — see
[src/app/dashboard/create/page.js](src/app/dashboard/create/page.js).

### 7.2 What the model produces

The system prompt (in [src/lib/bannerTemplate.js](src/lib/bannerTemplate.js))
forces the model to return one JSON object containing:

- `html` — full banner markup, rooted at `<div class="banner" data-align="…">`
- `css` — full stylesheet, including animations, gradients, masks, etc.
- `alignment` — `left | center | right`
- `fields[]` — an array of editable fields, each typed as one of:
  - `text` — bound to `[data-slot="<id>"]` in the HTML
  - `color` — drives a CSS custom property
  - `range` — numeric CSS variable (with min/max/step/unit)
  - `select` — enumerated CSS variable (with options)
  - `toggle` — show/hide an element via a CSS selector
  - `image` — a CSS variable holding `url(...)`

The output is what feeds the field-driven editor — the editor renders the
HTML/CSS in an iframe and exposes each `field` as a labelled control.

### 7.3 The "modern banner" rules (v4 system prompt)

The system prompt in `bannerTemplate.js` enforces *Mandatory Richness*:

- 10+ distinct visual elements per banner.
- 6+ CSS techniques (gradients, `color-mix`, `backdrop-filter`, `mask`,
  blend modes, `clip-path`, animations, `background-clip: text`, conic
  gradients, transforms, inline SVG, multi-layer shadows).
- At least one subtle keyframe animation (8s+ loop).
- 2+ stacked decorative layers (gradient + texture + hero accent).
- 5+ components from a 30-item *Component Catalog* (eyebrow pills,
  pulsing dots, version chips, stat cards with sparklines, dual CTAs,
  trust lines with avatar stacks, marquee tickers, glassmorphic cards,
  SVG noise/grid/dot patterns, conic-gradient halos, corner registration
  marks, etc.).
- One of 8 layout archetypes per generation (full-bleed image, split
  50/50, editorial cover, grid composition, gradient mesh, geometric/Swiss,
  ticker/typographic, stats/data) — the prompt's user message rotates the
  *suggested* archetype across variants so the three calls produce visibly
  different layouts.
- Real Unsplash photo URLs (with curated photo IDs by topic) when the
  archetype calls for a photo, plus the full set of `bg_brightness`,
  `bg_blur`, `bg_overlay`, `bg_zoom`, `bg_position` companion controls so
  the user can tune the photo in the editor.

### 7.4 Validation and backfill

The model's output goes through:

1. `extractJson()` — strips ```json fences, finds the outermost `{…}` so
   stray prose can't break parsing.
2. `validateTemplate()` — type-checks, requires `headline + bg + fg +
   accent` fields, normalizes alignment.
3. `ensureImageControls()` — if the model emitted a `bg_image` field but
   forgot the companion `bg_brightness/blur/overlay/zoom/position` controls,
   they're injected with sensible defaults.

### 7.5 Fallback template

When *anything* fails (no model configured, no API key, model HTTP error,
invalid JSON output), `generateBannerTemplate` returns a richer fallback
template (defined inline in `bannerTemplate.js`) — animated mesh + grid +
noise + 3 floating orbs + corner registration marks + eyebrow pill with
pulse + version tag + headline + subhead + 3-feature row + dual CTAs +
trust line with avatar stack. The fallback is *also* run through the
`applyStyleRow()` step so the user-selected style still tints it.

A `reason` string is attached so the dashboard surfaces *why* it fell back
("Model X has no API key", "endpoint missing", "model returned invalid
JSON") — admins fix configuration without having to read logs.

---

## 8. The image-generation pipeline (multi-model fan-out)

Lives behind `/api/generate`. Used by the public `/generate` page and by
the dashboard's parallel-models studio.

### 8.1 Sequence

```
User /generate (or /dashboard/...)
   └── PromptForm  (prompt + aspect + style + selected models)
        └── POST /api/generate
              ├── load enabled image models for the selected slugs
              ├── runModel(model, payload) for each, in parallel
              │     (currently a stub returning {imageUrl: null}; the
              │      provider call goes here when wired)
              ├── scoreImage(supabase, result, prompt) for each, in parallel
              │     → scoreBannerImage (vision-capable model OR neutral 75)
              ├── pick winner: top score >= 80, else absolute top
              ├── if signed in, persist run + per-result rows + winner banner
              └── return { results, winnerId, threshold, passedThreshold }
   └── ResultsPanel renders the cards
```

### 8.2 Threshold-with-top-fallback (UI)

[src/components/generate/ResultsPanel.jsx](src/components/generate/ResultsPanel.jsx)
implements the same rule as the API:

- If 1+ result scored ≥ 80, only the passing results render.
- If 0 results scored ≥ 80, the absolute top scorer is surfaced with an
  amber notice ("No variant reached the threshold — showing the top
  scorer (X/100). Regenerate or refine the prompt.").
- Filtered (failing) results stay accessible behind a `<details>`
  collapse so users can still see what didn't make the cut.

### 8.3 Wiring real image providers

`runModel` in [src/app/api/generate/route.js](src/app/api/generate/route.js)
is the single insertion point. Each provider gets a tiny adapter switching
on `model.provider`. The adapter must return:

```js
{
  modelSlug, modelLabel, provider, providerModelId,
  previewGradient, imageUrl, latencyMs, prompt, aspect, style
}
```

Once `imageUrl` is populated, `scoreBannerImage` automatically routes the
image through the configured vision model (default text model if it
supports `image_url` content blocks).

---

## 9. The scoring system

Two paths share the same rubric in [src/lib/scoreBanner.js](src/lib/scoreBanner.js):

### 9.1 Text-model scoring (HTML banners)

`scoreBannerTemplate({supabase, prompt, style, aspect, html, css})` calls
the default text model with a structured rubric:

- **Relevance** (0–20) — does it match the brief subject and tone?
- **Composition** (0–20) — layout balance, visual hierarchy?
- **Richness** (0–20) — element density, decorative layers, components?
- **Polish** (0–20) — typography, spacing, color harmony, modern CSS?
- **Distinctiveness** (0–20) — does it stand out, or is it generic?

Returns `{score, breakdown, reason, source, modelId, provider}`. Generic
banners get 60–70; flagship-quality banners get 90+.

### 9.2 Vision-model scoring (image banners)

`scoreBannerImage({supabase, prompt, imageUrl})` sends the same rubric to
the default text model with the image attached as an `image_url` content
block (OpenAI-compatible vision message format). When the configured model
doesn't support vision, OR no model is configured, OR the call fails,
returns a neutral score of 75 so the pipeline still produces a winner.

### 9.3 Heuristic fallback

When the model can't be called at all, both paths fall back to
`templateRichness()` — a deterministic local check on:

- Element count (10+ → +10, 14+ → +6, 22+ → +6)
- CSS technique coverage (gradients, color-mix, backdrop-filter, mask,
  clip-path, blend modes, animations, transforms, SVG, etc.) — up to +20
- Field count (8+ → +3, 14+ → +4)
- Decorative-layer hits (orb, mesh, grid, noise, SVG patterns) — up to +8
- Image presence — +4
- Prompt-keyword echo bonus — up to +8

Returns 40–95. The endpoint **always** returns a number, so callers never
have to special-case a missing scorer.

### 9.4 The `/api/score` endpoint

[src/app/api/score/route.js](src/app/api/score/route.js) accepts one of
two request shapes:

```js
// vision path
{ "imageUrl": "https://…", "prompt": "…" }

// design-critique path
{ "html": "<div…>", "css": "…", "prompt": "…", "style": "…", "aspect": "16:9" }
```

Returns:

```js
{
  score: 0–100,
  source: "Claude Sonnet 3.5" | "heuristic",
  breakdown: { relevance, composition, richness, polish, distinctiveness } | null,
  reason: string | null,
  threshold: 80,
  passes: boolean
}
```

This endpoint is reusable from anywhere — admin tools, future automation,
external integrations.

---

## 10. The editor and builder

After a banner is generated and persisted, two surfaces let users iterate:

- **Editor** (`/dashboard/banners/[id]/edit`) — field-driven. Renders the
  generated HTML/CSS in an iframe; the `fields[]` array becomes a typed
  control panel on the right (text inputs, color pickers, sliders, selects,
  toggles, image URL inputs). Edits write back to the same banner row.
  `/api/banners/html` is a side endpoint that returns *just* the template
  (no persistence) — used by the editor when the user clicks "regenerate".

- **Builder** (`/dashboard/builder/[id]`) — drag-and-drop. Operates on the
  banner's `canvas` jsonb column (`{background, elements[]}`) for free-form
  visual composition with a properties panel.

Both surfaces save to the same `banners` row.

---

## 11. Admin surfaces

Lives under `/admin/*`, gated by `is_admin()`.

| Route             | What it does                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| `/admin`          | Activity overview, model-share chart, recent generations.                 |
| `/admin/models`   | CRUD for the model registry. Cards show key-set indicator, traffic share, runs, avg score, P50 latency. |
| `/admin/styles`   | CRUD for banner styles (Modern, Editorial, Bold, …).                      |
| `/admin/aspects`  | CRUD for aspect ratios.                                                   |
| `/admin/outputs`  | Browse every generation result across all users.                          |
| `/admin/users`    | List all profiles, their plan, role, signup date.                         |

The model-share chart lives in [src/components/admin/ModelShareChart.jsx](src/components/admin/ModelShareChart.jsx)
and uses live aggregates from `generation_results`.

---

## 12. Environment variables

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# Optional — comma-separated emails auto-promoted to admin on signup
ADMIN_EMAILS=

# Public URL (OpenRouter attribution + Supabase auth callbacks)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**No AI provider keys live in env vars.** Every key is on the
corresponding row in `public.models.config.apiKey`, set by an admin in
`/admin/models`. This is what makes the platform multi-tenant-ready and
lets you swap providers without redeploying.

---

## 13. Local development

```bash
git clone <this-repo>
cd nanozen
npm install
cp .env.example .env.local         # fill Supabase URL + keys
# apply Supabase migrations: supabase/README.md, options A or B
npm run dev                        # http://localhost:3000
```

First-run checklist:

1. Apply all six migrations under `supabase/migrations/`.
2. Insert your email into `admin_emails` *before* signing up (so the
   trigger promotes you on signup):

   ```sql
   insert into public.admin_emails (email) values ('you@example.com');
   ```

3. Sign up at `/signup` with that email.
4. Open `/admin/models`, edit the seeded `Claude Sonnet 3.5` row (default
   text model), paste an OpenRouter API key, save. The banner studio is
   now live.
5. (Optional) Add more models. Any OpenAI-compatible endpoint works —
   pick `custom` provider if it's not in the dropdown.

---

## 14. Extension points (where to add things)

| Goal                                          | Touch points                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Wire a real image provider                    | `runModel` in [src/app/api/generate/route.js](src/app/api/generate/route.js) |
| Add a new banner archetype                    | `SYSTEM_PROMPT` in [src/lib/bannerTemplate.js](src/lib/bannerTemplate.js) |
| Tweak the scoring rubric                      | `SYSTEM_PROMPT` in [src/lib/scoreBanner.js](src/lib/scoreBanner.js)  |
| Change the score threshold                    | `SCORE_THRESHOLD` in [src/lib/models.js](src/lib/models.js)          |
| Add a new field type to the editor            | Update `validateTemplate()` (banner template lib) + the editor       |
| Add a new admin-managed catalog (e.g. fonts)  | New table + `lib/db/<thing>.js` + `app/admin/<thing>/page.js`        |
| Support a non-OpenAI-compatible provider      | Branch in [src/lib/openrouter.js](src/lib/openrouter.js) on `provider` and write a small adapter |

---

## 15. Frequently-touched files (cheat-sheet)

- [src/lib/models.js](src/lib/models.js) — `SCORE_THRESHOLD`, `PROVIDERS`, `PROVIDER_ENDPOINTS`.
- [src/lib/openrouter.js](src/lib/openrouter.js) — `callOpenRouter`, `extractJson`.
- [src/lib/bannerTemplate.js](src/lib/bannerTemplate.js) — system prompt, fallback template, richness heuristic, `generateBannerTemplate`.
- [src/lib/scoreBanner.js](src/lib/scoreBanner.js) — `scoreBannerTemplate`, `scoreBannerImage`, heuristic.
- [src/app/api/banners/route.js](src/app/api/banners/route.js) — 3-variant generation + scoring + winner persistence.
- [src/app/api/generate/route.js](src/app/api/generate/route.js) — multi-image-model fan-out.
- [src/app/api/score/route.js](src/app/api/score/route.js) — standalone score endpoint.
- [src/components/admin/ModelFormModal.jsx](src/components/admin/ModelFormModal.jsx) — provider/key/URL admin form.
- [src/components/generate/ResultsPanel.jsx](src/components/generate/ResultsPanel.jsx) — threshold-with-top-fallback UI.

---

## 16. Glossary

- **Variant** — one of N banners produced for a single brief (default 3).
- **Threshold** — the score (80) that separates "ship it" from "regenerate".
- **Archetype** — one of 8 layout patterns the system prompt rotates through.
- **Provider** — any OpenAI-compatible chat-completions service (admin-managed).
- **Default model** — the one model per kind (text/image) marked `is_default=true`. The banner studio and scorer always pick this one.
- **Fallback template** — the rich, locally-defined banner returned when no real model can be called.
- **Heuristic score** — a deterministic local score (40–95) used when no scoring model is reachable.

That's the whole system in one document. When in doubt, start at the file
referenced for the relevant section — the comments at the top of each
library file mirror this doc's section structure.
