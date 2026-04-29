// src/lib/bannerTemplate.js
// Shared HTML banner template generator — used by /api/banners (persists a
// banner in one shot) and /api/banners/html (returns the template for the
// editor).
//
// v4 — overhauled to produce dramatically richer, more modern banners.
//   1. Mandates a high density of distinct visual elements per banner (10+).
//   2. Catalog of decorative & functional components the model should mix.
//   3. CSS techniques required: animations, glassmorphism, noise, gradients
//      with color-mix(), masks, blend modes.
//   4. Provider/key/endpoint resolution is fully driven by the admin row —
//      any OpenAI-compatible provider works (OpenRouter is just one of them).

import { getDefaultTextModel } from "@/lib/db/models";
import { getStyleByName } from "@/lib/db/styles";
import { callOpenRouter, extractJson } from "@/lib/openrouter";
import {
  accentFor,
  adjustForContrast,
  contrastRatio,
  readableForegroundFor,
} from "@/lib/color";

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior brand designer who has shipped award-winning campaigns for Apple, Stripe, Linear, Vercel, Figma, and Arc. You generate production-grade, FLAGSHIP-quality marketing banners as JSON. Every banner you make looks like it could ship on the homepage of a top-tier product company. Lazy or generic output is unacceptable.

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
COLOR THEORY — INSTANT REJECTION RULES
═══════════════════════════════════════════════════════════════════════════

Color contrast failures are the most common reason banners ship broken. You
MUST enforce these rules:

