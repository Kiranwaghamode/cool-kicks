import { PageHeader } from "@/components/admin/ui";
import { InventoryManager } from "./inventory-manager";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireRole("inventory");
  const ingredients = await db.ingredient.findMany({
    orderBy: { name: "asc" },
    include: { usedIn: { include: { product: { select: { id: true, name: true, isAvailable: true, isActive: true } } } } },
  });
  return (
    <>
      <PageHeader title="Inventory" description="Stock is deducted automatically when an order is confirmed, and added back if it's cancelled." />
      <InventoryManager
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          stock: Number(i.currentStock),
          threshold: Number(i.lowStockThreshold),
          updatedAt: i.updatedAt.toISOString(),
          products: i.usedIn.filter((u) => u.product.isActive).map((u) => ({ id: u.product.id, name: u.product.name, isAvailable: u.product.isAvailable })),
        }))}
      />
    </>
  );
}
