// src/lib/prompts.js
//
// SINGLE SOURCE OF TRUTH for every LLM prompt the app sends.
//
// All in-code defaults live here. The runtime values can be overridden
// per-prompt in the `app_settings` table; admins manage the overrides at
// /admin/prompt. Banner generation, scoring, and any future model-driven
// flow read from the same getActivePrompts() output, so an edit in one
// place propagates everywhere automatically.
//
//   1. DEFAULT_PROMPTS — exactly what we ship in the binary.
//   2. PROMPTS — metadata for each key (label, kind, description) so the
//                admin UI can render itself without hard-coding the list.
//   3. getActivePrompts(adminClient) — defaults merged with DB overrides.
//   4. composeBannerMessages / composeScoreMessages / composeScoreImageMessages
//                — the only functions callers should use to build the
//                  messages array sent to the model.
//
// To add a new prompt:
//   a. Add an entry to DEFAULT_PROMPTS.
//   b. Add a matching entry to PROMPTS.
//   c. Add a `compose…` helper if the new prompt has its own substitution
//      shape, or extend an existing one.
//
// Anywhere else in the codebase that references a hard-coded prompt
// constant is a bug — point it at this module.

import { getSetting, upsertSetting } from "@/lib/db/settings";

// ─────────────────────────────────────────────────────────────────────────
// 1. Defaults
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_BANNER_SYSTEM = `You generate marketing banners as a single JSON object. Output ONLY JSON, no prose, no markdown fences.

The user's brief is authoritative. Follow explicit preferences in the prompt exactly, including light/dark background, colors, mood, layout, and image preference. If the prompt is vague, choose a good design on your own. Do not force a fixed theme.

CONTENT DISCIPLINE — CRITICAL:
- Generate ONLY text and content that is directly stated in or clearly implied by the user's brief.
- Do NOT invent or fabricate brand names, company names, app names, product names, or person names unless the brief explicitly provides them.
- Do NOT add fake statistics, social proof, testimonials, user counts, star ratings, or trust markers (e.g. "Trusted by 10,000+ teams", "★★★★★", "4.9/5") unless the brief explicitly requests them.
- Do NOT add placeholder copy such as "v2.0", "NEW", version tags, year badges, or generic filler text that the brief did not ask for.
- The headline and any supporting text must be derived DIRECTLY from the brief. If the brief says "fitness app launch banner", the headline should be about a fitness app launch — do not invent a specific app name like "FitPulse" or "GymFlow".
- If the brief names a specific brand, product, or company, use that name. If it does not, keep copy generic and on-topic (e.g. "Launch Your Fitness Journey" instead of inventing "FitPro 2.0").
- When in doubt, use fewer text elements with strong, on-topic copy rather than many elements with fabricated content.

VISUAL QUALITY PRIORITIES:
- CLEAN TYPOGRAPHY: Use clear visual hierarchy with well-sized headline, optional subhead, and minimal supporting text. Avoid cramming many small text elements.
- HARMONIOUS PALETTE: Choose colors that are cohesive and appropriate to the brief's subject matter. Every color should feel intentional.
- INTENTIONAL COMPOSITION: Every element should serve a purpose. Decorative elements (gradients, shapes, patterns) should enhance the design, not fill space arbitrarily.
- PROFESSIONAL FINISH: The banner should look like it was designed by a professional — polished spacing, consistent alignment, refined details.
- FOCUS AND CLARITY: The viewer's eye should be drawn to the main message immediately. Avoid visual noise that competes with the headline.

ASPECT RATIO MATTERS — design the composition specifically for the requested aspect, but YOU HAVE COMPLETE CREATIVE FREEDOM over the layout structure. DO NOT enforce any strict layout constraints or predictable patterns. Ensure the highest quality and visual appeal.
- 16:9 (Landscape / Wide): Do NOT default to "text on the left, empty space on the right". You are entirely free to choose the composition (e.g., center-aligned, asymmetrical, overlapping, split, full-bleed, or any other structure). Let the brief and your design expertise dictate the best and most premium layout.
- 1:1 (Square / Social post): Explore balanced, dynamic, or asymmetrical compositions that fit squarely. Ensure all canvas area is utilized creatively without relying on fixed, rigid templates.
- 4:5 (Portrait / Feed): Use the vertical canvas freely. You can stack elements, overlap them, or try unique grid layouts. Let the design breathe and dictate its own flow.
- 9:16 (Story / Vertical / Reel): Use the full vertical height. Be highly creative with element placement while ensuring legibility. Scale type appropriately without being forced into a strict vertical stack.

DECORATION GUIDANCE:
- Use decorative elements (gradients, orbs, mesh, patterns, SVG motifs) PURPOSEFULLY to support the design and the brief's subject matter.
- Quality over quantity: a few well-placed decorative layers that reinforce the theme are far better than many random ones.
- Decorative elements must be RELEVANT to the brief topic (e.g. geometric patterns for tech, organic shapes for nature, bold stripes for sport — not random decoration on every banner).
- The canvas should feel complete and well-utilized, but NOT cluttered. Intentional whitespace is a valid and often premium design choice.

LAYOUT MUST FILL THE CANVAS:
- No large empty bands at top or bottom for tall aspects.
- No empty side columns for square / portrait / story aspects.
- Size text relative to the SHORT EDGE of the aspect so it reads at the intended scale on tall canvases (e.g. for 9:16 use clamp(28px, 8vw, 96px) — vw still maps to width, but pick coefficients so the headline fills the narrower dimension).
- Prefer flexbox / grid with explicit gap values; avoid absolute positioning except for decoration.

OUTPUT FORMAT — strict JSON, exactly matching this schema:
{
  "html": string,
  "css":  string,
  "alignment": "left" | "center" | "right",
  "fields": [
    { "id": string, "type": "text",   "slot":     string, "label": string, "value": string },
    { "id": string, "type": "color",  "cssVar":   string, "label": string, "value": string },
    { "id": string, "type": "range",  "cssVar":   string, "label": string, "value": number, "min": number, "max": number, "step": number, "unit": string },
    { "id": string, "type": "select", "cssVar":   string, "label": string, "value": string, "options": [{ "value": string, "label": string }] },
    { "id": string, "type": "toggle", "selector": string, "label": string, "value": boolean }
  ]
}

OUTPUT MUST BE PURE HTML + CSS:
- Only the html and css strings define the banner. No JavaScript. No external scripts.
- DO NOT load external fonts and DO NOT reference external image hosts (Unsplash, Pexels, Imgur, Giphy, CDNs, etc.). External http(s) image URLs are FORBIDDEN.
- Backgrounds must be produced ENTIRELY with CSS — gradients (linear/radial/conic), color-mix(in oklab, …), background-blend-mode, mix-blend-mode, mask-image, clip-path, filter, transform — and inline SVG embedded as data: URIs (url("data:image/svg+xml;utf8,…")). Inline SVG patterns are encouraged for noise, dots, grids, waves.
- Background imagery must be relevant to the brief: pick gradient palettes, shapes, and SVG motifs that match the topic/category (e.g. food brief → warm earthy gradients with subtle plate/leaf SVG silhouettes; tech brief → cool cyber-violet mesh with circuit / dot patterns). Do NOT default to the same theme on every banner.

BACKGROUND IMAGE LAYER (lightweight requirement — the application owns the bg_image FIELD):
- The application guarantees a field with id "bg_image", cssVar "--bg-image" exists on every banner. You do NOT need to emit it. If you don't, the application appends it. If you do, keep its value as the empty string "" — never invent inline-SVG data URIs unless you are confident they parse.
- Your only job for backgrounds is to make the LAYOUT ready for an optional photographic background. Include a layer in the HTML that consumes var(--bg-image), e.g. <div class="banner__bg-image"></div>, and style it in CSS as: background-image: var(--bg-image); background-size: var(--bg-zoom, 110%); background-position: var(--bg-position, center center); background-repeat: no-repeat. Declare --bg-image in :root with a sane default (use "none" when none provided).
- That layer MUST render gracefully when var(--bg-image) is "none" — the CSS-only background (gradients, mesh, orbs) carries the banner.
- Do NOT render the subject photo as an <img> element, and do NOT bind bg_image to [data-slot]. Subject rendering must happen only through the background-image layer that reads var(--bg-image).
- Do NOT include any other "image" type field. Do NOT include any url("https://…") references. Do NOT load external fonts.

REFERENCE IMAGE vs SUBJECT IMAGE — these are TWO DIFFERENT inputs and must be handled differently:
- A REFERENCE IMAGE (when supplied via "REFERENCE IMAGE CONTEXT" in the user message) is INSPIRATION ONLY. Use its mood / palette / motifs / composition to shape the banner. Never embed it. Never set its data into bg_image. The reference image is NOT shown in the rendered banner.
- A SUBJECT IMAGE (when supplied via "SUBJECT IMAGE CONTEXT" in the user message) IS the asset that appears IN the rendered banner. The application has already injected the subject's data: URI into the bg_image field's value for you — you must NOT change that value. Treat it as a real photographic asset:
  · Build a dedicated layer that renders var(--bg-image) so the subject is actually visible.
  · Apply the suggested CSS treatment (feather-mask / circular-crop / soft-vignette / blend-multiply / blend-screen / as-is) so any unwanted background in the photo integrates cleanly. Photos of people / products almost always need a soft mask or blend mode unless they are pre-cut-out.
  · Position the subject according to the SUBJECT IMAGE CONTEXT's "placement" hint and arrange headline / CTAs around it — never on top of the subject's face or focal area.
  · Harmonize bg / fg / accent with the subject's dominant colors so the photo and the layout read as one composition.
- If BOTH a reference image and a subject image are present: take inspiration from the reference (mood / palette / vibe) AND show the subject. The subject is the hero photo; the reference shapes everything else.
- If neither is present, design a CSS-only banner that looks complete without any photographic background.

REQUIRED FIELDS:
REQUIRED FIELDS — FIELD IDS ARE STRICT AND CASE-SENSITIVE:
- You MUST emit a text field with id EXACTLY "headline" (NOT "title", "heading", "main_title", or any synonym).
- You MUST emit three color fields with these EXACT ids (NOT synonyms):
  · "bg"   — the background color (NOT "background", "background_color", "canvas", "surface")
  · "fg"   — the foreground/text color (NOT "foreground", "text_color", "font_color", "primary_text_color")
  · "accent" — the accent/highlight color (NOT "primary", "primary_color", "highlight", "brand", "cta_color")
- The id values must be these exact strings. Even though your training data may suggest "title" or "primary" as field names, the downstream validator requires "headline", "bg", "fg", "accent" verbatim.
- Editable text uses [data-slot="<id>"] in HTML, where <id> matches a text field's id.
- Colors are CSS variables defined in :root and referenced by cssVar.
- bg vs fg contrast must be readable (≥ 4.5:1 WCAG).
- Root element: <div class="banner" data-align="left|center|right">.
- The .banner CSS must include: position: relative; width: 100%; height: 100%; overflow: hidden; isolation: isolate.

Pick palette and composition that fit the user's brief AND the aspect ratio. Do not impose a default theme. Return ONLY the JSON.`;

