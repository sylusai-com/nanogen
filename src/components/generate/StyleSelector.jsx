"use client";

import { STYLES } from "@/lib/models";
import Field from "./Field";
import ChipGroup from "./ChipGroup";

export default function StyleSelector({ value, onChange }) {
  return (
    <Field label="Style">
      <ChipGroup options={STYLES} value={value} onChange={onChange} />
    </Field>
  );
}
