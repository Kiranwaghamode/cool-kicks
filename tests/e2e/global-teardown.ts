import fs from "node:fs";
import path from "node:path";
import { withDb } from "./db";

const SNAPSHOT = path.join(__dirname, "..", "..", "test-results", "settings-snapshot.json");

/** Restore the shop settings captured in global setup. */
export default async function globalTeardown() {
  if (!fs.existsSync(SNAPSHOT)) return;
  const s = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
  await withDb(async (c) => {
    await c.query(
      `UPDATE "ShopSettings" SET "openingHours" = $1, "isTemporarilyClosed" = $2, "pickupEnabled" = $3, "deliveryEnabled" = $4, "codEnabled" = $5, "payAtShopEnabled" = $6 WHERE id = 1`,
      [JSON.stringify(s.openingHours), s.isTemporarilyClosed, s.pickupEnabled, s.deliveryEnabled, s.codEnabled, s.payAtShopEnabled],
    );
    await c.query(`DELETE FROM "RateLimit"`);
  });
  fs.rmSync(SNAPSHOT);
}
