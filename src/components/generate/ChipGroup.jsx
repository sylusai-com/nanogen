"use client";

import { cn } from "@/lib/cn";

export default function ChipGroup({ options, value, onChange, className, getLabel = (o) => o }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const label = getLabel(o);
        const active = value === id;
        return (
          <button
            type="button"
            key={id}
            onClick={() => onChange(id)}
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
  );
}
