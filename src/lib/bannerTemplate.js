// src/lib/bannerTemplate.js
// Shared HTML banner template generator — used by /api/banners (persists a
// banner in one shot) and /api/banners/html (returns the template for the
// editor).
//
// v3 — produces dramatically more varied, modern banners. The system prompt:
//   1. Forces selection from 8 distinct layout archetypes per generation.
//   2. Requires a real, themed Unsplash background image when the archetype
//      calls for one (and most do).
//   3. Encourages varied text slot composition — not always eyebrow + headline
//      + subhead + cta; sometimes headline + stats, headline + quote, etc.
//   4. Builds image controls (brightness, blur, overlay, zoom, position)
//      directly into the field schema so users can dial in the look.

import { getDefaultTextModel } from "@/lib/db/models";
import { getStyleByName } from "@/lib/db/styles";
import { callOpenRouter, extractJson } from "@/lib/openrouter";

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior brand designer who has shipped award-winning campaigns for Apple, Stripe, Linear, and Vercel. You generate production-grade marketing banners as JSON. Your work is distinctive — every banner you make looks intentional and different from the last.

OUTPUT — a single JSON object exactly matching this schema:

{
  "html": string,
  "css": string,
  "alignment": "left" | "center" | "right",
  "fields": [
    { "id": string, "type": "text",   "slot": string,     "label": string, "value": string },
    { "id": string, "type": "color",  "cssVar": string,   "label": string, "value": string },
    { "id": string, "type": "range",  "cssVar": string,   "label": string, "value": number, "min": number, "max": number, "step": number, "unit": string },
    { "id": string, "type": "select", "cssVar": string,   "label": string, "value": string, "options": [{ "value": string, "label": string }] },
    { "id": string, "type": "toggle", "selector": string, "label": string, "value": boolean },
    { "id": string, "type": "image",  "cssVar": string,   "label": string, "value": string }
  ]
}

═══════════════════════════════════════════════════════════════════════════
LAYOUT ARCHETYPES — CHOOSE ONE based on the brief. DO NOT always default to
"split hero with eyebrow + headline + subhead + cta on the left." Variety is
mandatory. Read the brief, pick the archetype that fits, commit fully.
═══════════════════════════════════════════════════════════════════════════

A. FULL-BLEED IMAGE — Photo background fills the canvas, text bottom-left or
   bottom-right with strong gradient scrim for legibility. Big condensed
   headline. Best for: lifestyle, fashion, travel, food, hospitality.

B. SPLIT 50/50 — Photo on one half, solid/gradient color block on the other
   with text. Asymmetric crop. Diagonal split also possible (clip-path).
   Best for: products, services, B2B SaaS.

C. EDITORIAL / MAGAZINE COVER — Centered hero image with text overlapping the
   image edge, oversized serif/display headline, small body, issue number or
   date strip. Best for: stories, features, premium positioning.

D. GRID COMPOSITION — Multiple image tiles arranged in a 2x2 or 3-column
   grid, with a headline panel taking one cell. Best for: portfolios,
   galleries, multi-product launches, "what's new" roundups.

E. GRADIENT MESH — No photo. Lush overlapping radial gradients (3+ colors,
   color-mix, blurred orbs). Glassmorphic foreground card with text. Best
   for: tech, fintech, AI, software products.

F. GEOMETRIC / SWISS — No photo. Bold geometric shapes (rotated rectangles,
   circles, lines), strong grid, helvetica-style typography, lots of white
   space. Best for: design tools, agencies, conferences.

G. TICKER / TYPOGRAPHIC — Headline IS the design — gigantic words filling the
   canvas, maybe repeated, maybe with stroke-only outlines, marquee feel.
   Optionally one small image inline. Best for: announcements, sales,
   bold statements.

H. STATS / DATA — Headline plus 2-4 large numeric stats in a row. Optional
   subtle background photo or gradient. Best for: results, milestones,
   "by the numbers."

Pick the archetype that genuinely fits the brief. When in doubt and the
brief is generic, pick whichever you used LEAST recently. NEVER default to
the same shape twice.

═══════════════════════════════════════════════════════════════════════════
BACKGROUND IMAGES — REQUIRED for archetypes A, B, C, D. RECOMMENDED for H.
═══════════════════════════════════════════════════════════════════════════

