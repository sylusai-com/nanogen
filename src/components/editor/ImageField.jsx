// src/components/editor/ImageField.jsx
"use client";

import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Input, Label } from "@/components/ui/Input";

// Strips wrapping url("…") so the admin sees a clean URL when editing,
// then re-wraps on save so the CSS variable receives the right value.
function unwrap(value) {
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/^url\(["']?(.+?)["']?\)$/i);
  return m ? m[1] : s;
}
function wrap(url) {
  const u = (url || "").trim();
  if (!u) return "";
  return `url("${u}")`;
}

export default function ImageField({ field, onChange }) {
  const [draft, setDraft] = useState(unwrap(field.value));

  const commit = (val) => {
    setDraft(val);
    onChange(field.id, val ? wrap(val) : "");
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-xs">
        <ImageIcon className="h-3 w-3" />
        {field.label}
      </Label>
      <div className="relative">
        <Input
          value={draft}
          onChange={(e) => commit(e.target.value)}
          placeholder="https://images.unsplash.com/..."
          className="pr-9 text-xs font-mono"
        />
        {draft && (
          <button
            type="button"
            onClick={() => commit("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            aria-label="Clear"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {draft && (
        <div
          className="mt-2 h-20 w-full rounded-lg border border-border bg-surface-2 bg-cover bg-center"
          style={{ backgroundImage: wrap(draft) }}
        />
      )}
    </div>
  );
}