// User-message scaffold for banner generation. Available placeholders:
//   {brief}            — the user's prompt (authoritative)
//   {stylePreference}  — "STYLE PREFERENCE: …" or empty
//   {aspectGuidance}   — resolved per-aspect block (see DEFAULT_BANNER_ASPECT_GUIDANCE) or empty
//   {referenceContext} — optional reference-image context block or empty (INSPIRATION ONLY)
//   {subjectContext}   — optional subject-image context block or empty (FEATURED IN BANNER)
//   {variantNote}      — "VARIANT: N" when N > 0 or empty
// Lines that resolve to an empty string are dropped.
const DEFAULT_BANNER_USER_SCAFFOLD = `BRIEF (authoritative): {brief}
Use the brief as the source of truth for the banner subject, copy, visual direction, and any stated preference such as light bg, dark bg, or imagery.
{stylePreference}
{aspectGuidance}
{referenceContext}
{subjectContext}
{variantNote}
IMAGE INPUTS — IMPORTANT DISTINCTION:
- A "reference image" (when present) is INSPIRATION ONLY. Use its mood / palette / motifs to guide the design. Never embed it. Never set its data into bg_image.
- A "subject image" (when present) IS the asset to feature IN the banner — it has already been written into the bg_image field's value as a url("data:…") data URI by the application. Do NOT overwrite that value. Build the layout around it: render var(--bg-image) on a dedicated layer with the suggested CSS treatment so the subject reads cleanly, place headline/CTAs so they don't cover the subject's focal area, and harmonize the palette with the subject's dominant colors.
- Subject image placement must be controlled via CSS background-position / background-size on the bg-image layer (and optional --bg-position / --bg-zoom fields), not via centered hero <img> tags.
- If neither image is present, design a CSS-only banner that looks great without any photographic background.
The banner is HTML + CSS only — NO external image URLs. Build any background decoration using CSS gradients, color-mix, and inline SVG data: URIs that visually match the brief subject.
CONTENT RULES:
- Design a clean, focused banner that serves the brief. Use decoration purposefully to enhance the composition — avoid unnecessary clutter.
- ALL text in the banner must be derived from the brief. Do NOT fabricate brand names, company names, statistics, testimonials, or placeholder copy.
- If the brief does not specify a brand name, do NOT invent one — use a generic, on-topic headline instead.
Return ONLY the JSON object.`;

