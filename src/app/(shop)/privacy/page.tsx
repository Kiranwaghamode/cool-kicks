import type { Metadata } from "next";
import { PolicyPage } from "@/components/shop/policy-page";
import { POLICY_LAST_UPDATED, PRIVACY_SECTIONS } from "@/content/policies";

export const metadata: Metadata = { title: "Privacy policy", description: "How Cool Kick collects, uses and protects your information." };

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      lastUpdated={POLICY_LAST_UPDATED}
      intro={<p>We respect your privacy. This page explains what information we collect when you order from Cool Kick and how we look after it.</p>}
      sections={PRIVACY_SECTIONS}
    />
  );
}
