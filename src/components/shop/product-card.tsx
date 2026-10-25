"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import { TAG_LABELS, type ProductCardData } from "@/lib/types";
import { useAddToCart } from "@/components/shop/use-add-to-cart";
import { cn } from "@/lib/utils";

const TAG_TONES = { BESTSELLER: "brand", NEW: "mango", SEASONAL: "melon" } as const;

export function ProductCard({
  product,
  priority,
  onOpen,
  className,
}: {
  product: ProductCardData;
  priority?: boolean;
  /** Optional: open a quick-view sheet instead of navigating (mobile menu). */
  onOpen?: (slug: string) => void;
  className?: string;
}) {
  const addToCart = useAddToCart();
  const tag = product.tags[0];
  const unavailable = !product.isAvailable;
  const href = `/product/${product.slug}`;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-card border border-white/60 bg-surface p-3 shadow-warm-soft transition duration-300 active:scale-[0.98] md:p-4",
        unavailable ? "opacity-70" : "hover:-translate-y-1 hover:shadow-warm",
        className,
      )}
      aria-label={product.name}
    >
      <Link
        href={href}
        onClick={(e) => {
          if (onOpen && window.matchMedia("(max-width: 767px)").matches) {
            e.preventDefault();
            onOpen(product.slug);
          }
        }}
        className="flex flex-1 flex-col after:absolute after:inset-0 after:rounded-card after:content-['']"
      >
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 300px"
              loading={priority ? "eager" : "lazy"}
              className={cn(
                "object-cover transition duration-500 group-hover:scale-105",
                unavailable && "grayscale",
              )}
            />
          )}
          {tag && !unavailable && (
            <Badge tone={TAG_TONES[tag]} className="absolute top-2 right-2 shadow-sm">
              {TAG_LABELS[tag]}
            </Badge>
          )}
          {unavailable && (
            <Badge tone="dark" className="absolute top-2 right-2">
              Unavailable
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-1 flex-col text-center">
          <p className="text-[10px] font-bold tracking-[0.15em] text-brand-deep uppercase">
            {product.categoryName}
          </p>
          <h3 className="mt-1 line-clamp-1 text-[15px] font-bold text-ink md:text-lg">{product.name}</h3>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-soft md:text-sm">{product.description}</p>
          )}
          <div className="mt-auto flex items-center justify-center gap-2 pt-3">
            <span className="text-lg font-extrabold text-ink">
              {product.fromPrice ? formatPaise(product.fromPrice) : "—"}
            </span>
            {product.rating && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-ink-soft">
                <Star className="size-3.5 fill-mango text-mango" aria-hidden />
                {product.rating}
                <span className="sr-only"> out of 5</span>
              </span>
            )}
          </div>
        </div>
      </Link>
      <Button
        size="sm"
        className="relative z-10 mt-3 w-full"
        disabled={unavailable || !product.defaultSize}
        onClick={(e) => {
          if (!product.defaultSize || product.defaultPrice === null) return;
          const origin = e.currentTarget;
          addToCart({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            image: product.image,
            size: product.defaultSize,
            sugar: "REGULAR",
            ice: "REGULAR",
            unitPrice: product.defaultPrice,
          }, origin);
        }}
        aria-label={unavailable ? `${product.name} is unavailable` : `Add ${product.name} to cart`}
      >
        {unavailable ? (
          "Unavailable"
        ) : (
          <>
            <Plus className="size-4" aria-hidden /> Add
          </>
        )}
      </Button>
    </article>
  );
}
