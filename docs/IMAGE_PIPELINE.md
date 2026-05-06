# Banner image pipeline

This doc explains every place an image flows through the banner-generation
pipeline:

- where each image type comes from
- how the text model "sees" or doesn't see the bytes
- which fields / DB columns / CSS variables hold the image at each step
- and what happens when the model can't produce something we accept.

There are **three distinct image concepts** in the pipeline. Conflating
them is the most common source of confusion, so it's worth being precise:

| Concept            | Source                                | Visible in banner? | How the text model "sees" it                                  |
| ------------------ | ------------------------------------- | ------------------ | ------------------------------------------------------------- |
| Reference image    | User upload (`referenceImage`)        | **No**             | As **extracted JSON text** (palette, mood, motifs, vibe, …)   |
| Subject image      | User upload (`subjectImage`)          | **Yes** (priority) | As JSON metadata + the bytes are injected into `bg_image`     |
| AI-gen background  | Image model (when admin enables one)  | **Yes** (fallback) | The text model never sees the bytes — only the resulting URL  |

Everything below references concrete files in `src/lib/`. Keep that map
open if you're tracing what runs where.

---

## 1. Reference image — inspiration only

**User journey:** they click "Reference" inside the prompt input on
`/dashboard/create` and upload a photo. The image is compressed
client-side (`src/lib/imageUpload.js#compressImage`) into a small JPEG /
PNG data URI and POSTed to `/api/banners` as the `referenceImage` field.

The text model **never receives the image bytes directly.** Instead:

1. **Vision extraction** — `extractReferenceImageContext()` in
   [src/lib/referenceImage.js](../src/lib/referenceImage.js) calls the
   default text model (most modern Claude / GPT / Gemini models accept
   images via the OpenAI-compatible `image_url` content part). The system
   prompt asks for a strict JSON schema:

   ```json
   {
     "subject":     "...",
     "category":    "...",
     "mood":        ["...", "..."],
     "palette":     ["#a78bfa", "#22d3ee"],
     "composition": "...",
     "subjectsToFeature": ["...", "..."],
     "vibe":        "..."
   }
   ```

   `sanitizeContext()` then trims, lowercases, and dedupes the response
   so we never trust raw vision-model output. If literally nothing
   useful comes back, the function returns `null`.

2. **Prompt formatting** — `formatReferenceContextForPrompt()` flattens
   the JSON into a paragraph that opens with:

   > REFERENCE IMAGE CONTEXT (inspiration only — extracted from the
   > user's uploaded reference image. Use it to shape the banner's mood,
   > palette, and motifs. DO NOT embed this image in the output):

   That paragraph is injected into the user message via the
   `{referenceContext}` placeholder in `bannerUserScaffold` (see
   [src/lib/prompts.js](../src/lib/prompts.js)).

3. **Generation** — the text model writes the banner HTML+CSS based on
   the brief and the inspiration block. The bytes of the original
   reference are never embedded; only the *interpretation* of the photo
   shapes the design.

**Persistence** — `generation_runs.reference_image_url` and
`banners.reference_image_url` store the original data URI; the JSON
context is stored on the matching `*.reference_context` columns so the
detail / edit page can display it without re-running vision extraction.

### Why does this work?

