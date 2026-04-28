// src/components/editor/EditorPanel.jsx
"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  LayoutPanelLeft,
  Palette,
  Sliders,
  Type,
} from "lucide-react";
import Card from "@/components/ui/Card";
import TextField from "./TextField";
import ColorField from "./ColorField";
import RangeField from "./RangeField";
import SelectField from "./SelectField";
import ToggleField from "./ToggleField";
import ImageField from "./ImageField";
import AlignmentField from "./AlignmentField";

const TABS = [
  { id: "text",     icon: Type,            label: "Text" },
  { id: "colors",   icon: Palette,         label: "Colors" },
  { id: "media",    icon: ImageIcon,       label: "Media" },
  { id: "advanced", icon: Sliders,         label: "Advanced" },
  { id: "layout",   icon: LayoutPanelLeft, label: "Layout" },
];

const TAB_COPY = {
  text: "Copy, headlines, and CTA text",
  colors: "Background, foreground, and accents",
  media: "Images, crops, and visual treatments",
  advanced: "Ranges, toggles, and extra controls",
  layout: "Alignment and composition",
};

// These ids belong to the image control panel and should NOT be duplicated
// in the Advanced tab. They live inside the ImageField card on the Media tab.
const IMAGE_COMPANION_IDS = new Set([
  "bg_brightness",
  "bg_blur",
  "bg_overlay",
  "bg_zoom",
  "bg_position",
]);

export default function EditorPanel({
  fields,
  alignment,
  onFieldChange,
  onAlignmentChange,
}) {
  const [tab, setTab] = useState("text");

  const text     = fields.filter((f) => f.type === "text");
  const colors   = fields.filter((f) => f.type === "color");
  const images   = fields.filter((f) => f.type === "image");
  const advanced = fields.filter(
    (f) =>
      ["range", "select", "toggle"].includes(f.type) &&
      !IMAGE_COMPANION_IDS.has(f.id),
  );
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <Card elevated className="w-full min-w-0 overflow-hidden border border-border/70 bg-surface/90 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="border-b border-border/70 bg-linear-to-r from-surface via-surface to-surface-2/40 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Editor controls
              </div>
              <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground">
                Properties
              </h3>
            </div>
            <div className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
              {activeTab.label}
            </div>
          </div>
          <p className="max-w-136 text-xs leading-5 text-muted">
            {TAB_COPY[tab]}
          </p>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={active}
                  className={[
                    "group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-all duration-200",
                    active
                      ? "border-foreground/10 bg-foreground text-background shadow-sm shadow-foreground/10"
                      : "border-border bg-surface hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2",
                  ].join(" ")}
                >
                  <t.icon className={active ? "h-3.5 w-3.5" : "h-3.5 w-3.5 text-muted transition-colors group-hover:text-foreground"} />
                  <span className="font-medium tracking-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        {tab === "text" && (
          <div className="space-y-4">
            {text.length ? (
              text.map((f) => (
                <TextField key={f.id} field={f} onChange={onFieldChange} />
              ))
            ) : (
              <p className="text-xs text-muted">No text fields in this template.</p>
            )}
          </div>
        )}

        {tab === "colors" && (
          <div className="space-y-4">
            {colors.length ? (
              colors.map((f) => (
                <ColorField key={f.id} field={f} onChange={onFieldChange} />
              ))
            ) : (
              <p className="text-xs text-muted">No color fields in this template.</p>
            )}
          </div>
        )}

        {tab === "media" && (
          <div className="space-y-4">
            {images.length ? (
              images.map((f) => (
                <ImageField
                  key={f.id}
                  field={f}
                  onChange={onFieldChange}
                  allFields={fields}
                />
              ))
            ) : (
              <p className="text-xs text-muted">
                No image fields in this template. Generate again with a brief
                that suggests a hero image, or add a field named{" "}
                <code className="font-mono">bg_image</code> manually.
              </p>
            )}
          </div>
        )}

        {tab === "advanced" && (
          <div className="space-y-4">
            {advanced.length ? (
              advanced.map((f) => {
                if (f.type === "range")
                  return <RangeField key={f.id} field={f} onChange={onFieldChange} />;
                if (f.type === "select")
                  return <SelectField key={f.id} field={f} onChange={onFieldChange} />;
                if (f.type === "toggle")
                  return <ToggleField key={f.id} field={f} onChange={onFieldChange} />;
                return null;
              })
            ) : (
              <p className="text-xs text-muted">
                No advanced controls in this template. Image adjustments live
                under the <strong>Media</strong> tab.
              </p>
            )}
          </div>
        )}

        {tab === "layout" && (
          <div className="space-y-4">
            <AlignmentField value={alignment} onChange={onAlignmentChange} />
          </div>
        )}
      </div>
    </Card>
  );
}