import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-mango-soft text-tangerine [&_svg]:size-9">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
