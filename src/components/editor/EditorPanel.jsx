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
    <div className="w-full min-w-0">
      <div className="border-b border-border bg-surface/60 px-3 py-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Editor
            </div>
            <div className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
              {activeTab.label}
            </div>
          </div>
          <p className="text-[11px] leading-snug text-muted">
            {TAB_COPY[tab]}
          </p>
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={active}
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
                    active
                      ? "border-foreground/10 bg-foreground text-background"
                      : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
                  ].join(" ")}
                >
                  <t.icon className="h-3 w-3" />
                  <span className="font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-3 py-4">
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
    </div>
  );
}