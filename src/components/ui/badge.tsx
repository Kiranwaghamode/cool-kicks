import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "brand"
  | "mango"
  | "melon"
  | "ice"
  | "neutral"
  | "danger"
  | "dark"
  | "success"
  | "warning";

const tones: Record<BadgeTone, string> = {
  brand: "bg-brand text-white",
  mango: "bg-tangerine text-white",
  melon: "bg-melon-deep text-white",
  ice: "bg-ice text-ice-deep",
  neutral: "bg-cream text-ink-soft",
  danger: "bg-danger-soft text-danger",
  success: "bg-brand-soft text-brand-deep",
  warning: "bg-mango-soft text-warning",
  dark: "bg-ink text-white",
};

export function Badge({
  tone = "brand",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-bold tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Small uppercase eyebrow label used above section titles ("• OUR MENU •"). */
export function Eyebrow({ className, children, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-tangerine uppercase",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
    </p>
  );
}
