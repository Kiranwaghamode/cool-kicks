import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  action,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  align?: "center" | "left";
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-2 md:mb-10",
        align === "center" ? "items-center text-center" : "items-start md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-2", align === "center" && "items-center")}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Tag className="text-headline-sm font-extrabold text-ink md:text-headline">{title}</Tag>
        {subtitle && <p className="max-w-xl text-ink-soft md:text-lg">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
