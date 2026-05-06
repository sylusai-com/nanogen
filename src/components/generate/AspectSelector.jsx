// src/components/generate/AspectSelector.jsx
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import Field from "./Field";

// Visual aspect-ratio picker. Each option is a tile with a frame drawn at
// the actual proportion so the user can see the shape they're choosing
// without having to translate "9:16" → tall portrait in their head.
//
// `options` come from public.aspect_ratios (see listAspectRatios).
const FRAME_BOX = 38; // CSS px — frames fit inside this square area

function frameDims(ratio) {
  const [w, h] = String(ratio || "16:9").split(":").map(Number);
  if (!w || !h) return { width: FRAME_BOX, height: Math.round(FRAME_BOX * 9 / 16) };
  if (w >= h) {
    return { width: FRAME_BOX, height: Math.round((FRAME_BOX * h) / w) };
  }
  return { width: Math.round((FRAME_BOX * w) / h), height: FRAME_BOX };
}

export default function AspectSelector({ options, value, onChange }) {
  const opts = options || [];
  return (
    <Field label="Aspect ratio">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {opts.map((o) => {
          const active = value === o.ratio;
          const { width, height } = frameDims(o.ratio);
          return (
            <button
              type="button"
              key={o.id || o.ratio}
              onClick={() => onChange(o.ratio)}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-background px-2 py-2.5 text-center transition-all",
                active
                  ? "border-primary ring-2 ring-primary/30 bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))]"
                  : "border-border hover:border-border-strong",
              )}
            >
              {active && (
                <span className="absolute right-1.5 top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-fg">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
              <span
                className="flex shrink-0 items-center justify-center"
                style={{ width: FRAME_BOX, height: FRAME_BOX }}
              >
                <span
                  className={cn(
                    "rounded-[3px] border-2 transition-colors",
                    active
                      ? "border-primary bg-[color-mix(in_oklab,var(--primary)_22%,transparent)]"
                      : "border-muted-strong/60 group-hover:border-foreground/70",
                  )}
                  style={{ width, height }}
                />
              </span>
              <span className="flex flex-col leading-tight">
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-foreground" : "text-foreground/90",
                  )}
                >
                  {o.ratio}
                </span>
                {o.label && o.label !== o.ratio && (
                  <span className="text-[10px] text-muted">{o.label}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}
