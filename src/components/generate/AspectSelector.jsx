"use client";

import { ASPECT_RATIOS } from "@/lib/models";
import Field from "./Field";
import ChipGroup from "./ChipGroup";

export default function AspectSelector({ value, onChange }) {
  return (
    <Field label="Aspect ratio">
      <ChipGroup
        options={ASPECT_RATIOS}
        value={value}
        onChange={onChange}
        getLabel={(o) => o.label}
      />
    </Field>
  );
}
