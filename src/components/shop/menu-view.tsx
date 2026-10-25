import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { MenuControls } from "@/components/shop/menu-controls";
import { MenuGrid } from "@/components/shop/menu-grid";
import { getCategories, getMenuProducts, type MenuSort } from "@/server/catalog";

const SORTS: MenuSort[] = ["popular", "price-asc", "price-desc"];

export async function MenuView({
  categorySlug,
  searchParams,
}: {
  categorySlug?: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const sortParam = typeof searchParams.sort === "string" ? searchParams.sort : "popular";
  const sort = (SORTS.includes(sortParam as MenuSort) ? sortParam : "popular") as MenuSort;
  // ?category= is also supported (shareable links from older menus)
  const slug = categorySlug ?? (typeof searchParams.category === "string" ? searchParams.category : undefined);

  const [categories, products] = await Promise.all([
    getCategories(),
    getMenuProducts({ categorySlug: slug, q, sort }),
  ]);
  const category = categories.find((c) => c.slug === slug);

  return (
    <div className="container-page py-8 md:py-12">
      <header className="mb-6 text-center md:mb-8 md:text-left">
        <p className="text-xs font-bold tracking-[0.18em] text-tangerine uppercase">Our menu</p>
        <h1 className="mt-1 text-headline-sm font-extrabold md:text-headline">{category ? category.name : "Full Menu"}</h1>
        <p className="mt-1 text-ink-soft">
          {category?.description ?? "Fresh juices, ice juices, mojitos, shakes and falooda – made to order."}
        </p>
      </header>

      <Suspense>
        <MenuControls categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} activeCategory={slug} />
      </Suspense>

      <p className="mt-4 mb-4 text-sm text-ink-soft" aria-live="polite">
        {products.length} {products.length === 1 ? "drink" : "drinks"}
        {q ? (
          <>
            {" "}
            for “<span className="font-semibold text-ink">{q}</span>”
          </>
        ) : null}
      </p>

      {products.length ? (
        <MenuGrid products={products} />
      ) : (
        <EmptyState
          icon={<SearchX />}
          title="Nothing matches that"
          description={q ? `We couldn't find any drinks for “${q}”. Try another flavour or browse all categories.` : "No drinks in this category right now."}
          action={<LinkButton href="/menu">See the full menu</LinkButton>}
        />
      )}
    </div>
  );
}
