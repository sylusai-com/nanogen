"use client";

import { Type, Palette, LayoutPanelLeft } from "lucide-react";
import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import Card from "@/components/ui/Card";
import TextField from "./TextField";
import ColorField from "./ColorField";
import AlignmentField from "./AlignmentField";

export default function EditorPanel({ fields, alignment, onFieldChange, onAlignmentChange }) {
  const [tab, setTab] = useState("text");
  const textFields = fields.filter((f) => f.type === "text");
  const colorFields = fields.filter((f) => f.type === "color");

  return (
    <Card elevated className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Properties</h3>
        <Tabs
          size="sm"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "text", label: <span className="inline-flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> Text</span> },
            { id: "colors", label: <span className="inline-flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Colors</span> },
            { id: "layout", label: <span className="inline-flex items-center gap-1.5"><LayoutPanelLeft className="h-3.5 w-3.5" /> Layout</span> },
          ]}
        />
      </div>

      {tab === "text" && (
        <div className="space-y-4">
          {textFields.map((f) => (
            <TextField key={f.id} field={f} onChange={onFieldChange} />
          ))}
        </div>
      )}

      {tab === "colors" && (
        <div className="space-y-4">
          {colorFields.map((f) => (
            <ColorField key={f.id} field={f} onChange={onFieldChange} />
          ))}
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
