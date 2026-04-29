// src/lib/color.js
// Tiny, dependency-free color utilities — used to validate and auto-fix
// the bg / fg / accent palette returned by the AI banner generator.
//
// Why this exists: models occasionally return banners where bg and fg are
// (nearly) the same color, making the text invisible. We don't want to
// silently ship that. validateContrast() detects the problem and
// fixContrast() rewrites the offending color values to a readable pair
// while preserving the model's intended hue when possible.

// ─────────────────────────────────────────────────────────────────────────
// Parsing & conversion
// ─────────────────────────────────────────────────────────────────────────

const NAMED_COLORS = {
  black:   "#000000",
  white:   "#ffffff",
  red:     "#ff0000",
  green:   "#008000",
  blue:    "#0000ff",
  yellow:  "#ffff00",
  cyan:    "#00ffff",
  magenta: "#ff00ff",
  gray:    "#808080",
  grey:    "#808080",
  silver:  "#c0c0c0",
  navy:    "#000080",
  teal:    "#008080",
  purple:  "#800080",
  orange:  "#ffa500",
  pink:    "#ffc0cb",
  brown:   "#a52a2a",
  transparent: "#00000000",
};

// Returns { r, g, b, a } in 0–255 / 0–1 ranges, or null if unparseable.
export function parseColor(input) {
  if (typeof input !== "string") return null;
  const v = input.trim().toLowerCase();
  if (!v) return null;

  if (NAMED_COLORS[v]) return parseColor(NAMED_COLORS[v]);

  // #rgb, #rgba, #rrggbb, #rrggbbaa
  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length === 6) h = h + "ff";
    if (h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: parseInt(h.slice(6, 8), 16) / 255,
    };
  }

  // rgb(r,g,b) / rgba(r,g,b,a) / rgb(r g b / a)
  const rgb = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseFloat(parts[0]);
    const g = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    const a = parts[3] != null ? parseFloat(parts[3]) : 1;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return {
      r: Math.max(0, Math.min(255, Math.round(r))),
      g: Math.max(0, Math.min(255, Math.round(g))),
      b: Math.max(0, Math.min(255, Math.round(b))),
      a: Number.isNaN(a) ? 1 : Math.max(0, Math.min(1, a)),
    };
  }

  return null;
}

export function toHex({ r, g, b }) {
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Contrast — WCAG-style relative luminance + ratio
// ─────────────────────────────────────────────────────────────────────────

function srgbToLinear(c) {
  const n = c / 255;
  return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb) {
  if (!rgb) return 0;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const ra = parseColor(a);
  const rb = parseColor(b);
  if (!ra || !rb) return 1;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const lighter = Math.max(la, lb);
  const darker  = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isDark(color) {
  const rgb = parseColor(color);
  if (!rgb) return true;
  return relativeLuminance(rgb) < 0.5;
}

// ─────────────────────────────────────────────────────────────────────────
// Auto-fix: pick a readable foreground given a background (and vice versa)
// ─────────────────────────────────────────────────────────────────────────

const BLACK = "#0a0a0f";
const WHITE = "#ffffff";

// Returns the best fg color (white or near-black) for a given bg, with
// contrast ≥ 4.5:1.
export function readableForegroundFor(bg) {
  const ratioWhite = contrastRatio(bg, WHITE);
  const ratioBlack = contrastRatio(bg, BLACK);
  return ratioWhite >= ratioBlack ? WHITE : BLACK;
}

// Returns a darkened or lightened version of a base color so the contrast
// against `against` is at least `minRatio`. Walks toward black or white
// in 5% steps until the target ratio is met.
export function adjustForContrast(base, against, minRatio = 4.5) {
  const rgb = parseColor(base);
  if (!rgb) return base;
  if (contrastRatio(base, against) >= minRatio) return base;
  const goingDark = !isDark(against); // bg is light → push fg darker
  for (let i = 1; i <= 20; i++) {
    const t = i * 0.05;
    const next = goingDark
      ? { r: Math.round(rgb.r * (1 - t)), g: Math.round(rgb.g * (1 - t)), b: Math.round(rgb.b * (1 - t)) }
      : {
          r: Math.round(rgb.r + (255 - rgb.r) * t),
          g: Math.round(rgb.g + (255 - rgb.g) * t),
          b: Math.round(rgb.b + (255 - rgb.b) * t),
        };
    const hex = toHex(next);
    if (contrastRatio(hex, against) >= minRatio) return hex;
  }
  return goingDark ? BLACK : WHITE;
}

// Coerces accent toward a hue that contrasts the bg adequately. Used so the
// "accent" color is also visible (it's used for borders, eyebrow pills, dot
// markers, gradient highlights, etc.).
export function accentFor(bg, accent) {
  if (contrastRatio(bg, accent) >= 3.0) return accent;
  return adjustForContrast(accent, bg, 3.0);
}
