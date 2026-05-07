// src/components/editor/EditorPreview.jsx
"use client";

import { cn } from "@/lib/cn";
import BannerPreview from "@/components/banner/BannerPreview";

function aspectRatio(a) {
  if (a === "1:1") return "1 / 1";
  if (a === "4:5") return "4 / 5";
  if (a === "9:16") return "9 / 16";
  return "16 / 9";
}

export default function EditorPreview({
  template,
  fields,
  alignment,
  aspect = "16:9",
  className,
  subjectImageUrl,
}) {
  if (!template) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-surface skeleton",
          className,
        )}
        style={{ aspectRatio: aspectRatio(aspect) }}
      />
    );
  }

  // Adapt the editor's `template` shape to the BannerPreview banner shape
  // so the editor preview, the saved-banner preview, and every download
  // format share a single rendering pipeline.
  const banner = {
    aspect,
    html: template.html,
    css: template.css,
    fields,
    alignment,
    title: "Banner preview",
    subjectImageUrl: subjectImageUrl || null,
  };

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2 p-3",
        className,
      )}
    >
      <div
        className="block w-full max-w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: aspectRatio(aspect), maxHeight: "100%" }}
      >
        <BannerPreview banner={banner} className="h-full w-full" />
      </div>
    </div>
  );
}