Vision-capable LLMs ingest images via the same `image_url` content part
that frontier image-understanding APIs use. Behind the scenes the
provider tokenizes the image (e.g. CLIP-style patch embeddings on top of
the LLM's token stream) so the model "reads" it the same way it reads
text — but only inside that single API call. Subsequent calls don't
remember the image; we have to either resend it or pass distilled
context. We chose distilled context because:

- the text model that generates the banner doesn't need pixel detail —
  it needs *guidance*;
- the distilled JSON makes prompt costs predictable;
- we can show the user *exactly* what the AI extracted (see
  `ReferencePanel.jsx`).

---

## 2. Subject image — must appear in the banner

This is the user's headshot, product photo, etc. They click "Subject
image" in the prompt input — distinct button, distinct upload — and the
file lands at `/api/banners` as the `subjectImage` field.

The subject image flows through **three** layers:

1. **Vision extraction** — `extractSubjectImageContext()` runs in
   parallel with the reference extractor. Its JSON schema is different
   because the model needs *placement* guidance, not *inspiration*:

   ```json
   {
     "subjectType":           "person|product|object|scene|logo|other",
     "shortDescription":      "...",
     "framing":               "headshot|half-body|...",
     "hasCleanBackground":    true | false,
     "backgroundDescription": "...",
     "needsBackgroundRemoval": true | false,
     "suggestedTreatment":    "feather-mask|circular-crop|soft-vignette|blend-multiply|blend-screen|as-is",
     "placement":             "right-portrait|left-portrait|center-hero|...",
     "dominantColors":        ["#...", "#..."],
     "preserveAspect":        true | false
   }
   ```

   `sanitizeSubjectContext()` clamps each enum to a small whitelist and
   defaults missing fields to safe values (e.g. people / products without
   a clean background are auto-flagged as needing CSS-level treatment).

2. **Prompt formatting** — `formatSubjectContextForPrompt()` emits a
   paragraph beginning with:

   > SUBJECT IMAGE CONTEXT (this image WILL appear IN the rendered
   > banner — it is provided to you as the bg_image data URI. Treat it
   > as a real photographic asset to integrate visibly):

   The paragraph hands the model the chosen treatment recipe verbatim,
   e.g. for `feather-mask`:

   > apply mask-image: radial-gradient(ellipse at center, black 60%,
   > transparent 100%) on the subject layer so the existing background
   > fades to transparent at the edges

   `composeBannerMessages()` injects the paragraph via the
   `{subjectContext}` placeholder in `bannerUserScaffold`.

3. **Bytes injection** — `applySubjectImage()` in
   [src/lib/bannerTemplate.js](../src/lib/bannerTemplate.js) writes the
   subject's data URI into the `bg_image` field's `value` (wrapped as
   `url("data:image/...")`). The fallback HTML and every model output
   already include a `<div class="banner__bg-image">` that consumes
   `var(--bg-image)`, so the photo lights up without further intervention.

### So the model sees the subject in two ways:

- **As metadata** — through the SUBJECT IMAGE CONTEXT paragraph, so it
  can reason about placement, palette harmony, and treatment.
- **As image bytes** — only the *vision extractor* call, never the
  banner-generation call. The banner-generation call gets the data URI
  pre-injected into `bg_image` so the rendered HTML displays it. The
  text model only needs to know *that there is a photo at
  var(--bg-image)* — it doesn't need to look at it again.

### Background removal — current strategy

The pipeline does **not** do pixel-level background removal. Instead, it
relies on three layers of CSS-driven integration:

1. The vision extractor flags whether the photo's existing background is
   distracting (`needsBackgroundRemoval: true`) and picks a CSS treatment
   from a fixed whitelist (`feather-mask`, `circular-crop`,
   `soft-vignette`, `blend-multiply`, `blend-screen`, `as-is`).
2. The prompt embeds the treatment recipe so the model writes matching
   CSS (mask-image gradients, clip-path circles, mix-blend-mode, etc.).
3. The fallback `--bg-overlay` / `--bg-blur` CSS vars give the user post
   hoc dials in the editor's Media tab.

This handles 80% of cases (clean studio shots, products on white,
headshots with neutral backdrops). Pixel-level matting (true bg removal)
would require either:

- a third-party API like remove.bg or Cutout.pro,
- a self-hosted model (U²-Net / ModNet),
- or an image-to-image model (next section) that natively returns a
  transparent PNG.

When you eventually add one of those, the right hook is *between* the
vision extractor and the bytes injection: replace `subjectImage` with
the matted version before passing it into `generateBannerTemplate`. The
rest of the pipeline doesn't need to change.

---

## 3. AI-generated background — when an image model is configured

Admins can enable a row in `models` with `kind = "image"` (e.g. OpenAI
`gpt-image-1` / `dall-e-3`, or any OpenAI-compatible image endpoint).
When such a model exists **and the user did not upload a subject
image**, `/api/banners` calls
[src/lib/imageGen.js#generateBannerBackground](../src/lib/imageGen.js)
to synthesise a banner-quality background.

Subject upload always wins. The reasoning:

- the user explicitly chose what should appear IN the banner;
- generating an unrelated background on top of their hero photo would
  fight for attention;
- if the user wants a synthetic background *instead* of a subject, they
  simply leave the subject slot empty.

**Flow:**

1. `composeImagePrompt()` synthesises a short scene-style prompt from the
   user's brief + style + aspect + extracted reference context (mood,
   palette, motifs). Image models perform far better on terse scene
   descriptions than on the long structured prompts text models love.
2. `runOpenAI()` POSTs to the configured endpoint (default
   `https://api.openai.com/v1/images/generations`) with `n=1`,
   `response_format=b64_json`, and the aspect-mapped size from
   `SIZE_FOR_ASPECT`. Other providers can be added by branching on
   `imageModel.provider`.
3. The base64 image is wrapped as a `data:image/png;base64,…` URI and
   passed into `generateBannerTemplate()` as the new `backgroundImage`
   parameter. Inside the template generator, `effectiveBgImage` resolves
   `subjectImage || backgroundImage || null` and feeds it through the
   same `applySubjectImage()` helper used for user subjects, so the
   bytes land in the `bg_image` field exactly the same way.

**Failure handling:** image-gen is best-effort. If the call fails (no
API key, provider error, timeout), the route logs the reason into
`modelErrors` (admins see it as "image-bg: …"), `aiBackgroundImage`
stays `null`, and the text-model variants generate banners without a
photographic background — back to the CSS-only path.

---

## 4. Why we still soft-require the bg_image *layout*

Even with no images at all, the banner HTML must include:

- a `<div class="banner__bg-image">` (or any other element)
- a CSS rule that applies `background-image: var(--bg-image);` to it
- `:root { --bg-image: none; … }` so the layer is invisible by default

This keeps the banner shape consistent across:

- text-model fallbacks,
- text-model successes with no subject and no image-gen,
- image-gen + text-model success,
- subject upload + text-model success.

Whichever path runs, the user can *swap in* a different bg image later
in the editor (Media tab) without us regenerating anything.

The system prompt no longer demands the model emit a `bg_image` field
— `ensureBgImageField()` injects it server-side so the model can focus
on layout quality without juggling the field schema. This change cut
the fallback rate substantially because it stopped models from choking
on inline-SVG escaping and oversized JSON outputs.

---

## 5. Database columns

Migration `0010_banner_reference_image.sql` added:

- `banners.reference_image_url`, `banners.reference_context`
- `generation_runs.reference_image_url`, `generation_runs.reference_context`

Migration `0011_banner_subject_image.sql` added:

- `banners.subject_image_url`, `banners.subject_context`
- `generation_runs.subject_image_url`, `generation_runs.subject_context`

The AI-generated background **does not get its own column** because:

- the bytes are persisted as part of the `banners.fields` JSON column
  (the `bg_image` field's `value`), so they survive into the editor
  and every export format;
- the model used is reported on the API response as `backgroundModel`
  for admin visibility;
- if you later want to track per-run background-model stats, add a
  `generation_runs.background_model_id` column; the data is already
  available in the route.

---

## 6. Adding a new provider

Most edits should land in **one** of three files:

- vision extraction logic → `src/lib/referenceImage.js`
- image generation → `src/lib/imageGen.js` (branch on `imageModel.provider`)
- prompt schema / placeholder injection → `src/lib/prompts.js`

If you're adding a *new* provider that returns transparent PNGs (think
Stable Diffusion XL with the SDXL-Turbo checkpoint, or Replicate's
"remove-bg" lineage), you can route its output through the existing
`subjectImage` path — `applySubjectImage()` doesn't care whether the
data URI came from a user upload or a model.
