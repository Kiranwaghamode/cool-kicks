import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "./product-form";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Edit product" };

export default async function ProductEditPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireRole("products");
  const { id } = await params;
  const isNew = id === "new";
  const [product, categories, ingredients] = await Promise.all([
    isNew ? null : db.product.findUnique({ where: { id }, include: { variants: true, recipe: true } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);
  if (!isNew && !product) notFound();

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-brand-deep">
        <ChevronLeft className="size-4" aria-hidden /> Products
      </Link>
      <PageHeader title={isNew ? "Add product" : `Edit ${product!.name}`} />
      <ProductForm
        categories={categories}
        ingredients={ingredients}
        initial={
          product
            ? {
                id: product.id,
                name: product.name,
                slug: product.slug,
                categoryId: product.categoryId,
                description: product.description ?? "",
                image: product.image ?? "",
                ingredients: product.ingredients,
                tags: product.tags,
                allowSugarChoice: product.allowSugarChoice,
                allowIceChoice: product.allowIceChoice,
                isAvailable: product.isAvailable,
                sortOrder: product.sortOrder,
                variants: product.variants.map((v) => ({ size: v.size, volumeMl: v.volumeMl, price: v.price, isAvailable: v.isAvailable })),
                recipe: product.recipe.map((r) => ({ ingredientId: r.ingredientId, quantityPerUnit: Number(r.quantityPerUnit) })),
              }
            : null
        }
      />
    </>
  );
}
