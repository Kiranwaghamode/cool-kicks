import { PageHeader } from "@/components/admin/ui";
import { CategoryManager } from "./category-manager";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireRole("categories");
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
  return (
    <>
      <PageHeader title="Categories" description="The order here is the order customers see on the menu." />
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          image: c.image ?? "",
          isActive: c.isActive,
          productCount: c._count.products,
        }))}
      />
    </>
  );
}
