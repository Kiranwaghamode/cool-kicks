import { PageHeader, StatTile } from "@/components/admin/ui";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { addDays, istDateKey, startOfDayIST } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { FinishedStockManager } from "./finished-stock-manager";

export const metadata = { title: "Finished stock" };

const EXPIRING_DAYS = 3;

export default async function FinishedStockPage({ searchParams }: PageProps<"/admin/finished-stock">) {
  await requireRole("batches");
  const sp = await searchParams;
  const show = sp.show === "all" ? "all" : "active";
  const now = new Date();
  const soon = addDays(now, EXPIRING_DAYS);

  const [variants, batches] = await Promise.all([
    db.productVariant.findMany({
      where: { wholesaleEnabled: true, product: { isActive: true } },
      orderBy: [{ product: { name: "asc" } }, { volumeMl: "asc" }],
      select: { id: true, size: true, volumeMl: true, wholesalePrice: true, product: { select: { name: true, recipe: { select: { ingredientId: true } } } } },
    }),
    db.batch.findMany({
      where: show === "all" ? {} : { quantityRemaining: { gt: 0 } },
      orderBy: [{ expiresAt: "asc" }],
      take: 500,
      include: { variant: { select: { size: true, product: { select: { name: true } } } } },
    }),
  ]);

  const live = batches.filter((b) => b.expiresAt > now);
  const stockValue = live.reduce((s, b) => s + b.quantityRemaining * (b.costPerUnit ?? 0), 0);
  const expiring = live.filter((b) => b.expiresAt <= soon && b.quantityRemaining > 0);
  const expired = batches.filter((b) => b.expiresAt <= now && b.quantityRemaining > 0);

  return (
    <>
      <PageHeader
        title="Finished stock"
        description="Bottled / packed products in batches. Wholesale orders take stock from the batch that expires first when they are confirmed."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Units in stock" value={live.reduce((s, b) => s + b.quantityRemaining, 0).toLocaleString("en-IN")} hint={`${live.length} live batches`} />
        <StatTile label="Stock value (at cost)" value={formatPaise(stockValue)} hint="Batches with a cost price" tone="ice" />
        <StatTile label={`Expiring in ${EXPIRING_DAYS} days`} value={expiring.length} hint={`${expiring.reduce((s, b) => s + b.quantityRemaining, 0)} units`} tone="mango" />
        <StatTile label="Expired, not written off" value={expired.length} hint={`${expired.reduce((s, b) => s + b.quantityRemaining, 0)} units`} tone="melon" />
      </div>
      <FinishedStockManager
        show={show}
        today={istDateKey(startOfDayIST())}
        variants={variants.map((v) => ({ id: v.id, label: `${v.product.name} · ${v.size.toLowerCase()} (${v.volumeMl} ml)`, hasRecipe: v.product.recipe.length > 0 }))}
        batches={batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          product: `${b.variant.product.name} · ${b.variant.size.toLowerCase()}`,
          manufacturedAt: b.manufacturedAt.toISOString(),
          expiresAt: b.expiresAt.toISOString(),
          produced: b.quantityProduced,
          remaining: b.quantityRemaining,
          costPerUnit: b.costPerUnit,
          state: b.expiresAt <= now ? "expired" : b.expiresAt <= soon ? "expiring" : "ok",
        }))}
      />
    </>
  );
}
