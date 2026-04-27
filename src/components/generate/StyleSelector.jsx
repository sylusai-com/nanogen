"use client";

import Field from "./Field";
import ChipGroup from "./ChipGroup";

export default function StyleSelector({ options, value, onChange }) {
  // `options` come from public.banner_styles — caller fetches them.
  const labels = (options || []).map((s) => s.label);
  return (
    <Field label="Style">
      <ChipGroup options={labels} value={value} onChange={onChange} />
    </Field>
  );
}
