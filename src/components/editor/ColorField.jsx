"use client";

import { Label } from "@/components/ui/Input";

export default function ColorField({ field, onChange }) {
  return (
    <div className="space-y-2">
      <Label>{field.label}</Label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5">
        <span
          className="inline-block h-7 w-7 shrink-0 rounded-md ring-1 ring-inset ring-border"
          style={{ background: field.value }}
        />
        <input
          type="color"
          aria-label={`Pick ${field.label}`}
          value={field.value}
          onChange={(e) => onChange(field.id, e.target.value)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={field.value}
          onChange={(e) => onChange(field.id, e.target.value)}
          className="h-7 flex-1 rounded-md bg-transparent font-mono text-xs text-foreground outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
