import type { Metadata } from "next";
import { PolicyPage } from "@/components/shop/policy-page";
import { POLICY_LAST_UPDATED, refundSections } from "@/content/policies";
import { getShopName } from "@/server/brand";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return { title: "Cancellation & refund policy", description: `How cancellations and refunds work at ${name}.` };
}

export default async function RefundPolicyPage() {
  return (
    <PolicyPage
      title="Cancellation & Refund Policy"
      lastUpdated={POLICY_LAST_UPDATED}
      intro={<p>We want every drink to be perfect. Here&apos;s what happens if you need to cancel or something isn&apos;t right.</p>}
      sections={refundSections()}
    />
  );
}
