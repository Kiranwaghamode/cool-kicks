import type { Level, Size } from "@/lib/types";

/** A cart line is unique by product + size + sugar + ice + instructions. */
export function lineKey(l: { productId: string; size: Size; sugar: Level; ice: Level; instructions: string }) {
  return [l.productId, l.size, l.sugar, l.ice, l.instructions.trim().toLowerCase()].join("|");
}
