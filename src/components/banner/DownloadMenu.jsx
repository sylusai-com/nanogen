// src/components/banner/DownloadMenu.jsx
"use client";

import { useState } from "react";
import {
  ChevronDown,
  Code2,
  Download,
  FileImage,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import Dropdown, {
  DropdownItem,
  DropdownSection,
} from "@/components/ui/Dropdown";
import {
  buildCompositeStandaloneHtml,
  buildSvgString,
  exportSize,
  rasterize,
  rasterizeToPdf,
  triggerDownload,
} from "@/lib/bannerDownload";

const DEFAULT_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-xs font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50";

// Renders a "Download ▾" button with a dropdown of formats (HTML, PNG,
// JPEG, SVG, PDF). Each option uses the dependency-free helpers in
// /lib/bannerDownload.
//
// `banner` must contain { title, html, css, fields, alignment, aspect }.
export default function DownloadMenu({ banner, className, buttonClassName }) {
  const [busy, setBusy] = useState(null); // null | "html" | "png" | "jpeg" | "svg" | "pdf"

  if (!banner?.html || !banner?.css) {
    return (
      <button
        type="button"
        disabled
        className={buttonClassName || DEFAULT_BUTTON_CLASS}
        title="Generate a banner first to enable downloads."
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    );
  }

  const baseName = (banner.title || "banner")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "banner";

  const exportPayload = () => ({
    html:             banner.html,
    css:              banner.css,
    fields:           banner.fields || [],
    alignment:        banner.alignment || "left",
    aspect:           banner.aspect || "16:9",
    elements:         banner.canvas?.elements || [],
    canvasBackground: banner.canvas?.background || "#0c0c10",
  });

  const onHtml = async () => {
    setBusy("html");
    try {
      const payload = exportPayload();
      const doc = buildCompositeStandaloneHtml({
        html:       payload.html,
        css:        payload.css,
        fields:     payload.fields,
        alignment:  payload.alignment,
        elements:   payload.elements,
        background: payload.canvasBackground,
        aspect:     payload.aspect,
        title:      banner.title,
      });
      triggerDownload(`${baseName}.html`, doc, "text/html");
    } finally {
      setBusy(null);
    }
  };

  const onSvg = async () => {
    setBusy("svg");
    try {
      const { width, height } = exportSize(banner.aspect || "16:9");
      const svg = buildSvgString({ ...exportPayload(), width, height });
      triggerDownload(`${baseName}.svg`, svg, "image/svg+xml");
    } finally {
      setBusy(null);
    }
  };

  const onPng = async () => {
    setBusy("png");
    try {
      const data = await rasterize({ ...exportPayload(), format: "image/png", scale: 2 });
      triggerDownload(`${baseName}.png`, data);
    } catch (e) {
      alert(e?.message || "PNG export failed");
    } finally {
      setBusy(null);
    }
  };

  const onJpeg = async () => {
    setBusy("jpeg");
    try {
      const data = await rasterize({ ...exportPayload(), format: "image/jpeg", scale: 2 });
      triggerDownload(`${baseName}.jpg`, data);
    } catch (e) {
      alert(e?.message || "JPEG export failed");
    } finally {
      setBusy(null);
    }
  };

  const onPdf = async () => {
    setBusy("pdf");
    try {
      const blob = await rasterizeToPdf(exportPayload());
      const url  = URL.createObjectURL(blob);
      triggerDownload(`${baseName}.pdf`, url);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      alert(e?.message || "PDF export failed");
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy != null;
  const Icon   = isBusy ? Loader2 : Download;

  return (
    <Dropdown
      className={className}
      width={240}
      trigger={
        <button
          type="button"
          disabled={isBusy}
          className={buttonClassName || DEFAULT_BUTTON_CLASS}
        >
          <Icon className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
          {isBusy ? `Exporting ${busy.toUpperCase()}…` : "Download"}
          <ChevronDown className="h-3 w-3 text-muted" />
        </button>
      }
    >
      <DropdownSection label="Source">
        <DropdownItem leftIcon={<Code2 className="h-4 w-4" />} onClick={onHtml}>
          HTML <span className="ml-auto text-[10px] text-muted">.html</span>
        </DropdownItem>
        <DropdownItem leftIcon={<FileImage className="h-4 w-4" />} onClick={onSvg}>
          SVG (scalable) <span className="ml-auto text-[10px] text-muted">.svg</span>
        </DropdownItem>
      </DropdownSection>

      <DropdownSection label="Image">
        <DropdownItem leftIcon={<ImageIcon className="h-4 w-4" />} onClick={onPng}>
          PNG (2×) <span className="ml-auto text-[10px] text-muted">.png</span>
        </DropdownItem>
        <DropdownItem leftIcon={<ImageIcon className="h-4 w-4" />} onClick={onJpeg}>
          JPEG (2×) <span className="ml-auto text-[10px] text-muted">.jpg</span>
        </DropdownItem>
      </DropdownSection>

      <DropdownSection label="Document">
        <DropdownItem leftIcon={<FileText className="h-4 w-4" />} onClick={onPdf}>
          PDF <span className="ml-auto text-[10px] text-muted">.pdf</span>
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
}
