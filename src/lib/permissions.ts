import type { Role } from "@/lib/types";

/** Which roles may use each admin area. Checked on the server (requireRole) and used to hide nav links. */
export const ACCESS = {
  dashboard: ["OWNER", "MANAGER", "STAFF"],
  orders: ["OWNER", "MANAGER", "STAFF"],
  ordersRefund: ["OWNER", "MANAGER"],
  products: ["OWNER", "MANAGER"],
  categories: ["OWNER", "MANAGER"],
  inventory: ["OWNER", "MANAGER"],
  coupons: ["OWNER", "MANAGER"],
  deliveryZones: ["OWNER", "MANAGER"],
  reviews: ["OWNER", "MANAGER"],
  messages: ["OWNER", "MANAGER"],
  reports: ["OWNER", "MANAGER"],
  staff: ["OWNER"],
  settings: ["OWNER"],
  shopToggle: ["OWNER", "MANAGER"],
  // ── Wholesale (B2B) ──
  businesses: ["OWNER", "MANAGER"],
  credit: ["OWNER", "MANAGER"],
  pricing: ["OWNER", "MANAGER"],
  quotations: ["OWNER", "MANAGER"],
  /** Record payments against orders (like "mark paid"). */
  payments: ["OWNER", "MANAGER", "STAFF"],
  paymentsRefund: ["OWNER", "MANAGER"],
  invoices: ["OWNER", "MANAGER", "STAFF"],
  deliveries: ["OWNER", "MANAGER", "STAFF"],
  batches: ["OWNER", "MANAGER"],
  auditLog: ["OWNER"],
} as const satisfies Record<string, readonly Role[]>;

export type Area = keyof typeof ACCESS;

export function can(role: Role | undefined | null, area: Area) {
  return !!role && (ACCESS[area] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = { OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" };
