import type { Metadata } from "next";
import { PolicyPage } from "@/components/shop/policy-page";
import { POLICY_LAST_UPDATED, TERMS_SECTIONS } from "@/content/policies";

export const metadata: Metadata = { title: "Terms of service", description: "Terms for ordering from Cool Kick." };

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      lastUpdated={POLICY_LAST_UPDATED}
      intro={<p>Please read these terms before placing an order. They explain how ordering, payment, pickup and delivery work.</p>}
      sections={TERMS_SECTIONS}
    />
  );
}
