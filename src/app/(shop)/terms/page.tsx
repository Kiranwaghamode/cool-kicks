import type { Metadata } from "next";
import { PolicyPage } from "@/components/shop/policy-page";
import { POLICY_LAST_UPDATED, termsSections } from "@/content/policies";
import { getShopName } from "@/server/brand";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return { title: "Terms of service", description: `Terms for ordering from ${name}.` };
}

export default async function TermsPage() {
  const shopName = await getShopName();
  return (
    <PolicyPage
      title="Terms of Service"
      lastUpdated={POLICY_LAST_UPDATED}
      intro={<p>Please read these terms before placing an order. They explain how ordering, payment, pickup and delivery work.</p>}
      sections={termsSections(shopName)}
    />
  );
}
