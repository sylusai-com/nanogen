// src/lib/bannerTemplate.js
// Shared HTML banner template generator — used by /api/banners (persists a
// banner in one shot) and /api/banners/html (returns the template for the
// editor).
//
// Flow:
//   1. Pull the admin-configured default text model from the `models` table.
//   2. Read API key + endpoint from the model's `config` blob.
//   3. Pull the requested style row from `banner_styles` for color seeding.
//   4. Ask the model for a strict JSON banner template — now allowing rich
//      backgrounds (gradients, hero images), decorative shapes, and richer
//      typographic compositions.
//   5. Validate; fall back to a built-in template (with style colors applied)
//      on any failure.

import { getDefaultTextModel } from "@/lib/db/models";
import { getStyleByName } from "@/lib/db/styles";
import { callOpenRouter, extractJson } from "@/lib/openrouter";

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — significantly richer than v1. Allows:
//  - gradient or hero-image backgrounds
//  - decorative shapes (circles, blobs, blurred orbs)
//  - separate font controls for headline vs body
//  - background image as an editable field (image type)
//  - "icon"/"badge"-style accents via inline SVG
// ─────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior brand designer at Nanogen, generating production-quality marketing banners.

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

DESIGN RULES — produce designs that look like they belong on a modern marketing site:
- Use ONE strong layout idea per banner. Avoid generic centered hero stacks unless the prompt explicitly asks for that.
- Backgrounds MUST be visually rich. Choose ONE approach per banner:
   (a) Gradient mesh — overlapping radial gradients with color-mix.
   (b) Hero image — a background image on .banner__bg with overlay gradient for legibility. Provide an "image" field "bg_image" whose cssVar is "--bg-image" and value is "url('https://images.unsplash.com/...')". Apply it via background-image: var(--bg-image).
   (c) Geometric — large rotated shapes, blurred orbs, grid lines, dotted patterns via radial-gradient.
- Always layer at least one decorative element behind the text (a blurred orb, a rotated shape, a grain overlay using SVG noise data-uri).
- Typography MUST have hierarchy: large headline (clamp() for responsiveness), smaller subhead, optional eyebrow tag.
- Text must remain legible — when using image backgrounds, add a dark gradient overlay or text-shadow.
- Use generous color: don't default to plain white text on plain dark bg. Mix accents into shadows, borders, gradients.
- The CTA should look like a real button: clear hierarchy, hover-ready, not just text.

STRUCTURAL RULES:
- Root: <div class="banner" data-align="left|center|right">
- Inside: <div class="banner__bg"> for decorative layers, <div class="banner__inner"> for content.
- Editable text uses [data-slot="<id>"]. The slot value MUST match the field id.
- Editable colors use CSS custom properties — define them in :root inside css.
- Range fields drive numeric CSS values via cssVar (include unit in the field).
- Toggle fields hide/show an element matched by selector. The editor sets display:none when value is false.
- Image fields set a CSS variable to a CSS url() expression.

REQUIRED FIELDS — always include these:
- text fields: "eyebrow", "headline", "subhead", "cta"
- color fields: "bg" (--bg), "fg" (--fg), "accent" (--accent)
- One range: "headline_size" (--headline-size, px), reasonable range like 32–96.

OPTIONAL FIELDS — add when they fit the design:
- image field "bg_image" (--bg-image) when using a hero-image background.
- color field "accent2" (--accent2) for two-tone gradients.
- toggle "show_eyebrow" hiding ".banner__eyebrow".
- toggle "show_decor" hiding ".banner__decor".

CSS RULES:
- Set html, body { margin: 0; height: 100%; background: transparent; } and * { box-sizing: border-box; }.
- Font: 'Geist', ui-sans-serif, system-ui, sans-serif. You may use weights 300, 400, 500, 600, 700, 800.
- .banner must fill its container: width: 100%; height: 100%; min-height: 320px.
- Use modern CSS: clamp(), color-mix(in oklab, ...), backdrop-filter, mix-blend-mode where appropriate.
- DO NOT load external fonts or external scripts. External background images via https URLs are OK.
- When using inline SVG noise/patterns, embed them as data: URLs in CSS.

