import "dotenv/config";
import { Client } from "pg";

/** Small direct-DB helper for test setup (not used by the app). */
export async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: process.env.DATABASE_URL?.replace(/\?schema=\w+$/, "") });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export const clearRateLimits = () => withDb((c) => c.query(`DELETE FROM "RateLimit"`));

export const setTemporarilyClosed = (closed: boolean) =>
  withDb((c) => c.query(`UPDATE "ShopSettings" SET "isTemporarilyClosed" = $1 WHERE id = 1`, [closed]));

export const E2E_STAFF = { email: "e2e-staff@coolkick.test", password: "E2eStaff#2026" };
export const OWNER = { email: process.env.SEED_ADMIN_EMAIL ?? "owner@coolkick.in", password: process.env.SEED_ADMIN_PASSWORD ?? "" };
