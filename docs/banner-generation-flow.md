# Banner Generation Pipeline

End-to-end walkthrough of what happens when a user clicks **Generate banner**
on `/dashboard/create`. Covers every step, which kind of model runs there,
how the subject / reference images flow through the system, and how the
final banner gets saved and displayed.

If you only want the headline: there are **seven stages**, three **kinds
of model** (text/vision, image-generation, background-removal), and one
**stock-photo provider chain**. Anything that fails is treated as
best-effort — the pipeline degrades cleanly instead of erroring out.

---

## TL;DR map

```
 User → /dashboard/create
         │
         ▼
   POST /api/banners ──────────► creates a Job, returns jobId immediately
         │                       (UI polls /api/generation-status/[jobId])
         ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │  Worker (performBannerGeneration in src/app/api/banners/route.js) │
 │                                                                  │
 │  1. UPLOAD_IMAGES        — store data URIs in Supabase Storage   │
 │  2. ANALYZE_REFERENCE    \ vision model — referenceImage.js      │
 │     ANALYZE_SUBJECT       } run in parallel                      │
 │     (subject bg-removal) / bg-removal provider chain             │
 │  3. ENHANCE_PROMPT       — text model rewrites brief + decides   │
 │                            subject placement                     │
 │  4. PARALLEL_MODELS      — text models emit HTML/CSS banners     │
 │  5. SCORE_BANNERS        — text/vision model rates each candidate│
 │  6. DETECT_CATEGORY      — text model classifies the winner      │
 │  7. FETCH_BG_IMAGE       — stock provider chain → AI image-gen   │
 │                            fallback → layer onto winner          │
 │     SAVE_BANNER          — write rows to Supabase                │
 └──────────────────────────────────────────────────────────────────┘
         │
         ▼
   Editor at /dashboard/banners/[id]/edit OR builder at /dashboard/builder/[id]
```

Source of truth for the step list: [`src/lib/generationQueue.js`](../src/lib/generationQueue.js).
Source of truth for the orchestration: [`src/app/api/banners/route.js`](../src/app/api/banners/route.js).

---

## Which model runs where

| Stage | Model kind | Configured at | Notes |
|---|---|---|---|
| Analyze reference image | **Vision model** (text model with image-input enabled) | Admin → Models — the default text model | Called via `callOpenRouter` with `image_url` parts. Returns palette / mood / composition JSON. |
| Analyze subject image | **Vision model** (same as above) | Same default text model | Returns subject type / framing / placement / dominant colors. |
| Remove subject background | **Background-removal API** OR local fallback | Admin → BG Removal Providers (`/admin/bg-removal-providers`) | Provider chain (e.g. `remove.bg`, `Cloudinary AI`). Falls back to keeping the original image when no provider succeeds. |
| Enhance prompt | **Text model** (JSON mode) | Same default text model | One LLM call returns: enriched brief, placement decision, needsBackground flag. |
| Generate banner variants | **Text models** (one or many, parallel) | Admin → Models — every enabled `kind="text"` row | Each emits HTML + CSS + fields[] strictly matching the schema in `prompts.js`. |
| Score variants | **Text model** (with optional **vision** fallback) | Same text models | HTML/CSS scoring via `scoreBannerTemplate`; the rubric lives in `prompts.js`. |
| Detect category & style | **Text model** (JSON mode) | Same default text model | Classifies winner's HTML/CSS into category/theme/style/mood. |
| Fetch background image | **Stock providers** → **AI image model** fallback | Admin → BG Image Providers (`/admin/bg-image-providers`) + Admin → Models (`kind="image"`) | Tries stock first (Unsplash / Pexels / Pixabay / etc.), falls back to AI image gen. |
| Build background query | **Text model** (JSON mode) | Default text model | Translates the brief + detected category into a vendor-friendly search phrase. |

**One model row, many uses.** The default text model is reused for every
vision / classification / JSON-shaping call — keeps admin config simple.
The image-generation model is only invoked if every stock provider fails.

---

## The seven stages in detail

### 1 · UPLOAD_IMAGES — persist client uploads

