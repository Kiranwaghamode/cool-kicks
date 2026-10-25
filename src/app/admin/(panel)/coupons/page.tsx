import { PageHeader } from "@/components/admin/ui";
import { CouponManager } from "./coupon-manager";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { istDateKey } from "@/lib/dates";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireRole("coupons");
  const coupons = await db.coupon.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Coupons" description="Customers can use one coupon per order. Discounts are always recalculated on the server." />
      <CouponManager
        today={istDateKey(new Date())}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description ?? "",
          type: c.type,
          value: c.value,
          minOrderAmount: c.minOrderAmount,
          maxDiscount: c.maxDiscount,
          buyQuantity: c.buyQuantity,
          getQuantity: c.getQuantity,
          validFrom: istDateKey(c.validFrom),
          validTo: istDateKey(c.validTo),
          usageLimit: c.usageLimit,
          usedCount: c.usedCount,
          isActive: c.isActive,
          expired: c.validTo < new Date(),
        }))}
      />
    </>
  );
}
