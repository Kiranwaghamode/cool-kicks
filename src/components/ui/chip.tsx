import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ChipProps = ComponentProps<"button"> & { active?: boolean; tone?: "brand" | "ice" };

const chipClass = (active?: boolean, tone: "brand" | "ice" = "brand") =>
  cn(
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-all active:scale-95 disabled:opacity-50",
    active
      ? tone === "ice"
        ? "border-ice-deep/30 bg-ice text-ice-deep"
        : "border-brand bg-brand text-white shadow-glow"
      : "border-line bg-surface text-ink hover:border-brand/40 hover:bg-cream-50",
  );

/** Filter pill. Active = brand green with glow. */
export function Chip({ active, tone, className, type = "button", ...props }: ChipProps) {
  return (
    <button type={type} aria-pressed={active} className={cn(chipClass(active, tone), className)} {...props} />
  );
}

export { chipClass };

/** Static, non-interactive chip (ingredients, tags). */
export function Tag({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-cream-50 px-3 py-1 text-xs font-semibold text-ink-soft",
        className,
      )}
      {...props}
    />
  );
}