When using an image:
- ALWAYS include a real Unsplash URL using this EXACT pattern:
  https://images.unsplash.com/photo-{ID}?w=1600&q=80&auto=format&fit=crop
  Use real photo IDs from Unsplash that match the brief. Examples of real
  Unsplash IDs you can pull from: 1518770660439-4636190af475 (tech),
  1556761175-b413da4baf72 (business meeting), 1542435503-956c469947f6
  (food), 1502602898657-3e91760cbb34 (paris travel), 1517336714731-489689fd1ca8
  (laptop work), 1505740420928-5e560c06d30e (headphones), 1542291026-7eec264c27ff
  (red shoes), 1483985988355-763728e1935b (fashion), 1524758631624-e2822e304c36
  (modern office), 1620712943543-bcc4688e7485 (AI/abstract).
- Pick an Unsplash photo ID that genuinely matches the brief subject.
- Include the image as a field of type "image", id "bg_image", cssVar "--bg-image".
- ALWAYS include these companion image-control fields (so the user can adjust):
    { "id": "bg_brightness", "type": "range", "cssVar": "--bg-brightness", "label": "Image brightness", "value": 0.7, "min": 0.2, "max": 1.4, "step": 0.05, "unit": "" }
    { "id": "bg_blur",       "type": "range", "cssVar": "--bg-blur",       "label": "Image blur",       "value": 0,   "min": 0,   "max": 24,  "step": 1,    "unit": "px" }
    { "id": "bg_overlay",    "type": "range", "cssVar": "--bg-overlay",    "label": "Overlay opacity",  "value": 0.45, "min": 0,  "max": 1,   "step": 0.05, "unit": "" }
    { "id": "bg_zoom",       "type": "range", "cssVar": "--bg-zoom",       "label": "Image zoom",       "value": 110, "min": 100, "max": 200, "step": 5,    "unit": "%" }
    { "id": "bg_position",   "type": "select", "cssVar": "--bg-position",  "label": "Image position",   "value": "center center", "options": [{"value":"center center","label":"Center"},{"value":"center top","label":"Top"},{"value":"center bottom","label":"Bottom"},{"value":"left center","label":"Left"},{"value":"right center","label":"Right"}] }

- WIRE THEM UP in CSS like this:
    .banner__bg {
      background-image: var(--bg-image);
      background-size: var(--bg-zoom);
      background-position: var(--bg-position);
      filter: brightness(var(--bg-brightness)) blur(var(--bg-blur));
    }
    .banner__bg::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(180deg, transparent, rgba(0,0,0,calc(var(--bg-overlay) * 1)));
    }

═══════════════════════════════════════════════════════════════════════════
TEXT SLOT VARIETY — NOT EVERY BANNER NEEDS THE SAME 4 FIELDS
═══════════════════════════════════════════════════════════════════════════

REQUIRED on every banner: "headline" (text), "bg" (color), "fg" (color), "accent" (color).

OPTIONAL — pick what fits the archetype. Mix it up:
- "eyebrow" + "headline" + "subhead" + "cta"           → standard hero
- "headline" + "subhead" + "cta"                       → minimal
- "headline" + "stat1_value" + "stat1_label" + ...     → stats archetype
- "issue" + "headline" + "subhead"                     → editorial
- "headline" + "quote" + "author"                      → testimonial
- "label" + "headline" + "cta"                         → ticker
- "headline" + "subhead" + "cta_primary" + "cta_secondary" → dual-action

Always include "headline_size" range (--headline-size, px, 32–120).
Sometimes include "accent2" color for two-tone gradients.
Always include the image-control fields when using a photo (see above).

═══════════════════════════════════════════════════════════════════════════
TYPOGRAPHY & FORMATTING
═══════════════════════════════════════════════════════════════════════════

- Font: 'Geist', ui-sans-serif, system-ui, sans-serif. You can also propose
  serif via fallback: e.g. font-family: ui-serif, Georgia, serif for editorial.
- Use clamp() for responsive sizes.
- Headline: huge, tight letter-spacing (-0.02em to -0.04em), weight 600–800.
- Body: 14–18px, line-height 1.45–1.6, color slightly muted (color-mix with bg).
- CTA: real button styling with shadow, gradient or solid fill, generous padding.
- Use mix-blend-mode, backdrop-filter, color-mix(in oklab,…) freely.

═══════════════════════════════════════════════════════════════════════════
STRUCTURAL RULES
═══════════════════════════════════════════════════════════════════════════

