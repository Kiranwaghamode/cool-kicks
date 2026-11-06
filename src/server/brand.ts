import "server-only";
import { cache } from "react";
import { DEFAULT_SHOP_NAME } from "@/lib/brand";
import { getShopSettings } from "@/server/settings";

/** Shop name from Admin → Settings (cached per request). Falls back to the default if the DB can't be read. */
export const getShopName = cache(async (): Promise<string> => {
  try {
    return (await getShopSettings()).shopName || DEFAULT_SHOP_NAME;
  } catch {
    return DEFAULT_SHOP_NAME;
  }
});
