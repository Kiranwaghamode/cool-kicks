import { PageHeader } from "@/components/admin/ui";
import { InventoryManager } from "./inventory-manager";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { summariseBatches } from "@/lib/ingredient-stock";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireRole("inventory");
  const ingredients = await db.ingredient.findMany({
    orderBy: { name: "asc" },
    include: {
      usedIn: { include: { product: { select: { id: true, name: true, isAvailable: true, isActive: true } } } },
      batches: { where: { quantityRemaining: { gt: 0 } }, select: { quantityRemaining: true, expiresAt: true } },
    },
  });
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Each stock delivery is a batch with its own expiry date. Orders use the earliest-expiring stock first; expired stock doesn't count, and drinks that need an ingredient with no usable stock show as sold out."
      />
      <InventoryManager
        ingredients={ingredients.map((i) => {
          const s = summariseBatches(i.batches.map((b) => ({ remaining: Number(b.quantityRemaining), expiresAt: b.expiresAt })));
          return {
            id: i.id,
            name: i.name,
            unit: i.unit,
            stock: s.usable,
            expired: s.expired,
            expiringSoon: s.expiringSoon,
            nextExpiry: s.nextExpiry?.toISOString() ?? null,
            threshold: Number(i.lowStockThreshold),
            updatedAt: i.updatedAt.toISOString(),
            products: i.usedIn.filter((u) => u.product.isActive).map((u) => ({ id: u.product.id, name: u.product.name, isAvailable: u.product.isAvailable })),
          };
        })}
      />
    </>
  );
}
