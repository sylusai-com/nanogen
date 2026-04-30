"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import Field from "./Field";
import { compressImage, isImageFile } from "@/lib/imageUpload";

export default function ReferenceUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    setError(null);
    if (!isImageFile(file)) {
      setError("Please choose an image (PNG, JPG, WEBP).");
      return;
    }
    setBusy(true);
    try {
      // Compress + resize so the data URL stays well under the request
      // body limit on /api/banners. ~300–600KB after compression for
      // typical photos.
      const dataUrl = await compressImage(file);
      onChange({ name: file.name, dataUrl });
    } catch (e) {
      setError(e?.message || "Failed to process image");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Field label="Reference image" hint="Optional — used as the banner backdrop">
      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-left text-sm text-muted-strong hover:border-border-strong hover:bg-surface transition-colors disabled:opacity-60"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-foreground">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-foreground">
              {busy ? "Processing image…" : "Upload a reference image"}
            </span>
            <span className="block text-[11px] text-muted">
              PNG, JPG, WEBP up to 8MB — auto-compressed
            </span>
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 pr-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.dataUrl}
            alt=""
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-border"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">{value.name}</div>
            <div className="text-[11px] text-muted">Will be used as the banner backdrop</div>
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
      {error && (
        <div className="text-[11px] text-red-400">{error}</div>
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
