"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = { value: T; label: string; count?: number };

/** Accessible tab list (arrow keys move between tabs). Render panels yourself based on `value`. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].value);
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-cream p-1", className)}
    >
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-all",
              selected ? "bg-brand text-white shadow-glow" : "text-ink-soft hover:bg-surface hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 text-xs leading-5",
                  selected ? "bg-white/25 text-white" : "bg-surface text-ink-soft",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
