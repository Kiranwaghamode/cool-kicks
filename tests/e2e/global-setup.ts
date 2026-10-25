import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { withDb, E2E_STAFF } from "./db";

const SNAPSHOT = path.join(__dirname, "..", "..", "test-results", "settings-snapshot.json");

/** Open the shop 24/7 for the test run, clear rate limits and ensure a STAFF test account. */
export default async function globalSetup() {
  await withDb(async (c) => {
    const { rows } = await c.query(`SELECT "openingHours", "isTemporarilyClosed", "pickupEnabled", "deliveryEnabled", "codEnabled", "payAtShopEnabled" FROM "ShopSettings" WHERE id = 1`);
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    if (!fs.existsSync(SNAPSHOT)) fs.writeFileSync(SNAPSHOT, JSON.stringify(rows[0]));
    const allDay = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { open: "00:00", close: "00:00", closed: false }]));
    await c.query(
      `UPDATE "ShopSettings" SET "openingHours" = $1, "isTemporarilyClosed" = false, "pickupEnabled" = true, "deliveryEnabled" = true, "codEnabled" = true, "payAtShopEnabled" = true WHERE id = 1`,
      [JSON.stringify(allDay)],
    );
    await c.query(`DELETE FROM "RateLimit"`);
    const hash = await bcrypt.hash(E2E_STAFF.password, 10);
    await c.query(
      `INSERT INTO "StaffUser" (id, name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
       VALUES ('e2e-staff', 'E2E Staff', $1, $2, 'STAFF', true, now(), now())
       ON CONFLICT (email) DO UPDATE SET "passwordHash" = $2, role = 'STAFF', "isActive" = true`,
      [E2E_STAFF.email, hash],
    );
  });
}
