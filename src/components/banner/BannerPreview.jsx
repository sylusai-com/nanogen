// src/components/banner/BannerPreview.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  const srcDoc = useMemo(() => {
    if (!banner?.html || !banner?.css) return null;
    return buildCompositeStandaloneHtml({
      html: banner.html,
      css: banner.css,
      fields: banner.fields || [],
      alignment: banner.alignment || "left",
      title: banner.title || "banner",
      elements: banner.canvas?.elements || [],
      background: banner.canvas?.background || "#0c0c10",
      aspect,
    });
  }, [
    banner?.html,
    banner?.css,
    banner?.fields,
    banner?.alignment,
    banner?.title,
    banner?.canvas?.elements,
    banner?.canvas?.background,
    aspect,
  ]);

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
        background: background ?? banner?.gradient ?? "#0c0c10",
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
