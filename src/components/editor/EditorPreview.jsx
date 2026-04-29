// src/components/editor/EditorPreview.jsx
"use client";

import { useMemo } from "react";
import { buildStandaloneHtml } from "@/lib/bannerDownload";
import { cn } from "@/lib/cn";

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
}) {
  const srcDoc = useMemo(() => {
    if (!template) return "";
    return buildStandaloneHtml({
      html: template.html,
      css: template.css,
      fields,
      alignment,
      title: "Banner preview",
    });
  }, [template, fields, alignment]);

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

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2 p-3",
        className,
      )}
    >
      <div
        className="block w-full max-w-full overflow-hidden rounded-xl"
        style={{
          aspectRatio: aspectRatio(aspect),
          // Never let the preview frame exceed the parent column's height.
          maxHeight: "100%",
        }}
      >
        <iframe
          title="Banner preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          className="block h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}