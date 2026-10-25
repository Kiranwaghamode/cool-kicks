import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/content/faq";

/** Accessible accordion using native <details>. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details key={item.q} className="group rounded-2xl bg-surface shadow-warm-soft open:shadow-warm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown className="size-5 shrink-0 text-brand-deep transition group-open:rotate-180" aria-hidden />
          </summary>
          <p className="px-5 pb-5 text-ink-soft">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
