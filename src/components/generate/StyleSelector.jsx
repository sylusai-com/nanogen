// src/components/generate/StyleSelector.jsx
"use client";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import Field from "./Field";

// Visual style picker. Each option renders a small swatch using the
// style's stored gradient (or its bg + accent fall-back) so the user
// gets a colour preview rather than a row of identical pills. An
// explicit "Auto" tile sits first so picking "no style" stays a
// deliberate choice instead of an accidental empty value.
function swatchFor(style) {
  if (style?.gradient) return style.gradient;
  const bg = style?.bg || "#0c0c10";
  const accent = style?.accent || "#a78bfa";
  const fg = style?.fg || "#ffffff";
  return `linear-gradient(135deg, ${bg} 0%, ${accent} 60%, ${fg} 100%)`;
}

export default function StyleSelector({ options, value, onChange }) {
  const list = options || [];
  return (
    <Field
      label="Style"
      hint={value ? null : "Optional — Auto lets the model decide"}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile
          active={!value}
          label="Auto"
          sub="Model decides"
          onClick={() => onChange(null)}
          swatch={
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--primary)_18%,transparent)] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          }
        />
        {list.map((style) => {
          const active = value === style.label;
          return (
            <Tile
              key={style.id || style.label}
              active={active}
              label={style.label}
              onClick={() => onChange(active ? null : style.label)}
              swatch={
                <span
                  className="h-7 w-7 rounded-md ring-1 ring-inset ring-border"
                  style={{ background: swatchFor(style) }}
                />
              }
            />
          );
        })}
      </div>
    </Field>
  );
}

function Tile({ active, label, sub, onClick, swatch }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl border bg-background px-2.5 py-2 text-left transition-all",
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
      {swatch}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">
          {label}
        </span>
        {sub && <span className="block truncate text-[10px] text-muted">{sub}</span>}
      </span>
    </button>
  );
}
