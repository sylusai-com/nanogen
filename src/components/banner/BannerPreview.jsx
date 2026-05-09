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

// data: URIs for subject / bg images can be hundreds of KB. Inlining them
// inside the iframe srcDoc string blows past the practical attribute-size
// budget some browsers enforce and corrupts attribute parsing because of
// the embedded quotes. Convert each data URI to a blob: URL that lives
// in the parent document — the iframe inherits the same origin (sandbox
// allow-same-origin) so blob: URLs resolve there too.
//
// Note: we deliberately DON'T revoke these URLs on unmount. React's
// StrictMode in dev mounts → unmounts → mounts every component, so any
// cleanup-time revoke runs while the iframe is still in the DOM and
// pointing at the URL — the next image fetch then 404s. The browser
// frees blob URLs automatically when the document unloads, so leaking
// one decoded image per BannerPreview is the right tradeoff.
const dataUrlBlobCache = new Map();
function dataUrlToBlobUrl(dataUrl) {
  if (typeof window === "undefined") return dataUrl;
  const cached = dataUrlBlobCache.get(dataUrl);
  if (cached) return cached;
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return dataUrl;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = !!match[2];
  const payload = match[3] || "";
  try {
    let bytes;
    if (isBase64) {
      const binary = atob(payload);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    dataUrlBlobCache.set(dataUrl, url);
    return url;
  } catch {
    return dataUrl;
  }
}

function unwrapUrlValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/^url\(\s*["']?(.*?)["']?\s*\)$/i);
  return m ? m[1].trim() : raw;
}

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
  const rawSubjectImageUrl = banner?.subjectImageUrl || banner?.subject_image_url || null;

  // Off-load every data: URI we are about to render (subject + any image
  // fields) to a blob URL. The cache keyed on data URI ensures the same
  // blob URL is reused across renders / StrictMode double-mounts so the
  // iframe never references a revoked URL.
  const { subjectImageUrl, imageFieldUrlMap } = useMemo(() => {
    const swap = (src) => {
      const inner = unwrapUrlValue(src);
      if (!inner || !inner.startsWith("data:")) return src;
      return dataUrlToBlobUrl(inner);
    };

    const subject = rawSubjectImageUrl ? swap(rawSubjectImageUrl) : null;
    const fieldMap = new Map();
    for (const field of fields) {
      if (field?.type !== "image") continue;
      const next = swap(field.value);
      if (next !== field.value) fieldMap.set(field.id, next);
    }
    return { subjectImageUrl: subject, imageFieldUrlMap: fieldMap };
  }, [fields, rawSubjectImageUrl]);

  const resolvedFields = useMemo(() => {
    const next = (fields || []).map((field) => {
      if (field?.type === "image" && imageFieldUrlMap.has(field.id)) {
        const swapped = imageFieldUrlMap.get(field.id);
        const wrapped = swapped.startsWith("url(") ? swapped : `url("${swapped}")`;
        return { ...field, value: wrapped };
      }
      return { ...field };
    });

    const raw = String(subjectImageUrl || "").trim();
    if (!raw) return next;

    const wrapped = raw.startsWith("url(") ? raw : `url("${raw}")`;
    let hasBgImageField = false;

    for (const field of next) {
      const id = String(field?.id || "").toLowerCase();
      const cssVar = String(field?.cssVar || "").toLowerCase();
      if (id === "bg_image" || cssVar === "--bg-image") {
        field.value = wrapped;
        hasBgImageField = true;
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
  }, [fields, subjectImageUrl, imageFieldUrlMap]);

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