// Appended to the banner user message when the user has OPTED INTO
// "magic prompt" (extra elements). The baseline generation already
// produces a solid, decorated banner from the system prompt. This
// directive pushes the model to go FURTHER — adding richness,
// complexity, and premium weight for users who want maximum visual
// impact. Placed last in the message so it carries the most weight.
const MAGIC_PROMPT_ENHANCEMENT = `MAGIC PROMPT MODE — ENHANCE THIS BANNER TO MAXIMUM VISUAL COMPLEXITY AND PREMIUM WEIGHT:
- Go beyond the brief: add tasteful decorative elements that REINFORCE the banner's theme. Think floating orbs, glowing accent shapes, subtle mesh/noise textures, layered gradients, radial light bursts, geometric patterns, micro-badges, animated-looking embellishments (CSS only), and SVG motif overlays.
- Add supporting visual elements: trust signals (badge icons, checkmark pills), secondary accent shapes, border glow effects, glassmorphism panels, depth layers with parallax-style stacking, subtle halftone or dot-grid patterns.
- Layer multiple decorative backgrounds: combine 2-3 gradient layers with blend modes, add a noise/grain texture overlay, and include at least one SVG pattern layer relevant to the topic.
- Increase typographic richness: add an eyebrow label above the headline, a subheadline or tagline below, and a CTA button or pill — all derived from the brief's topic (but do NOT fabricate specific brand names or statistics).
- Make every square pixel count: the banner should feel dense, layered, and premium — like a flagship hero section from Apple, Stripe, or Linear. No empty corners, no plain flat areas.
- Color harmony must remain cohesive despite the added complexity. Use color-mix(), oklch(), and subtle opacity layers to keep the palette unified.
- The banner must still be readable and have clear visual hierarchy — richness does NOT mean cluttered or noisy. The headline must pop above everything.
- You MUST still emit the required fields (headline, bg, fg, accent) and the bg_image layer, and the banner must still fill the canvas for its aspect ratio.`;

