"use client";

import { Wand2 } from "lucide-react";
import Field from "./Field";

const SUGGESTIONS = [
  "Launch banner for a fintech app, soft gold accent on navy",
  "Cyberpunk product hero with neon violet glow",
  "Editorial sale promo with bold serif headline",
];

export default function PromptInput({ value, onChange }) {
  return (
    <Field label="Prompt" hint={`${value.length}/500`}>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="e.g. Launch banner for a fintech app — bold serif headline, navy background, soft gold gradient accent"
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted outline-none transition-shadow focus:border-border-strong focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          <Wand2 className="h-3 w-3" /> Try
        </span>
        {SUGGESTIONS.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => onChange(s)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-strong hover:border-border-strong hover:text-foreground transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </Field>
  );
}
