// src/components/generate/AspectSelector.jsx
"use client";

import Field from "./Field";
import ChipGroup from "./ChipGroup";

export default function AspectSelector({ options, value, onChange }) {
  // `options` come from public.aspect_ratios — caller fetches them.
  const opts = (options || []).map((o) => ({
    id: o.ratio,
    label: o.label,
  }));
  return (
    <Field label="Aspect ratio">
      <ChipGroup
        options={opts}
        value={value}
        onChange={onChange}
        getLabel={(o) => o.label}
      />
    </Field>
  );
}
