import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Signed, httpOnly cookie listing order numbers placed from this browser.
 * Lets the confirmation page show an order without asking for the phone again,
 * while strangers guessing order numbers still need number + phone (/track).
 */
const COOKIE = "ck_recent_orders";
const MAX = 10;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function parse(raw: string | undefined): string[] {
  if (!raw) return [];
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return [];
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];
  try {
    const list = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function rememberOrder(orderNumber: string) {
  const jar = await cookies();
  const list = [orderNumber, ...parse(jar.get(COOKIE)?.value).filter((n) => n !== orderNumber)].slice(0, MAX);
  const payload = Buffer.from(JSON.stringify(list)).toString("base64url");
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function isRecentOrder(orderNumber: string) {
  const jar = await cookies();
  return parse(jar.get(COOKIE)?.value).includes(orderNumber);
}
