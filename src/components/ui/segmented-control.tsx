"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
};

/** Radio group styled as a pill track (size, sugar, ice, pickup/delivery). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  name,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  name?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const groupName = name ?? id;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-1 rounded-full bg-cream p-1", className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              "relative flex flex-1 cursor-pointer flex-col items-center justify-center rounded-full px-3 text-center font-semibold transition-all has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand",
              size === "sm" ? "min-h-9 text-xs" : "min-h-11 text-sm",
              selected ? "bg-surface text-brand-deep shadow-warm-soft" : "text-ink-soft hover:text-ink",
              opt.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={groupName}
              value={opt.value}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
            {opt.hint && <span className="text-[11px] font-medium text-ink-muted">{opt.hint}</span>}
          </label>
        );
      })}
    </div>
  );
}
