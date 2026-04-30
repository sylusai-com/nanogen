// src/components/generate/StyleSelector.jsx
"use client";

import { cn } from "@/lib/cn";
import Field from "./Field";

export default function StyleSelector({ options, value, onChange }) {
  // `options` come from public.banner_styles — caller fetches them.
  // The chip group includes an explicit "Auto" option that maps to no
  // style, so the user can intentionally let the model decide instead of
  // being silently nudged toward whatever style happens to be first.
  const labels = (options || []).map((s) => s.label);
  return (
    <Field
      label="Style"
      hint={value ? null : "Optional — leave on Auto to let the model decide"}
    >
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            !value
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "bg-surface text-muted-strong border border-border hover:border-border-strong hover:text-foreground",
          )}
        >
          Auto
        </button>
        {labels.map((label) => {
          const active = value === label;
          return (
            <button
              type="button"
              key={label}
              onClick={() => onChange(active ? null : label)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-surface text-muted-strong border border-border hover:border-border-strong hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
