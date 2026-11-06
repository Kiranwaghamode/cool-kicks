import type { Metadata } from "next";
import { PolicyPage } from "@/components/shop/policy-page";
import { POLICY_LAST_UPDATED, privacySections } from "@/content/policies";
import { getShopName } from "@/server/brand";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return { title: "Privacy policy", description: `How ${name} collects, uses and protects your information.` };
}

export default async function PrivacyPage() {
  const shopName = await getShopName();
  return (
    <PolicyPage
      title="Privacy Policy"
      lastUpdated={POLICY_LAST_UPDATED}
      intro={<p>We respect your privacy. This page explains what information we collect when you order from {shopName} and how we look after it.</p>}
      sections={privacySections(shopName)}
    />
  );
}
