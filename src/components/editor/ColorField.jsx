"use client";

import { Label } from "@/components/ui/Input";

// Validates a value as a CSS color the <input type="color"> picker can read.
// The picker only accepts 7-char hex (#rrggbb). Models sometimes emit long
// strings — gradients, rgba(), or even an entire data: URI mistakenly bound
// to a `bg`/`fg`/`accent` color field — which used to break the swatch and
// expand the text input wide enough to push the right panel off-screen.
// We surface the raw value so the user can still see/edit what the model
// wrote, but feed the picker a safe fallback.
const HEX_RE = /^#[0-9a-f]{6}$/i;
function safeHexFor(picker, raw) {
  if (typeof raw !== "string") return "#000000";
  const v = raw.trim();
  if (HEX_RE.test(v)) return v;
  return "#000000";
}
function isValidCss(raw) {
  if (typeof raw !== "string") return false;
  const v = raw.trim();
  if (!v) return false;
  // Anything obviously NOT a single solid color (gradients, urls, multiple
  // commas at the top level) is rejected — the swatch falls back to a
  // checkerboard so the user sees that this field's value is unusable.
  if (/^url\(/i.test(v))                return false;
  if (/gradient\(/i.test(v))            return false;
  if (v.length > 64)                    return false;
  return true;
}

export default function ColorField({ field, onChange }) {
  const raw = typeof field.value === "string" ? field.value : "";
  const valid = isValidCss(raw);
  const swatchBg = valid
    ? raw
    : "repeating-conic-gradient(var(--surface-2) 0% 25%, var(--surface) 0% 50%) 50% / 12px 12px";

  return (
    <div className="space-y-1.5 min-w-0">
      <Label>{field.label}</Label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 min-w-0">
        <span
          className="inline-block h-6 w-6 shrink-0 rounded-md ring-1 ring-inset ring-border"
          style={{ background: swatchBg }}
          title={valid ? raw : "Not a valid CSS color"}
        />
        <input
          type="color"
          aria-label={`Pick ${field.label}`}
          value={safeHexFor("picker", raw)}
          onChange={(e) => onChange(field.id, e.target.value)}
          className="h-6 w-6 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={raw}
          onChange={(e) => onChange(field.id, e.target.value)}
          className="h-6 min-w-0 flex-1 truncate rounded-md bg-transparent font-mono text-[11px] text-foreground outline-none"
          spellCheck={false}
        />
      </div>
      {!valid && raw && (
        <p className="text-[10px] leading-snug text-amber-400/90">
          This field has a non-color value. Replace it with a hex like
          <code className="ml-1 rounded bg-surface-2 px-1 font-mono text-[10px]">#1f2937</code>
          to restore the swatch.
        </p>
      )}
    </div>
  );
}
