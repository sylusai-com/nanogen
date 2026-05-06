"use client";

import { useState } from "react";
import { Settings2, Type } from "lucide-react";
import { cn } from "@/lib/cn";
import PropertiesPanel from "./PropertiesPanel";
import EditorPanel from "@/components/editor/EditorPanel";

const TABS = [
  { id: "properties", icon: Settings2, label: "Properties" },
  { id: "fields",     icon: Type,      label: "Fields" },
];

export default function RightPanel({
  element,
  onChange,
  fields,
  alignment,
  onFieldChange,
  onAlignmentChange,
}) {
  const [tab, setTab] = useState("properties");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border bg-surface/70 backdrop-blur">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-border px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-semibold uppercase tracking-widest transition-colors",
              tab === t.id
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "properties" ? (
          <PropertiesPanel element={element} onChange={onChange} />
        ) : (
          <div className="p-3">
            <EditorPanel
              fields={fields}
              alignment={alignment}
              onFieldChange={onFieldChange}
              onAlignmentChange={onAlignmentChange}
            />
          </div>
        )}
      </div>
    </aside>
  );
}