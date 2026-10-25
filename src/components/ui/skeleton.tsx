import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#f6efd9_0px,#fff8e6_120px,#f6efd9_240px)] bg-[length:800px_100%]",
        className,
      )}
      {...props}
    />
  );
}