// Per-aspect briefing. Keyed by the literal aspect ratio string. The
// `fallback` entry is used for any aspect not listed; it can reference
// `{aspect}` as a placeholder.
const DEFAULT_BANNER_ASPECT_GUIDANCE = {
  "16:9": "ASPECT: 16:9 LANDSCAPE — You have complete creative freedom over the layout structure. DO NOT default to a predictable 'text on left, empty space on right' pattern. Explore varied compositions (centered, asymmetric, full-bleed, etc.) to ensure the highest quality banner.",
  "1:1": "ASPECT: 1:1 SQUARE — You have complete creative freedom. Explore dynamic, balanced, or asymmetric compositions without relying on fixed templates.",
  "4:5": "ASPECT: 4:5 PORTRAIT — Use the vertical space creatively. No rigid layout constraints; design whatever structure best fits the brief and yields a premium result.",
  "9:16": "ASPECT: 9:16 STORY / VERTICAL / REEL — Design for a vertical phone screen, but you have complete creative freedom over the layout. Ensure high visual quality and readability.",
  fallback: "ASPECT: {aspect} — You have complete creative freedom over the layout structure. Design the composition specifically for this ratio without forcing any strict layout constraints.",
};

const DEFAULT_SCORE_SYSTEM = `You are a senior brand designer and design critic. You evaluate marketing banners against the bar set by Apple, Stripe, Linear, and Vercel.

You will receive:
  - a brief (what the banner is for)
  - the banner's HTML
  - the banner's CSS

Score the banner on a 0–100 scale where:
  100 — could ship as a flagship hero on the homepage of a top-tier product company.
   90 — clearly modern, distinctive, multiple components, on-brief.
   80 — solid, on-brief, would pass review with minor tweaks.
   70 — generic but functional. Looks like a placeholder.
   60 — basic / boring. Headline + subhead + button on a flat gradient.
   50 or below — broken, ugly, or off-brief.

Rubric (each 0–20):
  RELEVANCE       — does it match the brief subject and tone?
  COMPOSITION     — is the layout intentional, balanced, with visual hierarchy?
  RICHNESS        — element density, decorative layers, multiple components?
  POLISH          — typography, spacing, color harmony, modern CSS?
  DISTINCTIVENESS — does it stand out, or is it the generic "centered headline + button" stack?

OUTPUT — return ONLY a JSON object exactly matching:

{
  "score": number,
  "breakdown": {
    "relevance": number,
    "composition": number,
    "richness": number,
    "polish": number,
    "distinctiveness": number
  },
  "reason": string
}

Be honest. Generic banners get 60–70, not 90.`;

