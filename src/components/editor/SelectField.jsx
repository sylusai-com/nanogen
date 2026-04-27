"use client";

import Select from "@/components/ui/Select";
import { Label } from "@/components/ui/Input";

export default function SelectField({ field, onChange }) {
  const options = Array.isArray(field.options) ? field.options : [];
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      <Select
        id={field.id}
        value={field.value}
        onChange={(e) => onChange(field.id, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label || o.value}
          </option>
        ))}
      </Select>
    </div>
  );
}
