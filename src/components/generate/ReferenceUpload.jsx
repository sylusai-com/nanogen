"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import Field from "./Field";

export default function ReferenceUpload({ value, onChange }) {
  const inputRef = useRef(null);

  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <Field label="Reference image" hint="Optional">
      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-left text-sm text-muted-strong hover:border-border-strong hover:bg-surface transition-colors"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-foreground">
            <ImagePlus className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-foreground">Drop or browse an image</span>
            <span className="block text-[11px] text-muted">
              PNG, JPG, WEBP up to 10MB
            </span>
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 pr-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.dataUrl}
            alt=""
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-[var(--border)]"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">{value.name}</div>
            <div className="text-[11px] text-muted">Reference attached</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
            aria-label="Remove reference image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </Field>
  );
}