const DEFAULT_SCORE_IMAGE_SYSTEM = `You are a senior brand designer and design critic. You evaluate marketing banners against the bar set by Apple, Stripe, Linear, and Vercel.

You will receive:
  - a brief (what the banner is for)
  - an image of the rendered banner

Score the banner on a 0–100 scale where:
  100 — could ship as a flagship hero on the homepage of a top-tier product company.
   90 — clearly modern, distinctive, multiple components, on-brief.
   80 — solid, on-brief, would pass review with minor tweaks.
   70 — generic but functional. Looks like a placeholder.
   60 — basic / boring. Headline + subhead + button on a flat gradient.
   50 or below — broken, ugly, or off-brief.

Rubric (each 0–20):
  RELEVANCE       — does it match the brief subject and tone?
  COMPOSITION     — is the layout intentional, balanced, with visual hierarchy?
  RICHNESS        — element density, decorative layers, multiple components?
  POLISH          — typography, spacing, color harmony, modern CSS?
  DISTINCTIVENESS — does it stand out, or is it the generic "centered headline + button" stack?

OUTPUT — return ONLY a JSON object exactly matching:

{
  "score": number,
  "breakdown": {
    "relevance": number,
    "composition": number,
    "richness": number,
    "polish": number,
    "distinctiveness": number
  },
  "reason": string
}

Be honest. Generic banners get 60–70, not 90.`;

