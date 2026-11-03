import type { ComponentProps } from "react";
import { Select } from "@/components/ui/field";
import { GST_STATES } from "@/lib/gst";

/** Indian state / UT picker; the value is the 2-digit GST state code. */
export function StateSelect(props: Omit<ComponentProps<typeof Select>, "children">) {
  return (
    <Select {...props}>
      <option value="">Choose a state</option>
      {GST_STATES.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
