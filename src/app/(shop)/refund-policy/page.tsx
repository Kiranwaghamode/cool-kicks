import type { Metadata } from "next";
import { PolicyPage } from "@/components/shop/policy-page";
import { POLICY_LAST_UPDATED, REFUND_SECTIONS } from "@/content/policies";

export const metadata: Metadata = { title: "Cancellation & refund policy", description: "How cancellations and refunds work at Cool Kick." };

export default function RefundPolicyPage() {
  return (
    <PolicyPage
      title="Cancellation & Refund Policy"
      lastUpdated={POLICY_LAST_UPDATED}
      intro={<p>We want every drink to be perfect. Here&apos;s what happens if you need to cancel or something isn&apos;t right.</p>}
      sections={REFUND_SECTIONS}
    />
  );
}
