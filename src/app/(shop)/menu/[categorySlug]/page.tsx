import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuView } from "@/components/shop/menu-view";
import { getCategories } from "@/server/catalog";

export async function generateMetadata({ params }: PageProps<"/menu/[categorySlug]">): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = (await getCategories()).find((c) => c.slug === categorySlug);
  if (!category) return { title: "Menu" };
  return {
    title: `${category.name} – Menu`,
    description: category.description ?? `Order ${category.name} from Cool Kick.`,
    openGraph: category.image ? { images: [category.image] } : undefined,
  };
}

export default async function CategoryMenuPage({ params, searchParams }: PageProps<"/menu/[categorySlug]">) {
  const { categorySlug } = await params;
  const categories = await getCategories();
  if (!categories.some((c) => c.slug === categorySlug)) notFound();
  return <MenuView categorySlug={categorySlug} searchParams={await searchParams} />;
}
