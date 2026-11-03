import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { BusinessStatus, BusinessType } from "@/lib/types";
import type { ActionResult } from "@/server/auth-guard";

/**
 * Business (wholesale customer) sessions.
 *
 * Separate from staff Auth.js on purpose: a business login can never reach /admin, and staff
 * sessions are untouched. The cookie holds a random token; only its sha256 is stored, so a
 * database leak doesn't leak sessions. Status (approved / suspended) is re-read on every request.
 */

const COOKIE = "ck_business";
const MAX_AGE_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const secureCookie = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

export async function createBusinessSession(businessId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * 86_400_000);
  await db.businessSession.create({ data: { tokenHash: hashToken(token), businessId, expiresAt } });
  // Housekeeping: drop this business's expired sessions.
  await db.businessSession.deleteMany({ where: { businessId, expiresAt: { lt: new Date() } } });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookie, path: "/", expires: expiresAt });
}

export async function destroyBusinessSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.businessSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}

/** Sign out every device except the current one (after a password change). */
export async function destroyOtherBusinessSessions(businessId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  await db.businessSession.deleteMany({
    where: { businessId, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) },
  });
}

export type BusinessSession = {
  id: string;
  legalName: string;
  tradeName: string | null;
  displayName: string;
  type: BusinessType;
  status: BusinessStatus;
  statusNote: string | null;
  contactName: string;
  phone: string;
  email: string | null;
  gstin: string | null;
  stateCode: string;
  groupId: string | null;
};

/** Current business user, or null. Cached per request. */
export const getBusiness = cache(async (): Promise<BusinessSession | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.businessSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      business: {
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          type: true,
          status: true,
          statusNote: true,
          contactName: true,
          phone: true,
          email: true,
          gstin: true,
          stateCode: true,
          groupId: true,
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const b = session.business;
  return { ...b, displayName: b.tradeName || b.legalName };
});

/** Pages: require a logged-in business. `approved` also requires an approved account. */
export async function requireBusiness(opts: { approved?: boolean; next?: string } = {}): Promise<BusinessSession> {
  const business = await getBusiness();
  if (!business) redirect(`/business/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (opts.approved && business.status !== "APPROVED") redirect("/business/account");
  return business;
}

export class BusinessAccessError extends Error {}

/** Server actions: like adminAction, but for business users. */
export async function businessAction<T>(
  opts: { approved?: boolean },
  fn: (business: BusinessSession) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const business = await getBusiness();
    if (!business) return { ok: false, error: "Your session has expired. Please log in again." };
    if (opts.approved && business.status !== "APPROVED")
      return { ok: false, error: "Your business account isn't approved for wholesale ordering yet." };
    return await fn(business);
  } catch (e) {
    if (e instanceof BusinessAccessError) return { ok: false, error: e.message };
    console.error("Business action failed", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
