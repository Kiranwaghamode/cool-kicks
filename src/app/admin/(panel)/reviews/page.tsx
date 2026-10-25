import { PageHeader } from "@/components/admin/ui";
import { ReviewManager } from "./review-manager";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  await requireRole("reviews");
  const reviews = await db.review.findMany({
    orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
    include: { product: { select: { name: true } }, order: { select: { orderNumber: true } } },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Reviews" description="New reviews from delivered orders wait here until you approve them." />
      <ReviewManager
        reviews={reviews.map((r) => ({
          id: r.id,
          customerName: r.customerName,
          rating: r.rating,
          comment: r.comment,
          product: r.product?.name ?? null,
          orderNumber: r.order?.orderNumber ?? null,
          isApproved: r.isApproved,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