- Root: <div class="banner" data-align="left|center|right">
- Wrap decorative layers in <div class="banner__bg">.
- Wrap content in <div class="banner__inner">.
- Editable text uses [data-slot="<id>"] where id matches a text field's id.
- Editable colors are CSS custom properties — define them in :root.
- Range fields drive numeric CSS values (use the unit).
- Select fields set CSS variables to one of their option values.
- Toggle fields hide/show an element via a CSS selector.
- Image fields set a CSS variable to a url() expression.

CSS RULES:
- * { box-sizing: border-box; }
- html, body { margin: 0; height: 100%; background: transparent; }
- .banner must fill its container: width: 100%; height: 100%; min-height: 320px; overflow: hidden; isolation: isolate; border-radius: 16px;
- DO NOT load external fonts or external scripts. External background images via https URLs are OK.

═══════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS — NEVER DO THESE
═══════════════════════════════════════════════════════════════════════════

- ❌ Generic centered "Eyebrow / Headline / Subhead / Get started" stack on
   plain dark gradient with two blurred orbs. This is the boring default.
- ❌ Same color-stop gradient mesh on every banner.
- ❌ Plain white text on plain black background with no decoration.
- ❌ Default left-aligned padding without thought to composition.
- ❌ Headline below 32px or above 120px.
- ❌ Boring placeholder copy. Write headlines that fit the brief subject.

OUTPUT — return ONLY the JSON object. No prose, no markdown fences, no explanation.`;

// Build a varied second-pass user message that nudges the model toward a
// SPECIFIC archetype, preventing convergence on archetype E (gradient mesh)
// which is what most LLMs default to.
function buildUserMessage({ prompt, style, aspect }) {
  // Hash-ish picker that varies per request based on time + prompt content.
  // Not deterministic-by-prompt-alone; we want variety even on identical briefs.
  const archetypes = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const seed       = (prompt.length * 7 + Date.now()) % archetypes.length;
  const suggestion = archetypes[seed];

  return `BRIEF: ${prompt}
VISUAL STYLE: ${style}
ASPECT RATIO: ${aspect}

For variety, STRONGLY CONSIDER archetype ${suggestion} unless the brief clearly demands a different one. Whatever archetype you pick, commit to it fully — don't blend archetypes into a generic hybrid.

If the archetype calls for a background image (A, B, C, D, or H with photo), pick a real Unsplash photo ID that matches the brief and include the full set of bg_image / bg_brightness / bg_blur / bg_overlay / bg_zoom / bg_position fields wired through CSS variables.

Write headlines that genuinely fit the brief — never use placeholder copy like "Your headline goes here."

Return ONLY the JSON object.`;
}

// ─────────────────────────────────────────────────────────────────────────
// FALLBACK — used when no model is configured / call fails.
// ─────────────────────────────────────────────────────────────────────────
const FALLBACK_TEMPLATE = {
  html: `<div class="banner" data-align="left">
  <div class="banner__bg">
    <div class="banner__orb banner__orb--a"></div>
    <div class="banner__orb banner__orb--b"></div>
    <div class="banner__grid"></div>
  </div>
  <div class="banner__inner">
    <span class="banner__eyebrow" data-slot="eyebrow">NEW</span>
    <h1 class="banner__headline" data-slot="headline">Your headline goes here</h1>
    <p class="banner__subhead" data-slot="subhead">Auto-generated from your prompt — edit any field to fine-tune.</p>
    <a class="banner__cta" data-slot="cta">Get started →</a>
  </div>
</div>`,
  css: `:root {
  --bg: #0c0c10;
  --fg: #ffffff;
  --muted: rgba(255,255,255,0.65);
  --accent: #a78bfa;
  --accent2: #22d3ee;
  --headline-size: 64px;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: transparent; }
body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }

.banner {
  position: relative; width: 100%; height: 100%; min-height: 320px;
  overflow: hidden; border-radius: 16px;
  background: var(--bg); color: var(--fg); isolation: isolate;
}
.banner__bg {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%),
    radial-gradient(50% 70% at 100% 100%, color-mix(in oklab, var(--accent2) 28%, transparent) 0%, transparent 60%),
    linear-gradient(135deg, color-mix(in oklab, var(--bg) 92%, var(--accent) 8%), var(--bg) 70%);
}
.banner__orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.6; }
.banner__orb--a { width: 50%; height: 70%; left: -10%; top: -20%; background: radial-gradient(circle, var(--accent), transparent 70%); }
.banner__orb--b { width: 40%; height: 60%; right: -10%; bottom: -20%; background: radial-gradient(circle, var(--accent2), transparent 70%); }
.banner__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(color-mix(in oklab, var(--fg) 6%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--fg) 6%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(80% 60% at 50% 50%, black, transparent);
}
.banner__inner {
  position: relative; z-index: 1; height: 100%;
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(24px, 6%, 64px); gap: 16px; max-width: 80%;
}
.banner[data-align="center"] .banner__inner { align-items: center; text-align: center; max-width: 100%; margin: 0 auto; }
.banner[data-align="right"] .banner__inner { align-items: flex-end; text-align: right; margin-left: auto; }
.banner__eyebrow {
  display: inline-block; font-size: 11px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent);
  border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent);
  padding: 5px 12px; border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 12%, transparent);
  backdrop-filter: blur(8px);
}
.banner__headline {
  font-size: clamp(32px, var(--headline-size, 64px), 96px);
  line-height: 1.04; letter-spacing: -0.025em; font-weight: 700; margin: 0;
  background: linear-gradient(135deg, var(--fg), color-mix(in oklab, var(--fg) 70%, var(--accent)));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.banner__subhead { margin: 0; font-size: clamp(14px, 1.4vw, 18px); color: var(--muted); max-width: 56ch; line-height: 1.5; }
.banner__cta {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, var(--accent2)));
  color: var(--bg); padding: 12px 22px; border-radius: 999px;
  font-size: 14px; font-weight: 700; width: fit-content;
  box-shadow: 0 8px 32px -8px color-mix(in oklab, var(--accent) 60%, transparent);
}`,
  alignment: "left",
  fields: [
    { id: "eyebrow",       type: "text",   slot: "eyebrow",       label: "Eyebrow",         value: "NEW" },
    { id: "headline",      type: "text",   slot: "headline",      label: "Headline",        value: "Launch day is here" },
    { id: "subhead",       type: "text",   slot: "subhead",       label: "Subhead",         value: "Auto-generated from your prompt — edit any field to fine-tune." },
    { id: "cta",           type: "text",   slot: "cta",           label: "CTA",             value: "Get started →" },
    { id: "bg",            type: "color",  cssVar: "--bg",        label: "Background",      value: "#0c0c10" },
    { id: "fg",            type: "color",  cssVar: "--fg",        label: "Text",            value: "#ffffff" },
    { id: "accent",        type: "color",  cssVar: "--accent",    label: "Accent",          value: "#a78bfa" },
    { id: "accent2",       type: "color",  cssVar: "--accent2",   label: "Accent 2",        value: "#22d3ee" },
    { id: "headline_size", type: "range",  cssVar: "--headline-size", label: "Headline size", value: 64, min: 32, max: 120, step: 2, unit: "px" },
    { id: "show_eyebrow",  type: "toggle", selector: ".banner__eyebrow", label: "Show eyebrow",    value: true },
    { id: "show_decor",    type: "toggle", selector: ".banner__bg",      label: "Show decoration", value: true },
  ],
};

function applyStyleRow(template, styleRow) {
  if (!styleRow) return template;
  const next = JSON.parse(JSON.stringify(template));
  for (const f of next.fields) {
    if (f.type === "color") {
      if (f.id === "bg")     f.value = styleRow.bg;
      if (f.id === "fg")     f.value = styleRow.fg;
      if (f.id === "accent") f.value = styleRow.accent;
    }
  }
  return next;
}

// If the model emitted a background image but forgot the companion control
// fields, inject sensible defaults so the user gets the full image control
// panel in the editor.
function ensureImageControls(template) {
  if (!template?.fields) return template;
  const fields    = template.fields;
  const hasImage  = fields.some((f) => f.type === "image" && f.id === "bg_image");
  if (!hasImage) return template;

  const has = (id) => fields.some((f) => f.id === id);
  const additions = [];

  if (!has("bg_brightness")) additions.push({
    id: "bg_brightness", type: "range", cssVar: "--bg-brightness",
    label: "Image brightness", value: 0.7, min: 0.2, max: 1.4, step: 0.05, unit: "",
  });
  if (!has("bg_blur")) additions.push({
    id: "bg_blur", type: "range", cssVar: "--bg-blur",
    label: "Image blur", value: 0, min: 0, max: 24, step: 1, unit: "px",
  });
  if (!has("bg_overlay")) additions.push({
    id: "bg_overlay", type: "range", cssVar: "--bg-overlay",
    label: "Overlay opacity", value: 0.45, min: 0, max: 1, step: 0.05, unit: "",
  });
  if (!has("bg_zoom")) additions.push({
    id: "bg_zoom", type: "range", cssVar: "--bg-zoom",
    label: "Image zoom", value: 110, min: 100, max: 200, step: 5, unit: "%",
  });
  if (!has("bg_position")) additions.push({
    id: "bg_position", type: "select", cssVar: "--bg-position",
    label: "Image position", value: "center center",
    options: [
      { value: "center center", label: "Center" },
      { value: "center top",    label: "Top" },
      { value: "center bottom", label: "Bottom" },
      { value: "left center",   label: "Left" },
      { value: "right center",  label: "Right" },
    ],
  });

  if (additions.length === 0) return template;
  return { ...template, fields: [...fields, ...additions] };
}

function validateTemplate(t) {
  if (!t || typeof t !== "object") return null;
  if (typeof t.html !== "string" || typeof t.css !== "string") return null;
  if (!Array.isArray(t.fields) || t.fields.length === 0) return null;
  if (!["left", "center", "right"].includes(t.alignment)) t.alignment = "left";

  const VALID_TYPES = new Set(["text", "color", "range", "select", "toggle", "image"]);
  t.fields = t.fields.filter(
    (f) => f && typeof f.id === "string" && VALID_TYPES.has(f.type),
  );

  const ids = new Set(t.fields.map((f) => f.id));
  // Only "headline" + the three core colors are mandatory now — the model
  // is free to compose richer text-slot mixes (stats, quotes, etc).
  for (const required of ["headline", "bg", "fg", "accent"]) {
    if (!ids.has(required)) return null;
  }
  return t;
}

export function deriveTitle(prompt) {
  const t = (prompt || "").trim().split(/\s+/).slice(0, 8).join(" ");
  return t.length > 60 ? t.slice(0, 60) + "…" : t || "Untitled banner";
}

export function bgFromTemplate(template) {
  const f = (template?.fields || []).find((x) => x.id === "bg");
  return f?.value || "#0c0c10";
}

// ─────────────────────────────────────────────────────────────────────────
// Pull the API key and endpoint from model.config — admin-managed.
// ─────────────────────────────────────────────────────────────────────────
function pickApiKey(model) {
  const c = model?.config || {};
  return c.apiKey || c.api_key || c.openrouterApiKey || c.openrouter_api_key || null;
}
function pickEndpoint(model) {
  const c = model?.config || {};
  return c.endpoint || c.baseUrl || c.url || null;
}

// Generates a banner template — calls the configured model when an API key is
// set, otherwise returns the styled fallback. Always returns a valid template.
export async function generateBannerTemplate({
  supabase,
  prompt,
  style = "Modern",
  aspect = "16:9",
}) {
  const styleRow = await getStyleByName(supabase, style);
  const styled   = applyStyleRow(FALLBACK_TEMPLATE, styleRow);

  const textModel = await getDefaultTextModel(supabase);
  if (!textModel) {
    return {
      ...styled,
      generator: "fallback",
      reason: "No default text model is configured. Add one in Admin → Models.",
      styleRow,
    };
  }

  const apiKey = pickApiKey(textModel);
  if (!apiKey) {
    return {
      ...styled,
      generator: "fallback",
      reason: `Model "${textModel.label}" has no API key. Set it in Admin → Models.`,
      styleRow,
    };
  }

  if (textModel.provider !== "openrouter" && !pickEndpoint(textModel)) {
    return {
      ...styled,
      generator: "fallback",
      reason: `Provider "${textModel.provider}" needs a custom endpoint. Set config.endpoint in Admin → Models, or use OpenRouter.`,
      styleRow,
    };
  }

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    pickEndpoint(textModel) || undefined,
      model:       textModel.modelId,
      jsonMode:    true,
      // Higher temperature → more variation across runs. The system prompt
      // pins the structure tightly enough that this won't break things.
      temperature: textModel.config?.temperature ?? 0.95,
      maxTokens:   textModel.config?.maxTokens   ?? 8000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserMessage({ prompt, style, aspect }) },
      ],
    });

    const parsed     = extractJson(content);
    const validated  = validateTemplate(parsed);
    if (!validated) {
      return {
        ...styled,
        generator: "fallback",
        reason: "Model output failed validation. Try again or pick a different model.",
        styleRow,
      };
    }
    // Backfill image-control fields if model forgot any.
    const enriched = ensureImageControls(validated);

    return {
      ...enriched,
      generator: textModel.label,
      modelId:   textModel.modelId,
      styleRow,
    };
  } catch (e) {
    return {
      ...styled,
      generator: "fallback",
      reason: e?.message || "Model request failed",
      styleRow,
    };
  }
}