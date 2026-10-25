import Link from "next/link";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

/** Brand mark from the Stitch design: leaf in a lime circle + wordmark + "Fresh & Chilled". */
export function Logo({
  className,
  href = "/",
  compact,
  centered,
}: {
  className?: string;
  href?: string;
  compact?: boolean;
  centered?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Cool Kick – home"
      className={cn("inline-flex items-center gap-2.5", centered && "flex-col gap-0.5 sm:flex-row sm:gap-2.5", className)}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_4px_12px_rgb(107_163_46/0.3)] md:size-11">
        <Leaf className="size-5" aria-hidden />
      </span>
      {!compact && (
        <span className={cn("flex flex-col leading-none", centered && "items-center sm:items-start")}>
          <span className="text-lg font-extrabold tracking-tight text-ink md:text-xl">COOL KICK</span>
          <span className="mt-1 text-[10px] font-bold tracking-[0.2em] text-brand-deep uppercase">
            Fresh &amp; Chilled
          </span>
        </span>
      )}
    </Link>
  );
}
