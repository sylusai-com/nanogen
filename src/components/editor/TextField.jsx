"use client";

import { Input, Textarea, Label } from "@/components/ui/Input";

export default function TextField({ field, onChange }) {
  const isLong = field.id === "subhead";
  const Comp = isLong ? Textarea : Input;
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      <Comp
        id={field.id}
        value={field.value}
        onChange={(e) => onChange(field.id, e.target.value)}
        rows={isLong ? 3 : undefined}
      />
    </div>
  );
}
