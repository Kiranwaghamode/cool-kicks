import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { ProductTable } from "./product-table";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requireRole("products");
  const [products, categories] = await Promise.all([
    db.product.findMany({
      orderBy: [{ isActive: "desc" }, { category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: { select: { id: true, name: true } }, variants: { select: { price: true } } },
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.filter((p) => p.isActive).length} drinks on the menu`}
        actions={
          <LinkButton href="/admin/products/new">
            <Plus className="size-4" aria-hidden /> Add product
          </LinkButton>
        }
      />
      <ProductTable
        categories={categories}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.image,
          categoryId: p.category.id,
          categoryName: p.category.name,
          isAvailable: p.isAvailable,
          isActive: p.isActive,
          minPrice: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0,
          maxPrice: p.variants.length ? Math.max(...p.variants.map((v) => v.price)) : 0,
        }))}
      />
    </>
  );
}
