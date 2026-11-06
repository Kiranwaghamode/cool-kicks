import type { Metadata } from "next";
import { MenuView } from "@/components/shop/menu-view";
import { getShopName } from "@/server/brand";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return {
    title: "Menu",
    description:
      `Browse the full ${name} menu – fresh fruit juices, ice juices, mango, mojitos, milkshakes, smoothies and falooda.`,
  };
}

export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  return <MenuView searchParams={await searchParams} />;
}
