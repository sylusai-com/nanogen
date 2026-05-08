// src/components/banner/BannerPreview.jsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  buildCompositeStandaloneHtml,
  exportRenderSize,
} from "@/lib/bannerDownload";

// Single source of truth for rendering a saved banner. Used by the
// dashboard list, the detail page, the editor preview, and the builder
// canvas backdrop so the layout is byte-identical everywhere.
//
// The iframe is laid out at a FIXED CSS-pixel size (exportRenderSize for
// the chosen aspect) and then CSS-scaled to fit whatever space the parent
// gives it. This keeps viewport-relative units (vw, %, clamp) resolving
// to the same values regardless of how big the preview is rendered, so
// nothing shifts between a 250px thumbnail and an 1100px detail view.
export default function BannerPreview({
  banner,
  className,
  iframeClassName,
  background,
  pointerEvents = false,
  iframeRef,
}) {
  const aspect = banner?.aspect || "16:9";
  const { width: designW, height: designH } = exportRenderSize(aspect);
  const fields = useMemo(() => (Array.isArray(banner?.fields) ? banner.fields : []), [banner]);
  const subjectImageUrl = banner?.subjectImageUrl || banner?.subject_image_url || null;
  const resolvedFields = useMemo(() => {
    const next = (fields || []).map((field) => ({ ...field }));
    const raw = String(subjectImageUrl || "").trim();
    if (!raw) return next;

    const wrapped = raw.startsWith("url(") ? raw : `url("${raw}")`;
    let hasBgImageField = false;

    for (const field of next) {
      const id = String(field?.id || "").toLowerCase();
      const cssVar = String(field?.cssVar || "").toLowerCase();
      if (id === "bg_image" || cssVar === "--bg-image") {
        field.value = wrapped;
        field.type = "image";
        hasBgImageField = true;
      }
      if (id.includes("subject") || cssVar.includes("subject")) {
        field.value = wrapped;
      }
    }

    if (!hasBgImageField) {
      next.push({
        id: "bg_image",
        type: "image",
        label: "Background Image",
        cssVar: "--bg-image",
        value: wrapped,
      });
    }

    return next;
  }, [fields, subjectImageUrl]);
  const previewBackground = typeof background === "string" && /^(?:data:image\/|https?:\/\/)/i.test(background.trim())
    ? banner?.gradient || "#0c0c10"
    : (background ?? banner?.gradient ?? "#0c0c10");

  const srcDoc = !banner?.html || !banner?.css
    ? null
    : buildCompositeStandaloneHtml({
        html: banner.html,
        css: banner.css,
      fields: resolvedFields,
        alignment: banner.alignment || "left",
        title: banner.title || "banner",
        subjectImageUrl,
        elements: banner.canvas?.elements || [],
        background: banner.canvas?.background || "#0c0c10",
        aspect,
      });

  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const update = () => {
      const w = node.clientWidth;
      if (w > 0) setScale(w / designW);
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [designW]);

  useEffect(() => {
    try {
      console.log("BannerPreview debug:", {
        id: banner?.id,
        title: banner?.title,
        subjectImageUrl,
        subjectImageLength: subjectImageUrl ? subjectImageUrl.length : 0,
        fields,
        resolvedFields,
        resolvedBgImageLength:
          resolvedFields.find((f) => String(f?.id || "").toLowerCase() === "bg_image")?.value?.length || 0,
        srcDocExists: !!srcDoc,
        srcDocLength: srcDoc ? srcDoc.length : 0,
        previewBackground,
        canvasBackground: banner?.canvas?.background,
      });
    } catch (e) {
      // best-effort logging
      console.log("BannerPreview debug error:", e);
    }
  }, [banner?.id, banner?.title, subjectImageUrl, fields, resolvedFields, srcDoc, previewBackground, banner?.canvas?.background]);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={{
        aspectRatio: aspect.replace(":", " / "),
        background: previewBackground,
      }}
    >
      {srcDoc && (
        <iframe
          ref={iframeRef}
          title={banner?.title || "Banner preview"}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          className={cn(
            "absolute left-0 top-0 origin-top-left border-0 bg-transparent",
            !pointerEvents && "pointer-events-none",
            iframeClassName,
          )}
          style={{
            width: `${designW}px`,
            height: `${designH}px`,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}
