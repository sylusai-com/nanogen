"use client";

import Switch from "@/components/ui/Switch";

export default function ToggleField({ field, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-sm text-foreground">{field.label}</div>
        {field.selector && (
          <div className="truncate font-mono text-[10px] text-muted">
            {field.selector}
          </div>
        )}
      </div>
      <Switch
        checked={!!field.value}
        onChange={(v) => onChange(field.id, v)}
      />
    </div>
  );
}
