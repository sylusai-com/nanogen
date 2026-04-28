// src/components/editor/RangeField.jsx
"use client";

import { Label } from "@/components/ui/Input";

export default function RangeField({ field, onChange }) {
  const min = Number(field.min ?? 0);
  const max = Number(field.max ?? 100);
  const step = Number(field.step ?? 1);
  const value = Number(field.value ?? min);
  const unit = field.unit || "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.id}>{field.label}</Label>
        <span className="font-mono text-[11px] text-muted-strong">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={field.id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(field.id, Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--primary)]"
      />
    </div>
  );
}
