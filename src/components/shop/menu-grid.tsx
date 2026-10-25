"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/shop/product-card";
import { BottomSheet } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ProductConfigurator, type ConfigurableProduct } from "@/components/shop/product-configurator";
import type { ProductCardData } from "@/lib/types";

type QuickProduct = ConfigurableProduct & { description: string | null; category: { name: string } };

/** Product grid; on phones a tap opens a quick-view bottom sheet instead of a full page. */
export function MenuGrid({ products }: { products: ProductCardData[] }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<QuickProduct | null>(null);
  const [error, setError] = useState(false);

  async function open(s: string) {
    setSlug(s);
    setData(null);
    setError(false);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(s)}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 4} onOpen={open} />
        ))}
      </div>

      <BottomSheet open={!!slug} onClose={() => setSlug(null)} title={data?.name ?? "Loading drink"}>
        {error ? (
          <p className="py-8 text-center text-ink-soft">
            Couldn&apos;t load this drink.{" "}
            {slug && (
              <Link href={`/product/${slug}`} className="font-bold text-brand-deep underline">
                Open the full page
              </Link>
            )}
          </p>
        ) : !data ? (
          <div className="space-y-4 pt-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            <div className="flex gap-4">
              {data.image && (
                <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-cream">
                  <Image src={data.image} alt={data.name} fill sizes="96px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.15em] text-brand-deep uppercase">{data.category.name}</p>
                <p className="text-lg leading-tight font-bold">{data.name}</p>
                {data.description && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{data.description}</p>}
                {!data.isAvailable && (
                  <Badge tone="danger" className="mt-1">
                    Unavailable
                  </Badge>
                )}
                <Link href={`/product/${data.slug}`} className="mt-1 inline-block text-sm font-bold text-brand-deep underline-offset-2 hover:underline">
                  View details
                </Link>
              </div>
            </div>
            <ProductConfigurator product={data} variant="sheet" onAdded={() => setSlug(null)} />
          </div>
        )}
      </BottomSheet>
    </>
  );
}