Code: [route.js:206-234](../src/app/api/banners/route.js#L206-L234)

The browser uploads reference / subject images as **data URIs** (base64-
encoded). Before any model sees them, the server uploads each to Supabase
Storage and swaps the data URI for a stable HTTPS URL. This matters
because:

- Vision-model calls hand the URL to the LLM — a 200 KB base64 blob in
  every message would burn tokens.
- The banner row eventually persists `reference_image_url` /
  `subject_image_url`. Storing those as data URIs would bloat every
  dashboard query.

If the `banner-images` bucket isn't set up, this step prints a warning
(`Bucket not found`) and the pipeline keeps the data URI as a fallback —
nothing fails, but the saved rows get heavy. Run
`supabase/migrations/0014_banner_images_bucket.sql` once to fix it.

Helper: [`storeBannerImageAsset`](../src/lib/server/bannerImageStorage.js).
It also compresses + reformats the upload to JPEG and caps the longest
edge at 1800px.

### 2 · ANALYZE_REFERENCE + ANALYZE_SUBJECT — parallel vision pass

Code: [route.js:243-271](../src/app/api/banners/route.js#L243-L271)

Three things run **concurrently** here:

1. **Reference image analysis** —
   `extractReferenceImageContext` in [`referenceImage.js`](../src/lib/referenceImage.js).
   Sends the reference URL plus a structured system prompt to the default
   text model. The model returns JSON: `subject`, `category`, `mood[]`,
   `palette[]` (hex codes), `composition`, `subjectsToFeature[]`, `vibe`.
   The reference image is **inspiration only** — never embedded in the
   final banner.

2. **Subject image analysis** —
   `extractSubjectImageContext` in the same file.
   Returns: `subjectType` (person / product / scene / …), `framing`,
   `hasCleanBackground`, `needsBackgroundRemoval`, `suggestedTreatment`
   (one of `feather-mask` / `circular-crop` / `soft-vignette` /
   `blend-multiply` / `blend-screen` / `as-is`), `placement`
   (`right-portrait` / `left-portrait` / `center-hero` / …),
   `dominantColors`. This is the **actual subject** that will appear in
   the banner.

3. **Subject background removal** —
   `removeSubjectBackground` in [`bgRemoval.js`](../src/lib/bgRemoval.js).
   Calls each enabled provider from `/admin/bg-removal-providers` in
   order until one returns a transparent-background cutout. If all
   providers fail, the original subject is used as-is.

If no image was uploaded, the corresponding step is **marked skipped**
(`job.markStepSkipped(...)`), which renders as a strike-through cross on
the progress timeline so the user sees the pipeline didn't stall — it
just had nothing to analyse.

The cutout's bytes are stored to Supabase Storage and replace the
subject URL for everything downstream — that way the editor renders the
clean cutout, not the original with a busy background.

### 3 · ENHANCE_PROMPT — one LLM call, three decisions

Code: [route.js:283-296](../src/app/api/banners/route.js#L283-L296)

Helper: `enhancePrompt` in [`bannerGeneration.js`](../src/lib/bannerGeneration.js).

The default text model (in **JSON mode**) is given the original user
brief plus the two image-context blocks and asked to do three things at
once so they stay consistent with each other:

| Output | Used for |
|---|---|
| `brief` — enriched paragraph | Becomes the **authoritative prompt** for every downstream model call. The original `prompt` is kept too for storage but the model never sees it again on its own. |
| `placement` + `reserveSpace` | Decides where the subject sits in the layout. Threaded into the subject context block before the generation models read it. |
| `needsBackground` | Hint for the bg-fetch step later. Combined with the post-generation `detection.needsExternalBackground` flag. |

If the model is unavailable or returns junk, a deterministic fallback
shape is used (`brief = userPrompt`, `placement` from subject context,
etc.). The pipeline never throws here.

### 4 · PARALLEL_MODELS — text models emit HTML/CSS

Code: [route.js:334-419](../src/app/api/banners/route.js#L334-L419)

Generates banners using **text models** (no images yet). Model selection:

1. If the user picked a specific model in the form, just use that one.
2. Otherwise call `pickBestTextModelWithSecrets` — picks the historical
   highest-scoring model by reading `generation_results`.
3. If there's no history yet, fan out across **every enabled text model
   in parallel**.

Each model receives:

- **System prompt**: the master banner prompt from
  [`prompts.js`](../src/lib/prompts.js) (`DEFAULT_BANNER_SYSTEM`). Defines
  the strict JSON output schema, aspect-ratio rules, field IDs that
  MUST exist (`headline`, `bg`, `fg`, `accent`, `bg_image`), and the
  rules for referencing the subject image via `var(--bg-image)`.
- **User message**: built by `composeBannerMessages`. Wraps the
  enhanced brief with the reference/subject context blocks and the
  per-aspect layout guidance.
- **No external image bytes** at this stage. The text model writes a
  CSS-only banner with its own gradients / inline SVG decoration. If a
  subject image was uploaded, its URL is composited in afterwards via
  the `bg_image` field — the model itself never sees the pixels here.

Returns parsed `{ html, css, fields, alignment }` per model.

Failed models add an entry to `modelErrors` and are excluded — at least
one variant must succeed or the whole job errors out.

### 5 · SCORE_BANNERS — pick the winner

Code: [route.js:427-453](../src/app/api/banners/route.js#L427-L453)

Each variant's HTML/CSS is fed to `scoreBannerTemplate`, which calls a
text model with the scoring rubric from `prompts.js`
(`DEFAULT_SCORE_SYSTEM` — 5 axes × 0–20 each → total 0–100). The model
returns a JSON `{ score, breakdown, reason }`.

The variant with the highest score wins. If none pass `SCORE_THRESHOLD`,
the absolute top scorer wins anyway (so the user always gets *something*
back) and `passedThreshold: false` shows up in the result.

### 6 · DETECT_CATEGORY — classify the winner

Code: [route.js:462-469](../src/app/api/banners/route.js#L462-L469)

Helper: `detectCategoryAndStyle` in `bannerGeneration.js`.

Text model in JSON mode reads the winning banner's HTML/CSS + the
enriched brief and returns:

- `category` — one of `gaming`, `luxury`, `tech`, `fashion`, `sports`,
  `minimal`, `futuristic`, `cinematic`, `dark-aesthetic`, `abstract`,
  `promotional`, `event`, `product-focused`, `lifestyle`, `food`,
  `travel`, `fitness`, `business`, `nature`, `art`, `other`.
- `theme`, `style`, `mood[]` — descriptive labels.
- `needsExternalBackground` — `true` only if a photographic background
  would meaningfully improve the banner.

This category drives the bg-fetch step next, and is persisted on the
banner row for later filtering.

### 7 · FETCH_BG_IMAGE — late, conditional, fallback-friendly

Code: [route.js:471-605](../src/app/api/banners/route.js#L471-L605)

This step has the most branching, but the rules are simple:

**Decide whether to fetch at all.**
Skip when the user uploaded a subject and its background was NOT removed
(the subject already provides a full scene; a stock photo behind it
would clash). Otherwise proceed.

**1. Try admin-configured stock providers** (`/admin/bg-image-providers`).
The providers list is loaded via `listBgImageProviders` and iterated in
DB order via `tryProviderBackground`. Each provider gets:

- `query` — a vendor-friendly search phrase produced by `buildBackgroundQuery`
  (a text-model call that condenses the brief into 1–3 noun phrases).
- `category` — preferred from `detection.category` (the model just told
  us what the banner actually looks like) over the bg-query LLM's guess.

The first provider that returns a usable image wins.

**2. AI image-generation fallback.**
Only runs if no stock provider returned an image. Picks the first
enabled `kind="image"` model and calls `generateBannerBackground`
([`imageGen.js`](../src/lib/imageGen.js)) with the enriched brief,
detected style, aspect ratio, and subject placement (so the image leaves
clean negative space on the correct side).

**3. Apply the result.**
If we got an image, store it in Supabase Storage and layer it onto the
**winner template only**:

| Case | Function | Mapping |
|---|---|---|
| Subject + new bg | `applyLayeredImages` in `bannerTemplate.js` | bg → `bg_image` field, subject → `subject_image` field. Editor's `ImageField` renders them on separate CSS variables (`--bg-image`, `--subject-image`). |
| No subject, new bg | `applySubjectImage` (legacy name) | bg → `bg_image` field. |
| Nothing fetched | none | Step marked skipped. Winner ships unchanged — the text model's CSS gradients / SVG decoration carry the design. |

**Bottom line for backgrounds:** the text model always produces a
self-contained banner first; the photographic bg is a polish layer that
runs after. If it works, it replaces the bg slot; if it doesn't, the
banner is still a complete design.

### 8 · SAVE_BANNER — write to Supabase

Code: [route.js:607-625](../src/app/api/banners/route.js#L607-L625) and below.

Three tables get rows:

- `generation_runs` — one row per generation request. Stores the prompt,
  aspect, style, models used, and the analyzed contexts so a future
  "regenerate" can reuse them without re-running vision.
- `generation_results` — one row per variant. Marks the winner with
  `is_winner = true`. Used by `pickBestTextModelWithSecrets` to learn
  which model performs best.
- `banners` — one row per variant (multiple banners can be saved when
  fanning out across models). Stores `html`, `css`, `fields`, the
  enriched `prompt`, `reference_image_url`, `subject_image_url`,
  `reference_context`, `subject_context`, the winner's score, etc.

The polling UI gets a final `banner` object on completion and
redirects to either `/dashboard/banners/[id]/edit` (single result) or
`/dashboard/banners` (multiple variants).

---

## How the subject image flows, end-to-end

This is the trickiest piece — worth tracing in one place.

1. **Upload**. Browser converts the file to a base64 data URI via
   `compressImage` ([`imageUpload.js`](../src/lib/imageUpload.js)) before
   POSTing.
2. **Persist**. Server uploads to Supabase Storage (`banner-images`
   bucket) → gets a public HTTPS URL. (Step 1 in the pipeline.)
3. **Analyse**. The vision model receives the URL and returns
   `placement`, `suggestedTreatment` (CSS mask recipe), `framing`,
   `dominantColors`, etc.
4. **Background removal**. The cutout provider chain runs in parallel
   with the analysis. If a cutout is produced, it replaces the subject
   URL for everything downstream.
5. **Enhance**. The placement decision from the enhance step overrides
   the vision-model's suggested placement (gives one consistent answer
   to the rest of the pipeline).
6. **Generate**. The text model receives the subject context as a TEXT
   description plus an instruction like:
   > "The bg_image field's value has been set to url('data:…') for you.
   > Reference it via `var(--bg-image)` on a dedicated layer. Apply the
   > `feather-mask` treatment so the photo blends in."
7. **Render**. The model emits HTML with a `<div class="banner__bg-image"></div>`
   layer styled `background-image: var(--bg-image)`. The actual URL is
   injected into the `bg_image` field's `value` at generation time via
   `applySubjectImage`.
8. **Optional re-layer**. If the bg-fetch step (step 7 of the pipeline)
   later succeeds AND there was also a subject, `applyLayeredImages`
   moves the subject from `bg_image` → `subject_image` (separate CSS
   var) and puts the new bg in `bg_image`.
9. **Edit**. The editor reads the banner row, looks up the `bg_image`
   field, and renders the upload control + brightness / blur / overlay
   / zoom sliders in [`ImageField.jsx`](../src/components/editor/ImageField.jsx).

---

## How the reference image flows

Much simpler — the reference is never embedded.

1. Upload + persist (same as subject).
2. Vision analysis returns `palette`, `mood`, `composition`,
   `subjectsToFeature` (motifs).
3. Those values get formatted into the user message as
   `REFERENCE IMAGE CONTEXT (inspiration only — extracted from the
   user's uploaded reference image. Use it to shape the banner's mood,
   palette, and motifs. DO NOT embed this image in the output):`
4. Models read it as text, draw inspiration, and emit a CSS-only banner
   that echoes the palette / motifs.
5. The reference URL is saved on the banner row for traceability but
   never rendered.

---

## How progress is reported to the UI

Code: [`generationQueue.js`](../src/lib/generationQueue.js).

Every step writes one of two things to the in-memory job object:

- `job.setStep(GenerationJobSteps.X)` — current step + push to
  `stepsCompleted`.
- `job.markStepSkipped(GenerationJobSteps.X, reason)` — push to
  `stepsSkipped` with a human-readable reason.

The polling endpoint `/api/generation-status/[jobId]` returns
`job.toJSON()` which includes both arrays plus the current step.

The UI in [`dashboard/create/page.js`](../src/app/dashboard/create/page.js)
polls every 500ms and refreshes its `stepsCompleted` + `stepsSkipped`
state on **every tick**, so ticks and crosses appear in real time as the
backend advances:

- ✓ green check for steps in `stepsCompleted`
- ◌ pulsing dot for the current step
- ✗ struck-through cross for steps in `stepsSkipped` (with the skip
  reason as a tooltip and a small caption underneath)
- · dim dot for steps not yet reached

In-memory jobs are cleaned up 10 minutes after completion
(`JOB_RETENTION_MS` in `generationQueue.js`).

---

## What happens when things fail

The pipeline is built around graceful degradation. Here's what each
failure mode looks like:

| Failure | Effect |
|---|---|
| Storage bucket missing | Pipeline continues with data URI inline. Step still ticks; a warning is logged with the migration hint. Apply `0014_banner_images_bucket.sql` to fix. |
| Vision analysis fails (no API key, model returns junk) | `referenceContext` / `subjectContext` are `null`. The enhance + generation steps still run with whatever they have. |
| Background removal providers all fail | Subject is used as-is (busy background and all). The model's CSS treatment hides it via masking when possible. |
| Enhance LLM fails | Uses a deterministic fallback: `brief = userPrompt`, `placement = subjectContext?.placement || "none"`. |
| One text model fails during PARALLEL_MODELS | Recorded in `modelErrors`, other models keep going. Job only fails if **every** model errored. |
| Scoring model fails | Falls back to a heuristic local score (`templateRichness`) so the pipeline still picks a winner. |
| Category detection fails | Falls back to `referenceContext.category || "other"`. The bg-fetch step then uses the bg-query LLM's guess instead of the detector's. |
| Stock providers all fail AND no image model | `FETCH_BG_IMAGE` marked skipped; the winner ships with its CSS-only design intact. |
| AI image-gen fails | Same — step marked skipped, model's design ships. |
| All text models fail | **Hard error.** Job is marked failed and the user sees the error in the UI. This is the only state the pipeline can't recover from. |

---

## Where to look in the code

| Concern | File |
|---|---|
| Top-level orchestration | [`src/app/api/banners/route.js`](../src/app/api/banners/route.js) |
| Step constants + job state | [`src/lib/generationQueue.js`](../src/lib/generationQueue.js) |
| Vision context extractors | [`src/lib/referenceImage.js`](../src/lib/referenceImage.js) |
| Enhance + detect helpers | [`src/lib/bannerGeneration.js`](../src/lib/bannerGeneration.js) |
| Banner-template generation | [`src/lib/bannerTemplate.js`](../src/lib/bannerTemplate.js) |
| Prompt templates | [`src/lib/prompts.js`](../src/lib/prompts.js) |
| Stock-photo providers | [`src/lib/db/bgImageProviders.js`](../src/lib/db/bgImageProviders.js) |
| BG-query LLM call | [`src/lib/bgQuery.js`](../src/lib/bgQuery.js) |
| Subject BG-removal | [`src/lib/bgRemoval.js`](../src/lib/bgRemoval.js) |
| AI image generation | [`src/lib/imageGen.js`](../src/lib/imageGen.js) |
| LLM client | [`src/lib/openrouter.js`](../src/lib/openrouter.js) |
| Storage helper | [`src/lib/server/bannerImageStorage.js`](../src/lib/server/bannerImageStorage.js) |
| Progress UI | [`src/components/generate/GenerationProgress.jsx`](../src/components/generate/GenerationProgress.jsx) |
| Polling page | [`src/app/dashboard/create/page.js`](../src/app/dashboard/create/page.js) |
| Status endpoint | [`src/app/api/generation-status/[jobId]/route.js`](../src/app/api/generation-status/%5BjobId%5D/route.js) |
