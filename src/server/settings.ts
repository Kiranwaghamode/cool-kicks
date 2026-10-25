import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getShopStatus, parseOpeningHours } from "@/lib/shop-hours";

/** Shop settings (single row). Cached per request. */
export const getShopSettings = cache(async () => {
  const s = await db.shopSettings.findUnique({ where: { id: 1 } });
  if (!s) throw new Error("ShopSettings row missing – run `npm run db:seed`.");
  return { ...s, hours: parseOpeningHours(s.openingHours) };
});

export type ShopSettingsData = Awaited<ReturnType<typeof getShopSettings>>;

/** Public, non-sensitive subset safe to send to client components. */
export async function getPublicShopInfo() {
  const s = await getShopSettings();
  const status = getShopStatus(s);
  return {
    shopName: s.shopName,
    tagline: s.tagline,
    phone: s.phone,
    whatsappNumber: s.whatsappNumber,
    email: s.email,
    address: s.address,
    mapEmbedUrl: s.mapEmbedUrl,
    mapLink: s.mapLink,
    hours: s.hours,
    status,
    minOrderAmount: s.minOrderAmount,
    pickupEnabled: s.pickupEnabled,
    deliveryEnabled: s.deliveryEnabled,
    codEnabled: s.codEnabled,
    payAtShopEnabled: s.payAtShopEnabled,
    estimatedPrepMins: s.estimatedPrepMins,
    instagramUrl: s.instagramUrl,
    facebookUrl: s.facebookUrl,
  };
}

export type PublicShopInfo = Awaited<ReturnType<typeof getPublicShopInfo>>;