OUTPUT: return ONLY the JSON object. No prose, no markdown fences, no explanation.`;

// ─────────────────────────────────────────────────────────────────────────
// FALLBACK — used when no model is configured / call fails. Designed to look
// reasonably good on its own, with gradient bg + decorative orbs + grid.
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
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
  border-radius: 16px;
  background: var(--bg);
  color: var(--fg);
  isolation: isolate;
}

.banner__bg {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%),
    radial-gradient(50% 70% at 100% 100%, color-mix(in oklab, var(--accent2) 28%, transparent) 0%, transparent 60%),
    linear-gradient(135deg, color-mix(in oklab, var(--bg) 92%, var(--accent) 8%), var(--bg) 70%);
}
.banner__orb {
  position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.6;
}
.banner__orb--a {
  width: 50%; height: 70%; left: -10%; top: -20%;
  background: radial-gradient(circle, var(--accent), transparent 70%);
}
.banner__orb--b {
  width: 40%; height: 60%; right: -10%; bottom: -20%;
  background: radial-gradient(circle, var(--accent2), transparent 70%);
}
.banner__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(color-mix(in oklab, var(--fg) 6%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--fg) 6%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(80% 60% at 50% 50%, black, transparent);
}

.banner__inner {
  position: relative; z-index: 1;
  height: 100%;
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(24px, 6%, 64px);
  gap: 16px;
  max-width: 80%;
}
.banner[data-align="center"] .banner__inner {
  align-items: center; text-align: center; max-width: 100%; margin: 0 auto;
}
.banner[data-align="right"] .banner__inner {
  align-items: flex-end; text-align: right; margin-left: auto;
}

.banner__eyebrow {
  display: inline-block;
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--accent);
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
.banner__subhead {
  margin: 0;
  font-size: clamp(14px, 1.4vw, 18px);
  color: var(--muted);
  max-width: 56ch;
  line-height: 1.5;
}
.banner__cta {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, var(--accent2)));
  color: var(--bg);
  padding: 12px 22px; border-radius: 999px;
  font-size: 14px; font-weight: 700;
  width: fit-content;
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
    { id: "headline_size", type: "range",  cssVar: "--headline-size", label: "Headline size", value: 64, min: 32, max: 96, step: 2, unit: "px" },
    { id: "show_eyebrow",  type: "toggle", selector: ".banner__eyebrow", label: "Show eyebrow",    value: true },
    { id: "show_decor",    type: "toggle", selector: ".banner__bg",      label: "Show decoration", value: true },
  ],
};

function applyStyleRow(template, styleRow) {
  if (!styleRow) return template;
  const next = JSON.parse(JSON.stringify(template));
  for (const f of next.fields) {
    if (f.type === "color") {
      if (f.id === "bg") f.value = styleRow.bg;
      if (f.id === "fg") f.value = styleRow.fg;
      if (f.id === "accent") f.value = styleRow.accent;
    }
  }
  return next;
}

function validateTemplate(t) {
  if (!t || typeof t !== "object") return null;
  if (typeof t.html !== "string" || typeof t.css !== "string") return null;
  if (!Array.isArray(t.fields) || t.fields.length === 0) return null;
  if (!["left", "center", "right"].includes(t.alignment)) t.alignment = "left";
  // Drop any field with an unknown type rather than failing the whole template.
  const VALID_TYPES = new Set(["text", "color", "range", "select", "toggle", "image"]);
  t.fields = t.fields.filter(
    (f) => f && typeof f.id === "string" && VALID_TYPES.has(f.type),
  );
  const ids = new Set(t.fields.map((f) => f.id));
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
  return (
    c.apiKey ||
    c.api_key ||
    c.openrouterApiKey ||
    c.openrouter_api_key ||
    null
  );
}

function pickEndpoint(model) {
  const c = model?.config || {};
  return c.endpoint || c.baseUrl || c.url || null;
}

// Generates a banner template — calls the configured model when an API key is
// set, otherwise returns the styled fallback. Always returns a valid template.
//
// Returns: { html, css, alignment, fields, generator, modelId?, reason?, styleRow? }
export async function generateBannerTemplate({
  supabase,
  prompt,
  style = "Modern",
  aspect = "16:9",
}) {
  // Pull style row from DB so the colors come from admin-managed catalog.
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

  // Currently only OpenRouter (or any OpenAI-compatible chat completions
  // endpoint configured via model.config.endpoint) is wired up.
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
      temperature: textModel.config?.temperature ?? 0.8,
      maxTokens:   textModel.config?.maxTokens   ?? 6000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Brief: ${prompt}\nVisual style: ${style}\nAspect ratio: ${aspect}\n\nDesign a striking, on-brief banner. Pick a strong layout idea and execute it with care. Return ONLY the JSON object.`,
        },
      ],
    });

    const parsed = extractJson(content);
    const valid  = validateTemplate(parsed);
    if (!valid) {
      return {
        ...styled,
        generator: "fallback",
        reason: "Model output failed validation. Try again or pick a different model.",
        styleRow,
      };
    }

    return {
      ...valid,
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