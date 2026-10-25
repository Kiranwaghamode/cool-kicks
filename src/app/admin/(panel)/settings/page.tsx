import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "./settings-form";
import { requireRole } from "@/server/auth-guard";
import { getShopSettings } from "@/server/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("settings");
  const s = await getShopSettings();
  return (
    <>
      <PageHeader title="Shop settings" description="Contact details, opening hours and ordering options shown across the website." />
      <SettingsForm
        initial={{
          shopName: s.shopName,
          tagline: s.tagline ?? "",
          phone: s.phone,
          whatsappNumber: s.whatsappNumber,
          email: s.email ?? "",
          address: s.address,
          mapEmbedUrl: s.mapEmbedUrl ?? "",
          mapLink: s.mapLink ?? "",
          instagramUrl: s.instagramUrl ?? "",
          facebookUrl: s.facebookUrl ?? "",
          openingHours: s.hours,
          isTemporarilyClosed: s.isTemporarilyClosed,
          closureMessage: s.closureMessage ?? "",
          minOrderAmount: s.minOrderAmount,
          estimatedPrepMins: s.estimatedPrepMins,
          pickupEnabled: s.pickupEnabled,
          deliveryEnabled: s.deliveryEnabled,
          codEnabled: s.codEnabled,
          payAtShopEnabled: s.payAtShopEnabled,
        }}
      />
    </>
  );
}
