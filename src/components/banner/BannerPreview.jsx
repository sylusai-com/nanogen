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
  // When `lazy` is true the iframe is only mounted once the wrapper
  // enters the viewport. This is a major perf win on the dashboard
  // gallery — 12 iframes parsing + laying out + rendering at once on
  // first paint stalls the main thread for 200-500ms. With lazy mount
  // we render only the visible thumbs (typically 4-6) and let the rest
  // mount as the user scrolls. Detail / editor pages set this to false
  // so the banner shows immediately.
  lazy = false,
  rootMargin = "400px",
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
    // The user's reference upload and subject upload have STRICTLY
    // separate roles: reference informs the model (palette / mood) and is
    // never rendered; subject is rendered via the subject_image field
    // (cutout overlay) or — only when bg removal failed and no AI bg was
    // fetched — via the bg_image field set by the route. We deliberately
    // do NOT pull `subjectImageUrl` into bg_image here as a "fallback":
    // that legacy convenience silently turned the user's raw subject
    // upload (full scene + native background) into the banner backdrop,
    // which conflated the two roles and made the subject look like the
    // bg. The route always populates bg_image / subject_image with the
    // right asset; this component just passes them through.
    return (fields || []).map((field) => {
      if (field?.type === "image" && imageFieldUrlMap.has(field.id)) {
        const swapped = imageFieldUrlMap.get(field.id);
        const wrapped = swapped.startsWith("url(") ? swapped : `url("${swapped}")`;
        return { ...field, value: wrapped };
      }
      return { ...field };
    });
  }, [fields, imageFieldUrlMap]);

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
  // `visible` gates iframe mounting under lazy mode. Once true it stays
  // true — we don't want to unmount the iframe just because the user
  // scrolled past it (re-mounting would re-fire parse + layout).
  const [visible, setVisible] = useState(!lazy);

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
    if (!lazy || visible) return;
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [lazy, visible, rootMargin]);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={{
        aspectRatio: aspect.replace(":", " / "),
        background: previewBackground,
      }}
    >
      {srcDoc && visible && (
        <iframe
          ref={iframeRef}
          title={banner?.title || "Banner preview"}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          // `loading="lazy"` is a belt-and-braces with the IntersectionObserver
          // above. The IO determines whether we mount the iframe element at
          // all; once mounted, the browser still gets to defer the actual
          // resource fetch for any embedded images.
          loading="lazy"
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
