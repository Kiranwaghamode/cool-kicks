"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { chipClass } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

type Category = { slug: string; name: string };

const SORTS = [
  { value: "popular", label: "Popular" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** Search box, sticky category chips and sort – all state lives in the URL. */
export function MenuControls({
  categories,
  activeCategory,
}: {
  categories: Category[];
  activeCategory?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const sort = params.get("sort") ?? "popular";
  const first = useRef(true);

  // Debounced search -> URL
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setSort(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "popular") next.delete("sort");
    else next.set("sort", value);
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }

  /** Category links keep the current search + sort. */
  function categoryHref(slug?: string) {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (sort !== "popular") next.set("sort", sort);
    const base = slug ? `/menu/${slug}` : "/menu";
    return next.size ? `${base}?${next}` : base;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="menu-search" className="sr-only">
            Search the menu
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id="menu-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mango, mojito, falooda…"
            className="h-12 w-full rounded-full border-[1.5px] border-line-strong bg-surface pr-12 pl-13 text-[15px] outline-none placeholder:text-ink-muted focus:border-brand focus:ring-4 focus:ring-brand/15"
            enterKeyHint="search"
          />
          {pending ? (
            <Loader2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-brand" aria-label="Loading" />
          ) : (
            q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-cream"
              >
                <X className="size-4" />
              </button>
            )
          )}
        </div>
        <div className="relative sm:w-56">
          <label htmlFor="menu-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="menu-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-12 w-full appearance-none rounded-full border-[1.5px] border-line-strong bg-surface px-5 text-[15px] font-semibold outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav
        aria-label="Categories"
        className="sticky top-16 z-30 -mx-4 bg-cream-50/95 px-4 py-2 backdrop-blur md:top-20 md:mx-0 md:px-0"
      >
        <ul className="no-scrollbar flex gap-2 overflow-x-auto">
          <li>
            <Link href={categoryHref()} scroll={false} aria-current={!activeCategory ? "page" : undefined} className={chipClass(!activeCategory)}>
              All
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={categoryHref(c.slug)}
                scroll={false}
                aria-current={activeCategory === c.slug ? "page" : undefined}
                className={cn(chipClass(activeCategory === c.slug))}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