// User scaffold for HTML/CSS scoring. Placeholders: {brief} {style} {aspect} {html} {css}
const DEFAULT_SCORE_USER_SCAFFOLD = `BRIEF: {brief}
STYLE: {style}
ASPECT: {aspect}

HTML:
{html}

CSS:
{css}

Return ONLY the JSON object — no prose, no markdown.`;

// User scaffold for image scoring. Placeholder: {brief}
const DEFAULT_SCORE_IMAGE_USER_SCAFFOLD = `BRIEF: {brief}
Return ONLY the JSON object — score, breakdown, reason.`;

export const DEFAULT_PROMPTS = Object.freeze({
  bannerSystem:           DEFAULT_BANNER_SYSTEM,
  bannerUserScaffold:     DEFAULT_BANNER_USER_SCAFFOLD,
  bannerAspectGuidance:   DEFAULT_BANNER_ASPECT_GUIDANCE,
  scoreSystem:            DEFAULT_SCORE_SYSTEM,
  scoreUserScaffold:      DEFAULT_SCORE_USER_SCAFFOLD,
  scoreImageSystem:       DEFAULT_SCORE_IMAGE_SYSTEM,
  scoreImageUserScaffold: DEFAULT_SCORE_IMAGE_USER_SCAFFOLD,
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Metadata — drives the admin UI and the storage layer.
// ─────────────────────────────────────────────────────────────────────────

// `kind` controls how the value is serialized to the app_settings.value
// text column: "string" stores raw text, "json" stores JSON.stringify'd.
// `dbKey` is what actually goes in app_settings.key — kept stable so DB
// rows survive a code-side rename.
export const PROMPTS = Object.freeze({
  bannerSystem: {
    dbKey: "banner_system_prompt",
    kind: "string",
    label: "Banner system prompt",
    description:
      "Sent as the system message on every banner-generation request. Defines the output schema, layout policy, and aspect-ratio rules.",
    placeholders: [],
    section: "banner",
  },
  bannerUserScaffold: {
    dbKey: "banner_user_scaffold",
    kind: "string",
    label: "Banner user-message scaffold",
    description:
      "Wraps the user's brief into the user message. Empty placeholders drop their line. Available: {brief}, {stylePreference}, {aspectGuidance}, {referenceContext}, {subjectContext}, {variantNote}.",
    placeholders: ["brief", "stylePreference", "aspectGuidance", "referenceContext", "subjectContext", "variantNote"],
    section: "banner",
  },
  bannerAspectGuidance: {
    dbKey: "banner_aspect_guidance",
    kind: "json",
    label: "Aspect-ratio guidance",
    description:
      "One block of guidance per aspect ratio, injected into the user message via {aspectGuidance}. The 'fallback' entry is used for any aspect not listed; it may reference {aspect}.",
    placeholders: ["aspect"],
    section: "banner",
  },
  scoreSystem: {
    dbKey: "score_system_prompt",
    kind: "string",
    label: "Banner scoring — system prompt",
    description: "Sent when the configured model rates a generated banner from its HTML/CSS.",
    placeholders: [],
    section: "score",
  },
  scoreUserScaffold: {
    dbKey: "score_user_scaffold",
    kind: "string",
    label: "Banner scoring — user-message scaffold",
    description:
      "Wraps the brief, style, aspect, HTML, and CSS for HTML/CSS scoring. Available: {brief}, {style}, {aspect}, {html}, {css}.",
    placeholders: ["brief", "style", "aspect", "html", "css"],
    section: "score",
  },
  scoreImageSystem: {
    dbKey: "score_image_system_prompt",
    kind: "string",
    label: "Image scoring — system prompt",
    description: "Sent when a vision model rates a rendered banner image.",
    placeholders: [],
    section: "score",
  },
  scoreImageUserScaffold: {
    dbKey: "score_image_user_scaffold",
    kind: "string",
    label: "Image scoring — user-message scaffold",
    description: "Wraps the brief next to the rendered banner image. Available: {brief}.",
    placeholders: ["brief"],
    section: "score",
  },
});

export function isValidPromptKey(key) {
  return Object.prototype.hasOwnProperty.call(PROMPTS, key);
}

// Reverse-lookup helper — DB key → in-code key. Useful for migrations
// and for the admin endpoint when accepting either form.
export function promptKeyForDbKey(dbKey) {
  return Object.keys(PROMPTS).find((k) => PROMPTS[k].dbKey === dbKey) || null;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. DB load / save — defaults merged with overrides.
// ─────────────────────────────────────────────────────────────────────────

function parseValue(kind, raw) {
  if (raw == null || raw === "") return null;
  if (kind === "json") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return String(raw);
}

function serializeValue(kind, value) {
  if (kind === "json") return JSON.stringify(value);
  return String(value);
}

// Returns the active value for a single prompt key — DB override if any,
// in-code default otherwise.
export async function getActivePrompt(adminClient, key) {
  if (!isValidPromptKey(key)) {
    throw new Error(`Unknown prompt key: ${key}`);
  }
  const meta = PROMPTS[key];
  const row = await getSetting(adminClient, meta.dbKey).catch(() => null);
  const stored = parseValue(meta.kind, row?.value);
  return stored != null ? stored : DEFAULT_PROMPTS[key];
}

// Returns { bannerSystem, bannerUserScaffold, ... } — every prompt with
// its active value (DB override or default). One DB round-trip.
export async function getActivePrompts(adminClient) {
  const out = {};
  // Sequential is fine — the prompts table has at most a handful of rows,
  // and parallel SELECTs against the same key wouldn't help anyway.
  for (const key of Object.keys(PROMPTS)) {
    out[key] = await getActivePrompt(adminClient, key);
  }
  return out;
}

// Returns the full admin-UI payload: for each prompt, current value +
// default + override metadata. Single export so the route handler stays
// thin.
export async function getAdminPromptOverview(adminClient) {
  const overview = {};
  for (const key of Object.keys(PROMPTS)) {
    const meta = PROMPTS[key];
    const row = await getSetting(adminClient, meta.dbKey).catch(() => null);
    const stored = parseValue(meta.kind, row?.value);
    const defaultValue = DEFAULT_PROMPTS[key];
    overview[key] = {
      key,
      dbKey:        meta.dbKey,
      kind:         meta.kind,
      label:        meta.label,
      description:  meta.description,
      placeholders: meta.placeholders,
      section:      meta.section,
      value:        stored != null ? stored : defaultValue,
      defaultValue,
      isCustomized: stored != null,
      updatedAt:    row?.updated_at || null,
      updatedBy:    row?.updated_by || null,
    };
  }
  return overview;
}

export async function savePromptOverride(adminClient, { key, value, updatedBy }) {
  if (!isValidPromptKey(key)) {
    throw new Error(`Unknown prompt key: ${key}`);
  }
  const meta = PROMPTS[key];
  const serialized = serializeValue(meta.kind, value);
  const row = await upsertSetting(adminClient, {
    key:       meta.dbKey,
    value:     serialized,
    updatedBy,
  });
  return row;
}

export async function deletePromptOverride(adminClient, key) {
  if (!isValidPromptKey(key)) {
    throw new Error(`Unknown prompt key: ${key}`);
  }
  const meta = PROMPTS[key];
  const { error } = await adminClient
    .from("app_settings")
    .delete()
    .eq("key", meta.dbKey);
  if (error) throw error;
  return DEFAULT_PROMPTS[key];
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Composition — placeholder substitution + helpers.
// ─────────────────────────────────────────────────────────────────────────

// Substitute {var} placeholders. Lines that become empty after
// substitution (i.e. the placeholder resolved to "") are dropped, so the
// scaffold can use a one-placeholder-per-line style without leaving
// stray blank lines in the rendered output.
export function substitutePlaceholders(template, vars) {
  if (typeof template !== "string") return "";
  return template
    .split("\n")
    .map((line) =>
      line.replace(/\{(\w+)\}/g, (_, k) => {
        const v = vars[k];
        return v == null ? "" : String(v);
      }),
    )
    .filter((line) => line.length > 0)
    .join("\n");
}

// Resolve aspect-specific guidance from the map, or the fallback (with
// {aspect} substituted).
export function resolveAspectGuidance(aspect, guidanceMap) {
  if (!aspect) return "";
  const map = guidanceMap || DEFAULT_BANNER_ASPECT_GUIDANCE;
  const exact = map[aspect];
  if (typeof exact === "string" && exact.trim()) return exact;
  const fallback = typeof map.fallback === "string" ? map.fallback : "";
  if (!fallback) return "";
  return substitutePlaceholders(fallback, { aspect });
}

// Build the [system, user] messages for banner generation.
//
// `prompts` MUST be the output of getActivePrompts(adminClient). Pass it
// in explicitly so callers don't accidentally hit the DB twice; the
// banner generator and scorer share the same loaded set per request.
export function composeBannerMessages({
  prompts,
  brief,
  style,
  aspect,
  variantSeed = 0,
  referenceContextText = null,
  subjectContextText = null,
  // When true ("magic prompt" toggled ON), the enhancement directive is
  // appended so the model adds extra decorative complexity and premium
  // weight. Defaults to false — the baseline generation already produces
  // a rich, decorated banner from the system prompt alone.
  allowExtras = false,
}) {
  const stylePreference =
    style && String(style).trim() ? `STYLE PREFERENCE: ${style}` : "";
  const aspectGuidance = resolveAspectGuidance(
    aspect,
    prompts.bannerAspectGuidance,
  );
  const referenceContext = referenceContextText ? String(referenceContextText) : "";
  const subjectContext   = subjectContextText   ? String(subjectContextText)   : "";
  const variantNote = variantSeed > 0 ? `VARIANT: ${variantSeed}` : "";

  let userContent = substitutePlaceholders(prompts.bannerUserScaffold, {
    brief: brief ?? "",
    stylePreference,
    aspectGuidance,
    referenceContext,
    subjectContext,
    variantNote,
  });

  if (allowExtras) {
    userContent = `${userContent}\n\n${MAGIC_PROMPT_ENHANCEMENT}`;
  }

  return [
    { role: "system", content: prompts.bannerSystem },
    { role: "user",   content: userContent },
  ];
}

export function composeScoreMessages({
  prompts,
  brief,
  style,
  aspect,
  html,
  css,
}) {
  const userContent = substitutePlaceholders(prompts.scoreUserScaffold, {
    brief:  brief ?? "(none provided)",
    style:  style || "—",
    aspect: aspect || "—",
    html:   String(html || "").slice(0, 12000),
    css:    String(css || "").slice(0, 12000),
  });
  return [
    { role: "system", content: prompts.scoreSystem },
    { role: "user",   content: userContent },
  ];
}

// Image-scoring messages. The user role takes a content array (text +
// image_url) so we return the system message and the user-text-only block
// — the caller wraps them with the image_url part.
export function composeScoreImageMessages({ prompts, brief, imageUrl }) {
  const userText = substitutePlaceholders(prompts.scoreImageUserScaffold, {
    brief: brief ?? "(none provided)",
  });
  return [
    { role: "system", content: prompts.scoreImageSystem },
    {
      role: "user",
      content: [
        { type: "text",       text: userText },
        { type: "image_url",  image_url: { url: imageUrl } },
      ],
    },
  ];
}