1. **Background vs foreground contrast**: The "fg" text color MUST have a
   WCAG contrast ratio of AT LEAST 4.5:1 against the "bg" color. As a
   simple rule: if "bg" is dark (luminance < 0.5), "fg" MUST be a light
   color (≥ #e5e5ea). If "bg" is light (luminance ≥ 0.5), "fg" MUST be
   a dark color (≤ #1a1a22).

   GOOD pairs (use these patterns):
     bg #0a0a0f + fg #ffffff          ← dark theme
     bg #0c1226 + fg #f8fafc          ← deep navy + warm white
     bg #faf7f2 + fg #1a1a22          ← warm cream + near-black
     bg #f4f1ec + fg #14213d          ← editorial cream + deep navy
     bg #fff5e1 + fg #2b0a3d          ← soft peach + plum

   BAD pairs (NEVER do this):
     bg #0a0a0f + fg #1a1a22          ← dark on dark — invisible!
     bg #ffffff + fg #f5f5f5          ← light on light
     bg #1a1a22 + fg #2a2a3f          ← muddy and unreadable

2. **Accent colors**: The "accent" and "accent2" / "accent3" colors are
   used for borders, eyebrow pills, button gradients, dot markers, headline
   gradient stops. They MUST contrast the bg by at least 3.0:1. Pick
   saturated, non-muddy hues — violets, cyans, fuchsias, ambers, emeralds.

3. **Text gradients on the headline**: When you use background-clip: text
   for a gradient headline, BOTH gradient stops must be light enough to
   read on dark bg, OR dark enough to read on light bg. NEVER pair a
   bright accent with a dark fg-derived stop on a dark bg — it disappears.

4. **Subhead / muted color**: Define --muted as a color-mix(in oklab, var(--fg) 65%, transparent) (or similar) so muted text is the same family as fg, just lower opacity. NEVER hardcode --muted as gray on a dark bg without checking.

5. **Cohesive palette**: bg, fg, accent, accent2, accent3 should feel like
   one designed palette — not random colors. Pick a vibe (cyber-violet,
   editorial cream, sunset peach, fintech midnight, organic green) and
   stick to it.

═══════════════════════════════════════════════════════════════════════════
MANDATORY RICHNESS — these are non-negotiable
═══════════════════════════════════════════════════════════════════════════

A. **Component density**: Every banner MUST contain at least 10 distinct visual elements. A "headline + subhead + button + two blurry orbs" banner is REJECTED. Combine layered backgrounds, decorative shapes, content components, and microcopy.

B. **CSS sophistication**: Use AT LEAST 6 of these techniques on every banner:
   - linear-gradient + radial-gradient combinations
   - color-mix(in oklab, ...) for harmonious tints
   - backdrop-filter: blur(...) saturate(...) for glassmorphism
   - mix-blend-mode (overlay, screen, difference)
   - mask-image / -webkit-mask-image (radial or linear masks for soft edges)
   - clip-path (polygon, circle) for geometric shapes
   - filter: drop-shadow / blur / hue-rotate
   - @keyframes animations (subtle: 6–20s loops — float, drift, shimmer, pulse, rotate)
   - transform: rotate / skew / scale / perspective for depth
   - Inline SVG patterns (grids, dots, noise, waves, isometric)
   - text-shadow / box-shadow with multiple layers
   - CSS gradients on text (background-clip: text)
   - Conic gradients (conic-gradient(...))
   - Custom outlined ::before / ::after pseudo-elements

C. **Required ANIMATION**: Always include at least one subtle CSS animation (gradient drift, orb float, pulse, marquee, shimmer). Animations are slow (8s+), low-amplitude, never distracting.

D. **Required DECORATIVE LAYERS**: Include 2+ decorative layers stacked behind content:
   - Layer 1: Base gradient or photo
   - Layer 2: Texture (SVG noise, grid, dots, scan lines)
   - Layer 3: Hero accent (orbs, gradient mesh, geometric shapes)
   - Layer 4 (optional): Foreground glass card or vignette overlay

═══════════════════════════════════════════════════════════════════════════
LAYOUT ARCHETYPES — CHOOSE ONE based on the brief
═══════════════════════════════════════════════════════════════════════════

A. FULL-BLEED IMAGE — Photo background fills the canvas, text bottom-left or
   bottom-right with strong gradient scrim for legibility. Big condensed
   headline. Add: floating badge pills, decorative corner brackets, scan-line
   overlay, animated shimmer on the headline.

B. SPLIT 50/50 — Photo on one half, solid/gradient color block on the other
   with text. Asymmetric crop, optional diagonal split via clip-path. Add:
   eyebrow tag, dual CTA, supporting metric row, vertical date/issue strip
   on the photo edge.

C. EDITORIAL / MAGAZINE COVER — Centered hero image with text overlapping the
   image edge, oversized serif/display headline, small body, issue number or
   date strip, byline, page-number footer, a quote pulled out, decorative
   horizontal rules.

D. GRID COMPOSITION — Multiple image tiles arranged in a 2x2 or 3-column
   grid with a headline panel taking one cell. Add: small label chips on
   each tile, hover-style ring decoration, footer with category list.

E. GRADIENT MESH — No photo. Lush overlapping radial gradients (4+ colors,
   color-mix, blurred orbs animated with float keyframes). Add: glassmorphic
   foreground card with eyebrow + headline + subhead + dual CTAs, an inline
   feature row (3 icon+label items), trust badges row underneath, animated
   gradient border on the card.

F. GEOMETRIC / SWISS — No photo. Bold geometric shapes (rotated rectangles,
   circles, lines via SVG), strong grid, helvetica-style typography, lots of
   white space. Add: small numbered markers (01 / 02 / 03), a thin horizontal
   rule under the headline, corner registration marks, version/edition tag.

G. TICKER / TYPOGRAPHIC — Headline IS the design — gigantic words filling the
   canvas (use a stroke-only outline duplicate behind the filled headline),
   marquee strip below or above with repeating microcopy, optional one small
   inline image. Add: blinking cursor character, keyboard-shortcut chip,
   release date footer.

H. STATS / DATA — Headline plus 3-4 large numeric stats in a row. Each stat
   is a small card with: big number (with gradient), label, delta indicator
   (▲ green / ▼ red), tiny sparkline SVG. Subtle background photo or gradient.
   Add: legend at bottom, time-range chip, source attribution microcopy.

When the brief is generic, pick whichever archetype you used LEAST. NEVER
default to the same shape twice. NEVER blend archetypes into a generic hybrid.

═══════════════════════════════════════════════════════════════════════════
COMPONENT CATALOG — mix at least 5 of these into every banner
═══════════════════════════════════════════════════════════════════════════

TEXT COMPONENTS:
- Eyebrow pill with leading dot or icon
- Multi-line gradient headline (background-clip: text)
- Subhead paragraph (max 56ch, muted)
- Inline status badge ("v2.0", "BETA", "LIVE", "NEW")
- Inline keyboard shortcut chip (kbd-style)
- Quote / pullquote with author
- Stat block (number + label + delta)
- Feature row (3-4 icon+label items)
- Numbered list (01 / 02 / 03 markers)
- Date / issue / edition strip
- Trust line ("Loved by 10,000+ teams") with tiny avatar stack
- Marquee ticker strip (animated translateX)
- Two-CTA row (primary filled, secondary ghost) with arrow icons

DECORATIVE COMPONENTS:
- Floating orb (blurred radial gradient with float animation)
- SVG grid pattern overlay (opacity 0.06–0.12)
- SVG dot pattern overlay
- SVG noise texture (turbulence + feColorMatrix)
- Scan-line overlay (repeating linear gradient)
- Conic-gradient ring or halo
- Animated gradient border (mask + conic-gradient)
- Corner registration marks (┌  ┐  └  ┘ via pseudo elements)
- Geometric primitive (square, triangle, line) rotated and offset
- Diagonal stripe panel (clip-path polygon)
- Glassmorphic card (backdrop-filter blur + saturate)
- Highlight underline / brush stroke (SVG path)
- Glow ring around CTA on hover
- Spotlight gradient (radial centered on focal point)

DATA / MICRO COMPONENTS:
- Tiny sparkline SVG (30x10)
- Avatar stack (3 overlapping circles)
- Logo wall row (placeholder boxes)
- Progress bar (filled portion)
- Compass / arrow indicator
- Live dot (pulsing green circle)

═══════════════════════════════════════════════════════════════════════════
BACKGROUND IMAGES — REQUIRED for archetypes A, B, C, D. RECOMMENDED for H.
═══════════════════════════════════════════════════════════════════════════

When using an image:
- ALWAYS include a real Unsplash URL using this EXACT pattern:
  https://images.unsplash.com/photo-{ID}?w=1600&q=80&auto=format&fit=crop
  Use real photo IDs that match the brief. Curated examples:
  Tech / abstract:     1518770660439-4636190af475, 1620712943543-bcc4688e7485, 1517336714731-489689fd1ca8
  Business / office:   1556761175-b413da4baf72, 1524758631624-e2822e304c36, 1542744173-8e7e53415bb0
  Food / kitchen:      1542435503-956c469947f6, 1565299624946-b28f40a0ae38, 1559054663-e8d23213f55c
  Travel / city:       1502602898657-3e91760cbb34, 1488646953014-85cb44e25828, 1493246507139-91e8fad9978e
  Lifestyle / fashion: 1483985988355-763728e1935b, 1515886657613-9f3515b0c78f, 1542291026-7eec264c27ff
  Nature:              1506905925346-21bda4d32df4, 1441974231531-c6227db76b6e, 1470071459604-3b5ec3a7fe05
  Sport / fitness:     1518611012118-696072aa579a, 1571019613454-1cb2f99b2d8b
  Music / events:      1493225457124-a3eb161ffa5f, 1459749411175-04bf5292ceea
- Pick a photo ID that genuinely matches the brief subject.
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

═══════════════════════════════════════════════════════════════════════════
TEXT FIELDS — adapt to the archetype
═══════════════════════════════════════════════════════════════════════════

REQUIRED on every banner: "headline" (text), "bg" (color), "fg" (color), "accent" (color).

STRONGLY RECOMMENDED — pick at least 4 more depending on archetype:
- "eyebrow", "subhead", "cta_primary", "cta_secondary"
- "stat1_value" + "stat1_label" + "stat2_value" + "stat2_label" + ...
- "issue", "edition", "byline", "date"
- "quote", "author"
- "label", "version_tag"
- "feature1_title" + "feature1_desc" + ...
- "trust_line", "logo_caption"
- "marquee_text"

Always include "headline_size" range (--headline-size, px, 32–120).
Always include "accent2" color for two-tone gradients.
Sometimes include "accent3" color for tri-stop effects.
Always include the image-control fields when using a photo.
Always include "show_decor" toggle to hide the decorative layer if desired.

═══════════════════════════════════════════════════════════════════════════
TYPOGRAPHY & FORMATTING
═══════════════════════════════════════════════════════════════════════════

- Font: 'Geist', ui-sans-serif, system-ui, sans-serif. Use serif (ui-serif, Georgia, serif) for editorial/magazine archetype.
- Use clamp() for responsive sizes.
- Headline: huge, tight letter-spacing (-0.02em to -0.04em), weight 600–800, optional gradient text.
- Body: 14–18px, line-height 1.45–1.6, color slightly muted (color-mix with bg).
- Eyebrow: 11px uppercase 600 letter-spacing 0.18em.
- CTAs: real button styling — primary uses gradient/solid fill with shadow, secondary uses ghost (border + transparent). Both have generous padding (12px 22px+), arrow icon (→), border-radius 999px or 12px.
- Use mix-blend-mode, backdrop-filter, color-mix(in oklab,…) freely.

═══════════════════════════════════════════════════════════════════════════
STRUCTURAL RULES
═══════════════════════════════════════════════════════════════════════════

- Root: <div class="banner" data-align="left|center|right">
- Wrap decorative layers in <div class="banner__bg"> (each as its own child).
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
- DO NOT load external fonts or external scripts. External background images via https URLs are OK. Inline SVG (data: URLs OK) is encouraged.

═══════════════════════════════════════════════════════════════════════════
ANTI-PATTERNS — INSTANT REJECTION
═══════════════════════════════════════════════════════════════════════════

❌ Background and foreground colors with low contrast (anything below 4.5:1).
❌ Dark text on dark background. Light text on light background. EVER.
❌ Headline text-color set to the same value as bg (so it disappears).
❌ Generic centered "Eyebrow / Headline / Subhead / Get started" stack on plain dark gradient with two blurred orbs.
❌ Plain HTML with only 3-4 elements ("Register Now"-style brochure layouts).
❌ Same color-stop gradient mesh on every banner.
❌ Plain white text on plain black background with no decoration.
❌ Headline below 32px or above 120px.
❌ Boring placeholder copy. Write headlines that fit the brief subject.
❌ Fewer than 10 distinct visual elements. If your HTML has only 5 children, redo it.
❌ No animation. Every banner needs at least one subtle keyframe loop.
❌ Skipping the SVG noise/grid/dot decorative layer.
❌ HTML output that is mostly plain text (e.g. "Register now") with no styling structure. This is NOT a banner — it's a sign. REJECTED.

OUTPUT — return ONLY the JSON object. No prose, no markdown fences, no explanation. The HTML and CSS strings inside the JSON should be valid, complete, and self-contained. The HTML must contain at LEAST 12 elements (count opening tags). The CSS must be at LEAST 1500 characters. If your output is shorter than that, you haven't done the job.`;

// Build a varied second-pass user message that nudges the model toward a
// SPECIFIC archetype, preventing convergence on archetype E (gradient mesh)
// which is what most LLMs default to.
function buildUserMessage({ prompt, style, aspect, variantSeed = 0 }) {
  const archetypes = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const seed       = (prompt.length * 7 + Date.now() + variantSeed * 31) % archetypes.length;
  const suggestion = archetypes[seed];

  return `BRIEF: ${prompt}
VISUAL STYLE: ${style}
ASPECT RATIO: ${aspect}

For variety, STRONGLY CONSIDER archetype ${suggestion} unless the brief clearly demands a different one. Whatever archetype you pick, commit to it fully — don't blend archetypes into a generic hybrid.

Remember the MANDATORY RICHNESS rules:
  • 10+ distinct visual elements
  • 6+ CSS techniques (gradients, color-mix, backdrop-filter, mask, blend, clip-path, animation, etc.)
  • At least one subtle keyframe animation (8s+ loop)
  • 2+ stacked decorative layers (gradient + texture + hero accent)
  • 5+ components from the COMPONENT CATALOG
  • Working bg_image + bg_brightness/blur/overlay/zoom/position controls when using a photo

Write headlines and copy that genuinely fit the brief — never use placeholder text like "Your headline goes here." If you need a number, invent a plausible one. If you need an author, use a believable name. If you need a feature label, write three concrete features that fit the brief.

Return ONLY the JSON object.`;
}

// ─────────────────────────────────────────────────────────────────────────
// FALLBACK — used when no model is configured / call fails. Richer than
// the previous fallback so even the no-model case looks decent.
// ─────────────────────────────────────────────────────────────────────────
const FALLBACK_TEMPLATE = {
  html: `<div class="banner" data-align="left">
  <div class="banner__bg">
    <div class="banner__mesh"></div>
    <div class="banner__grid"></div>
    <div class="banner__noise"></div>
    <div class="banner__orb banner__orb--a"></div>
    <div class="banner__orb banner__orb--b"></div>
    <div class="banner__orb banner__orb--c"></div>
  </div>
  <div class="banner__inner">
    <div class="banner__top">
      <span class="banner__eyebrow" data-slot="eyebrow"><span class="banner__dot"></span>NEW · v2.0</span>
      <span class="banner__version" data-slot="version_tag">2026</span>
    </div>
    <h1 class="banner__headline" data-slot="headline">Your headline goes here</h1>
    <p class="banner__subhead" data-slot="subhead">Auto-generated from your prompt — edit any field to fine-tune the design, copy, and color palette.</p>
    <div class="banner__features">
      <div class="banner__feature"><span class="banner__feat-num">01</span><span data-slot="feature1">Modern composition</span></div>
      <div class="banner__feature"><span class="banner__feat-num">02</span><span data-slot="feature2">Editable fields</span></div>
      <div class="banner__feature"><span class="banner__feat-num">03</span><span data-slot="feature3">Live preview</span></div>
    </div>
    <div class="banner__ctas">
      <a class="banner__cta banner__cta--primary" data-slot="cta_primary">Get started <span aria-hidden="true">→</span></a>
      <a class="banner__cta banner__cta--secondary" data-slot="cta_secondary">Learn more</a>
    </div>
    <div class="banner__trust"><span class="banner__avatars"><span></span><span></span><span></span></span><span data-slot="trust_line">Trusted by 10,000+ teams worldwide</span></div>
  </div>
  <div class="banner__corner banner__corner--tl"></div>
  <div class="banner__corner banner__corner--br"></div>
</div>`,
  css: `:root {
  --bg: #0a0a0f;
  --fg: #ffffff;
  --muted: rgba(255,255,255,0.65);
  --accent: #a78bfa;
  --accent2: #22d3ee;
  --accent3: #f472b6;
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
.banner__bg { position: absolute; inset: 0; z-index: 0; }
.banner__mesh {
  position: absolute; inset: 0;
  background:
    radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%),
    radial-gradient(50% 70% at 100% 100%, color-mix(in oklab, var(--accent2) 28%, transparent) 0%, transparent 60%),
    radial-gradient(40% 60% at 80% 0%, color-mix(in oklab, var(--accent3) 22%, transparent) 0%, transparent 60%),
    linear-gradient(135deg, color-mix(in oklab, var(--bg) 92%, var(--accent) 8%), var(--bg) 70%);
  animation: meshDrift 20s ease-in-out infinite alternate;
}
@keyframes meshDrift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(-2%, 1%, 0) scale(1.05); } }

.banner__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(color-mix(in oklab, var(--fg) 7%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--fg) 7%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(70% 50% at 50% 50%, black, transparent);
  opacity: 0.7;
}
.banner__noise {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.18;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>");
}
.banner__orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.55; }
.banner__orb--a { width: 50%; height: 70%; left: -10%; top: -20%; background: radial-gradient(circle, var(--accent), transparent 70%); animation: orbFloat 16s ease-in-out infinite alternate; }
.banner__orb--b { width: 40%; height: 60%; right: -10%; bottom: -20%; background: radial-gradient(circle, var(--accent2), transparent 70%); animation: orbFloat 22s ease-in-out infinite alternate-reverse; }
.banner__orb--c { width: 28%; height: 40%; right: 30%; top: 10%; background: radial-gradient(circle, var(--accent3), transparent 70%); animation: orbFloat 18s ease-in-out infinite alternate; opacity: 0.4; }
@keyframes orbFloat { from { transform: translate(0,0); } to { transform: translate(3%, -2%); } }

.banner__corner { position: absolute; width: 28px; height: 28px; opacity: 0.45; pointer-events: none; }
.banner__corner--tl { top: 16px; left: 16px; border-top: 1px solid var(--fg); border-left: 1px solid var(--fg); }
.banner__corner--br { bottom: 16px; right: 16px; border-bottom: 1px solid var(--fg); border-right: 1px solid var(--fg); }

.banner__inner {
  position: relative; z-index: 1; height: 100%;
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(24px, 6%, 64px); gap: 14px; max-width: 80%;
}
.banner[data-align="center"] .banner__inner { align-items: center; text-align: center; max-width: 100%; margin: 0 auto; }
.banner[data-align="right"] .banner__inner { align-items: flex-end; text-align: right; margin-left: auto; }

.banner__top { display: flex; align-items: center; gap: 10px; }
.banner__eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--accent);
  border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent);
  padding: 5px 12px; border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 12%, transparent);
  backdrop-filter: blur(8px);
}
.banner__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
.banner__version {
  font-size: 10px; font-family: ui-monospace, monospace; color: var(--muted);
  border: 1px solid color-mix(in oklab, var(--fg) 16%, transparent);
  padding: 3px 8px; border-radius: 6px;
}

.banner__headline {
  font-size: clamp(32px, var(--headline-size, 64px), 96px);
  line-height: 1.04; letter-spacing: -0.025em; font-weight: 700; margin: 0;
  background: linear-gradient(135deg, var(--fg), color-mix(in oklab, var(--fg) 70%, var(--accent)) 60%, color-mix(in oklab, var(--fg) 50%, var(--accent3)));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.banner__subhead { margin: 0; font-size: clamp(14px, 1.4vw, 18px); color: var(--muted); max-width: 56ch; line-height: 1.5; }

.banner__features {
  display: flex; gap: 18px; flex-wrap: wrap; margin-top: 4px;
  font-size: 12px; color: color-mix(in oklab, var(--fg) 78%, transparent);
}
.banner__feature { display: inline-flex; align-items: center; gap: 8px; }
.banner__feat-num {
  font-family: ui-monospace, monospace; font-size: 10px;
  background: color-mix(in oklab, var(--accent) 18%, transparent);
  color: var(--accent);
  padding: 3px 6px; border-radius: 4px;
}

.banner__ctas { display: inline-flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.banner__cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 12px 22px; border-radius: 999px;
  font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.banner__cta--primary {
  background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, var(--accent2)));
  color: var(--bg);
  box-shadow: 0 8px 32px -8px color-mix(in oklab, var(--accent) 60%, transparent);
}
.banner__cta--secondary {
  background: color-mix(in oklab, var(--fg) 8%, transparent);
  color: var(--fg);
  border: 1px solid color-mix(in oklab, var(--fg) 18%, transparent);
  backdrop-filter: blur(8px);
}
.banner__cta:hover { transform: translateY(-1px); }

.banner__trust { display: inline-flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 11px; color: var(--muted); }
.banner__avatars { display: inline-flex; }
.banner__avatars span {
  width: 18px; height: 18px; border-radius: 50%; display: inline-block;
  border: 2px solid var(--bg); margin-left: -6px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
}
.banner__avatars span:first-child { margin-left: 0; }
.banner__avatars span:nth-child(2) { background: linear-gradient(135deg, var(--accent2), var(--accent3)); }
.banner__avatars span:nth-child(3) { background: linear-gradient(135deg, var(--accent3), var(--accent)); }`,
  alignment: "left",
  fields: [
    { id: "eyebrow",        type: "text",   slot: "eyebrow",        label: "Eyebrow",          value: "NEW · v2.0" },
    { id: "version_tag",    type: "text",   slot: "version_tag",    label: "Version tag",      value: "2026" },
    { id: "headline",       type: "text",   slot: "headline",       label: "Headline",         value: "Launch day is here" },
    { id: "subhead",        type: "text",   slot: "subhead",        label: "Subhead",          value: "Auto-generated from your prompt — edit any field to fine-tune the design, copy, and color palette." },
    { id: "feature1",       type: "text",   slot: "feature1",       label: "Feature 1",        value: "Modern composition" },
    { id: "feature2",       type: "text",   slot: "feature2",       label: "Feature 2",        value: "Editable fields" },
    { id: "feature3",       type: "text",   slot: "feature3",       label: "Feature 3",        value: "Live preview" },
    { id: "cta_primary",    type: "text",   slot: "cta_primary",    label: "Primary CTA",      value: "Get started →" },
    { id: "cta_secondary",  type: "text",   slot: "cta_secondary",  label: "Secondary CTA",    value: "Learn more" },
    { id: "trust_line",     type: "text",   slot: "trust_line",     label: "Trust line",       value: "Trusted by 10,000+ teams worldwide" },
    { id: "bg",             type: "color",  cssVar: "--bg",         label: "Background",       value: "#0a0a0f" },
    { id: "fg",             type: "color",  cssVar: "--fg",         label: "Text",             value: "#ffffff" },
    { id: "accent",         type: "color",  cssVar: "--accent",     label: "Accent",           value: "#a78bfa" },
    { id: "accent2",        type: "color",  cssVar: "--accent2",    label: "Accent 2",         value: "#22d3ee" },
    { id: "accent3",        type: "color",  cssVar: "--accent3",    label: "Accent 3",         value: "#f472b6" },
    { id: "headline_size",  type: "range",  cssVar: "--headline-size", label: "Headline size", value: 64, min: 32, max: 120, step: 2, unit: "px" },
    { id: "show_eyebrow",   type: "toggle", selector: ".banner__eyebrow", label: "Show eyebrow", value: true },
    { id: "show_features",  type: "toggle", selector: ".banner__features", label: "Show features", value: true },
    { id: "show_trust",     type: "toggle", selector: ".banner__trust",    label: "Show trust line", value: true },
    { id: "show_decor",     type: "toggle", selector: ".banner__bg",       label: "Show decoration", value: true },
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
  // Style rows from admin can occasionally be miscalibrated — enforce
  // contrast so we never ship invisible-text fallbacks.
  return enforceContrast(next);
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
  // Only "headline" + the three core colors are mandatory.
  for (const required of ["headline", "bg", "fg", "accent"]) {
    if (!ids.has(required)) return null;
  }

  // Reject visibly anaemic HTML — fewer than 8 opening tags or a CSS body
  // shorter than 800 chars likely means we got a "Register Now" brochure
  // instead of a real banner. The fallback template is richer than this.
  const tagCount = (t.html.match(/<[a-zA-Z][^>/]*>/g) || []).length;
  if (tagCount < 8) return null;
  if (t.css.length < 800) return null;

  return t;
}

// Walks the fields[] for the bg / fg / accent triplet, swaps or coerces
// values so contrast is readable and saves the user from invisible text.
// Mutates a fresh copy and returns it.
function enforceContrast(template) {
  if (!template?.fields) return template;
  const next   = { ...template, fields: template.fields.map((f) => ({ ...f })) };
  const findColor = (id) => next.fields.find((f) => f.id === id && f.type === "color");

  const bgF      = findColor("bg");
  const fgF      = findColor("fg");
  const accentF  = findColor("accent");
  const accent2F = findColor("accent2");
  const accent3F = findColor("accent3");

  if (!bgF || !fgF) return next;

  // 1) bg vs fg ≥ 4.5:1 — auto-flip fg to its readable counterpart if not.
  if (contrastRatio(bgF.value, fgF.value) < 4.5) {
    fgF.value = readableForegroundFor(bgF.value);
  }

  // 2) Accent ≥ 3.0:1 against bg (used on borders, dot markers, gradients).
  if (accentF) accentF.value = accentFor(bgF.value, accentF.value);
  if (accent2F) accent2F.value = accentFor(bgF.value, accent2F.value);
  if (accent3F) accent3F.value = accentFor(bgF.value, accent3F.value);

  // 3) Headline gradients use color-mix(... var(--fg) ... var(--accent) ...);
  //    if the model's literal CSS hardcoded a near-bg color for the
  //    headline, lift it. We only patch obvious cases where a "color" is
  //    set on the headline class to within 2.0:1 of bg.
  const headlineColorRe = /\.banner__headline\s*{[^}]*color\s*:\s*([^;}]+)/i;
  const m = next.css.match(headlineColorRe);
  if (m) {
    const lit = m[1].trim();
    if (contrastRatio(bgF.value, lit) < 3.0) {
      next.css = next.css.replace(headlineColorRe, (full) =>
        full.replace(/color\s*:\s*[^;}]+/, "color: var(--fg)"),
      );
    }
  }

  return next;
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
// Provider config — every provider is treated uniformly. Admin sets
// apiKey + endpoint + model_id on the row in /admin/models. The OpenRouter
// URL is just the default when no endpoint is set.
// ─────────────────────────────────────────────────────────────────────────
export function pickApiKey(model) {
  const c = model?.config || {};
  return c.apiKey || c.api_key || c.openrouterApiKey || c.openrouter_api_key || null;
}
export function pickEndpoint(model) {
  const c = model?.config || {};
  return c.endpoint || c.baseUrl || c.url || null;
}

// Heuristic richness score — used as a quick local check on a generated
// template (cheap signal even before a vision/text model rates it).
export function templateRichness(template) {
  if (!template?.html) return 0;
  const html = template.html;
  const css  = template.css || "";

  let score = 50;

  // Element density.
  const elementCount = (html.match(/<\w+/g) || []).length;
  if (elementCount >= 8)  score += 4;
  if (elementCount >= 14) score += 6;
  if (elementCount >= 22) score += 6;

  // CSS techniques.
  const techniques = [
    /linear-gradient\(/i, /radial-gradient\(/i, /conic-gradient\(/i,
    /color-mix\(/i, /backdrop-filter:/i, /mix-blend-mode:/i,
    /mask(-image)?:/i, /clip-path:/i, /@keyframes/i, /animation:/i,
    /filter:\s*(?:blur|drop-shadow|hue-rotate|brightness)/i,
    /background-clip:\s*text/i, /transform:/i, /<svg/i,
    /text-shadow:/i, /box-shadow:/i,
  ];
  const techniqueHits = techniques.filter((re) => re.test(css) || re.test(html)).length;
  score += Math.min(20, techniqueHits * 2);

  // Field richness — more editable fields = richer banner.
  const fieldCount = template.fields?.length || 0;
  if (fieldCount >= 8)  score += 3;
  if (fieldCount >= 14) score += 4;

  // Decorative layers (orbs, grid, noise, mesh, patterns).
  const decorPatterns = [
    /banner__orb/i, /banner__mesh/i, /banner__grid/i, /banner__noise/i,
    /pattern|texture|scan|stripes/i, /<svg/i,
  ];
  const decorHits = decorPatterns.filter((re) => re.test(html)).length;
  score += Math.min(8, decorHits * 2);

  // Has photo/image background.
  if (/url\(/i.test(css) || template.fields?.some((f) => f.type === "image")) {
    score += 4;
  }

  return Math.min(99, Math.max(0, score));
}

// Generates a banner template — calls the configured model when an API key is
// set, otherwise returns the styled fallback. Always returns a valid template.
export async function generateBannerTemplate({
  supabase,
  prompt,
  style = "Modern",
  aspect = "16:9",
  variantSeed = 0,
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

  const apiKey   = pickApiKey(textModel);
  const endpoint = pickEndpoint(textModel);

  if (!apiKey) {
    return {
      ...styled,
      generator: "fallback",
      reason: `Model "${textModel.label}" has no API key. Set it in Admin → Models.`,
      styleRow,
    };
  }

  // Endpoint is optional: if the provider is openrouter (or unset), fall back
  // to the OpenRouter default URL inside callOpenRouter. For any other
  // provider, the admin must provide the endpoint URL — every provider is
  // treated uniformly via OpenAI-compatible chat completions.
  if (!endpoint && textModel.provider !== "openrouter") {
    return {
      ...styled,
      generator: "fallback",
      reason: `Provider "${textModel.provider}" needs an endpoint URL. Set config.endpoint in Admin → Models.`,
      styleRow,
    };
  }

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       textModel.modelId,
      jsonMode:    true,
      // Slightly higher temperature gives variety. The system prompt pins
      // structure tightly enough that this won't break things.
      temperature: textModel.config?.temperature ?? 0.95,
      maxTokens:   textModel.config?.maxTokens   ?? 12000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserMessage({ prompt, style, aspect, variantSeed }) },
      ],
    });

    const parsed     = extractJson(content);
    const validated  = validateTemplate(parsed);
    if (!validated) {
      return {
        ...styled,
        generator: "fallback",
        reason: "Model output failed validation (HTML too thin or invalid). Try again or pick a different model.",
        styleRow,
      };
    }
    const enriched   = ensureImageControls(validated);
    // Auto-fix contrast issues — invisible text is the #1 model failure mode.
    const colorSafe  = enforceContrast(enriched);

    return {
      ...colorSafe,
      generator: textModel.label,
      modelId:   textModel.modelId,
      provider:  textModel.provider,
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
