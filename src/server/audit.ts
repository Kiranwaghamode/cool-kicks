import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { clientIp } from "@/server/rate-limit";

type Tx = Prisma.TransactionClient | typeof db;

export type AuditActor = { staffId: string } | { businessId: string } | "system";

/**
 * Record an important action (approvals, credit changes, payments, invoices, price changes…).
 * Pass the transaction client when the action runs inside one so the log commits with it.
 */
export async function audit(
  actor: AuditActor,
  entry: { action: string; entityType: string; entityId?: string | null; summary: string; meta?: Prisma.InputJsonValue },
  tx: Tx = db,
) {
  const ip = await clientIp().catch(() => null);
  await tx.auditLog.create({
    data: {
      actorType: actor === "system" ? "SYSTEM" : "staffId" in actor ? "STAFF" : "BUSINESS",
      staffId: actor !== "system" && "staffId" in actor ? actor.staffId : null,
      businessId: actor !== "system" && "businessId" in actor ? actor.businessId : null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 300),
      meta: entry.meta,
      ip: ip === "unknown" ? null : ip,
    },
  });
}
