import type { Metadata } from "next";
import { MenuView } from "@/components/shop/menu-view";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Browse the full Cool Kick menu – fresh fruit juices, ice juices, mango, mojitos, milkshakes, smoothies and falooda.",
};

export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  return <MenuView searchParams={await searchParams} />;
}
