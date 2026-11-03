"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, PackageSearch, Plus, Search, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { normalizeQuantity, useBulkCart, useBulkCartCount } from "@/lib/bulk-cart-store";
import { formatRate } from "@/lib/gst";
import { formatPaise } from "@/lib/money";
import { SIZE_LABELS } from "@/lib/types";
import type { WholesaleProduct } from "@/server/wholesale";
import { cn } from "@/lib/utils";

type Variant = WholesaleProduct["variants"][number];

function VariantRow({ product, v }: { product: WholesaleProduct; v: Variant }) {
  const add = useBulkCart((s) => s.add);
  const inCart = useBulkCart((s) => s.lines.find((l) => l.variantId === v.id)?.quantity ?? 0);
  const step = Math.max(1, v.packSize);
  const min = normalizeQuantity(v.moq, v.packSize, v.moq);
  const [qty, setQty] = useState(min);

  return (
    <li className="rounded-2xl border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {SIZE_LABELS[v.size]} · {v.volumeMl} ml
          </p>
          <p className="text-xs text-ink-muted">
            {v.packaging || (v.packSize > 1 ? `Pack of ${v.packSize}` : "Single units")} · MOQ {v.moq}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold tabular-nums text-brand-deep">{formatPaise(v.unitPrice)}</p>
          <p className="text-[11px] text-ink-muted">per unit + {formatRate(product.gstRateBps)} GST</p>
          {v.special ? <Badge tone="mango">Your special price</Badge> : v.listPrice > v.unitPrice ? <span className="text-xs text-ink-muted line-through">{formatPaise(v.listPrice)}</span> : null}
        </div>
      </div>
      {v.tiers.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Volume discounts">
          {v.tiers.map((t) => (
            <li key={t.minQuantity} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
              {t.minQuantity}+ units: {formatPaise(t.unitPrice)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={cn("text-xs font-semibold", v.stock > 0 ? "text-brand-deep" : "text-ink-muted")}>{v.stock > 0 ? `Ready stock: ${v.stock}` : "Made to order"}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line-strong bg-surface">
            <button type="button" aria-label="Fewer" disabled={qty <= min} onClick={() => setQty((q) => Math.max(min, q - step))} className="flex size-9 items-center justify-center rounded-full hover:bg-cream disabled:opacity-40">
              <Minus className="size-4" />
            </button>
            <label htmlFor={`q-${v.id}`} className="sr-only">
              Quantity for {product.name} {SIZE_LABELS[v.size]}
            </label>
            <input
              id={`q-${v.id}`}
              type="number"
              inputMode="numeric"
              min={min}
              step={step}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || min)}
              onBlur={() => setQty((q) => normalizeQuantity(q, v.packSize, v.moq))}
              className="w-16 bg-transparent text-center font-bold tabular-nums outline-none"
            />
            <button type="button" aria-label="More" onClick={() => setQty((q) => q + step)} className="flex size-9 items-center justify-center rounded-full hover:bg-cream">
              <Plus className="size-4" />
            </button>
          </div>
          <Button
            size="sm"
            disabled={!v.available}
            onClick={() => {
              const quantity = normalizeQuantity(qty, v.packSize, v.moq);
              add({
                variantId: v.id,
                productId: product.id,
                slug: product.slug,
                name: product.name,
                image: product.image,
                size: v.size,
                volumeMl: v.volumeMl,
                packSize: v.packSize,
                moq: v.moq,
                packaging: v.packaging,
                quantity,
                unitPrice: v.unitPrice,
              });
              toast.success("Added to bulk cart", `${quantity} × ${product.name} (${SIZE_LABELS[v.size]})`);
            }}
          >
            {v.available ? "Add" : "Unavailable"}
          </Button>
        </div>
      </div>
      {inCart > 0 && <p className="mt-2 text-xs font-semibold text-brand-deep">{inCart} in your cart</p>}
    </li>
  );
}

export function CatalogueView({ products, minOrder, paused }: { products: WholesaleProduct[]; minOrder: number; paused: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const cartCount = useBulkCartCount();

  const categories = useMemo(() => [...new Map(products.map((p) => [p.categorySlug, p.categoryName])).entries()], [products]);
  const shown = products.filter(
    (p) => (cat === "all" || p.categorySlug === cat) && (!q.trim() || `${p.name} ${p.categoryName} ${p.description ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Wholesale catalogue</h1>
          <p className="text-ink-soft">
            Your prices, per unit and before GST.{minOrder > 0 && ` Minimum order ${formatPaise(minOrder)}.`}
          </p>
        </div>
        {cartCount > 0 && (
          <LinkButton href="/business/cart">
            <ShoppingCart className="size-4" aria-hidden /> View bulk cart ({cartCount})
          </LinkButton>
        )}
      </div>

      {paused && <p className="mb-4 rounded-2xl bg-mango-soft px-4 py-3 font-semibold text-warning">Wholesale ordering is paused right now. You can still browse and request quotations.</p>}

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <label htmlFor="cat-q" className="sr-only">
            Search products
          </label>
          <Input id="cat-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-11" />
        </div>
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-cream p-1" role="group" aria-label="Category">
          {[["all", "All"] as const, ...categories].map(([slug, name]) => (
            <button
              key={slug}
              type="button"
              aria-pressed={cat === slug}
              onClick={() => setCat(slug)}
              className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap", cat === slug ? "bg-brand text-white shadow-glow" : "text-ink-soft hover:bg-surface")}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState icon={<PackageSearch />} title="No wholesale products yet" description="We're setting up the wholesale range. Please check back soon or contact us." action={<LinkButton href="/contact">Contact us</LinkButton>} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<Search />} title="No matches" description="Try another search or category." />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-col rounded-card bg-surface p-4 shadow-warm-soft">
              <div className="flex gap-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-cream">
                  {p.image && <Image src={p.image} alt="" fill sizes="80px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-wide text-tangerine uppercase">{p.categoryName}</p>
                  <h2 className="text-lg leading-tight font-bold">{p.name}</h2>
                  <p className="text-xs text-ink-muted">
                    GST {formatRate(p.gstRateBps)}
                    {p.hsnCode ? ` · HSN ${p.hsnCode}` : ""}
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {p.variants.map((v) => (
                  <VariantRow key={v.id} product={p} v={v} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-center text-sm text-ink-muted">
        Need a large or custom order? Add items to your cart and{" "}
        <Link href="/business/cart" className="font-bold text-brand-deep underline">
          request a quotation
        </Link>
        .
      </p>
    </div>
  );
}
