"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Textarea } from "@/components/ui/field";
import { AnimatedPrice } from "@/components/shop/animated-price";
import { useAddToCart } from "@/components/shop/use-add-to-cart";
import { MAX_LINE_QUANTITY } from "@/lib/cart-store";
import { SIZE_LABELS, type Level, type Size } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ConfigurableProduct = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  isAvailable: boolean;
  allowSugarChoice: boolean;
  allowIceChoice: boolean;
  variants: { size: Size; volumeMl: number; price: number; isAvailable: boolean }[];
};

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "LESS", label: "Less" },
  { value: "REGULAR", label: "Regular" },
  { value: "EXTRA", label: "Extra" },
];

export function ProductConfigurator({
  product,
  variant = "page",
  onAdded,
}: {
  product: ConfigurableProduct;
  /** "page": sticky bar at the bottom of the viewport on mobile. "sheet": bar inside the bottom sheet. */
  variant?: "page" | "sheet";
  onAdded?: () => void;
}) {
  const addToCart = useAddToCart();
  const available = product.variants.filter((v) => v.isAvailable);
  const initial = available.find((v) => v.size === "MEDIUM") ?? available[0];
  const [size, setSize] = useState<Size | undefined>(initial?.size);
  const [sugar, setSugar] = useState<Level>("REGULAR");
  const [ice, setIce] = useState<Level>("REGULAR");
  const [instructions, setInstructions] = useState("");
  const [qty, setQty] = useState(1);

  const selected = product.variants.find((v) => v.size === size);
  const canAdd = product.isAvailable && !!selected?.isAvailable;
  const total = (selected?.price ?? 0) * qty;

  function add(origin?: HTMLElement | null) {
    if (!selected || !canAdd) return;
    addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      size: selected.size,
      sugar: product.allowSugarChoice ? sugar : "REGULAR",
      ice: product.allowIceChoice ? ice : "REGULAR",
      instructions,
      quantity: qty,
      unitPrice: selected.price,
    }, origin);
    setQty(1);
    setInstructions("");
    onAdded?.();
  }

  const id = `cfg-${product.slug}`;

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Choose size</legend>
        <SegmentedControl
          label="Size"
          value={size ?? "MEDIUM"}
          onChange={setSize}
          options={product.variants.map((v) => ({
            value: v.size,
            label: `${SIZE_LABELS[v.size]}`,
            hint: `${v.volumeMl} ml · ₹${v.price / 100}`,
            disabled: !v.isAvailable || !product.isAvailable,
          }))}
        />
      </fieldset>

      {product.allowSugarChoice && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Sugar</legend>
          <SegmentedControl label="Sugar level" size="sm" value={sugar} onChange={setSugar} options={LEVEL_OPTIONS} />
        </fieldset>
      )}

      {product.allowIceChoice && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Ice</legend>
          <SegmentedControl
            label="Ice level"
            size="sm"
            value={ice}
            onChange={setIce}
            options={LEVEL_OPTIONS}
            className="bg-ice/70"
          />
        </fieldset>
      )}

      <div>
        <label htmlFor={`${id}-notes`} className="mb-2 block text-sm font-bold">
          Special instructions <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <Textarea
          id={`${id}-notes`}
          value={instructions}
          maxLength={200}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="E.g. no straw, add black salt…"
          className="min-h-20"
        />
      </div>

      <div
        className={cn(
          "flex items-center gap-3",
          variant === "page" &&
            "glass fixed inset-x-0 bottom-[68px] z-30 border-t border-white/70 px-4 py-3 shadow-sheet md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
          variant === "sheet" && "sticky bottom-0 -mx-5 border-t border-line bg-surface px-5 pt-4 pb-1",
        )}
      >
        <QuantityStepper value={qty} onChange={setQty} max={MAX_LINE_QUANTITY} />
        <Button size="lg" className="flex-1 px-4" disabled={!canAdd} onClick={(e) => add(e.currentTarget)} data-add-to-cart>
          {canAdd ? (
            <>
              <ShoppingBag className="size-5" aria-hidden />
              <span>Add</span>
              <span aria-hidden>·</span>
              <AnimatedPrice value={total} />
            </>
          ) : (
            "Currently unavailable"
          )}
        </Button>
      </div>
    </div>
  );
}
