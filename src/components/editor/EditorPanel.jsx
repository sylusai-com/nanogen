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
import Tabs from "@/components/ui/Tabs";
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
  const advanced = fields.filter((f) =>
    ["range", "select", "toggle"].includes(f.type),
  );

  return (
    <Card elevated className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Properties</h3>
        <Tabs
          size="sm"
          value={tab}
          onChange={setTab}
          tabs={TABS.map((t) => ({
            id: t.id,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </span>
            ),
          }))}
        />
      </div>

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
              <ImageField key={f.id} field={f} onChange={onFieldChange} />
            ))
          ) : (
            <p className="text-xs text-muted">
              No image fields in this template. Re-generate with a brief that
              suggests a hero image, or paste an image URL by adding a field
              named <code className="font-mono">bg_image</code> to the template.
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
              No advanced controls in this template. Re-generate or edit the
              prompt to ask the model for typography or visibility controls.
            </p>
          )}
        </div>
      )}

      {tab === "layout" && (
        <div className="space-y-4">
          <AlignmentField value={alignment} onChange={onAlignmentChange} />
        </div>
      )}
    </Card>
  );
}