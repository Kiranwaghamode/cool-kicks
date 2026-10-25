import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductCardData, ProductTag, Size } from "@/lib/types";

const cardInclude = {
  category: { select: { name: true, slug: true } },
  variants: { select: { size: true, price: true, isAvailable: true, volumeMl: true } },
} satisfies Prisma.ProductInclude;

type ProductWithCard = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

const SIZE_ORDER: Size[] = ["SMALL", "MEDIUM", "LARGE"];

async function ratingsFor(productIds: string[]) {
  if (!productIds.length) return new Map<string, { avg: number; count: number }>();
  const rows = await db.review.groupBy({
    by: ["productId"],
    where: { isApproved: true, productId: { in: productIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((r) => [r.productId as string, { avg: r._avg.rating ?? 0, count: r._count._all }]),
  );
}

function toCard(p: ProductWithCard, rating?: { avg: number; count: number }): ProductCardData {
  const available = p.variants
    .filter((v) => v.isAvailable)
    .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  const def = available.find((v) => v.size === "MEDIUM") ?? available[0] ?? null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    image: p.image,
    tags: p.tags as ProductTag[],
    isAvailable: p.isAvailable && available.length > 0,
    categoryName: p.category.name,
    fromPrice: available.length ? Math.min(...available.map((v) => v.price)) : 0,
    defaultSize: def?.size ?? null,
    defaultPrice: def?.price ?? null,
    rating: rating && rating.count ? Math.round(rating.avg * 10) / 10 : null,
    reviewCount: rating?.count ?? 0,
  };
}

async function toCards(products: ProductWithCard[]) {
  const ratings = await ratingsFor(products.map((p) => p.id));
  return products.map((p) => toCard(p, ratings.get(p.id)));
}

const visibleProduct = { isActive: true, category: { isActive: true } } satisfies Prisma.ProductWhereInput;

export const getCategories = cache(async () =>
  db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, image: true },
  }),
);

export async function getBestsellers(limit = 8) {
  const products = await db.product.findMany({
    where: { ...visibleProduct, tags: { has: "BESTSELLER" } },
    include: cardInclude,
    orderBy: [{ isAvailable: "desc" }, { sortOrder: "asc" }],
    take: limit,
  });
  return toCards(products);
}

export type MenuSort = "popular" | "price-asc" | "price-desc";

export async function getMenuProducts({
  categorySlug,
  q,
  sort = "popular",
}: {
  categorySlug?: string;
  q?: string;
  sort?: MenuSort;
}) {
  const query = q?.trim().slice(0, 60);
  const products = await db.product.findMany({
    where: {
      ...visibleProduct,
      ...(categorySlug ? { category: { slug: categorySlug, isActive: true } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { ingredients: { has: query } },
              { category: { name: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: cardInclude,
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  const cards = await toCards(products);

  // Popularity = units sold in the last 60 days, with bestsellers boosted.
  if (sort === "popular") {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60);
    const sold = await db.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { in: cards.map((c) => c.id) },
        order: { createdAt: { gte: since }, status: { notIn: ["CANCELLED", "REJECTED"] } },
      },
      _sum: { quantity: true },
    });
    const units = new Map(sold.map((s) => [s.productId, s._sum.quantity ?? 0]));
    const score = (c: ProductCardData) =>
      (units.get(c.id) ?? 0) + (c.tags.includes("BESTSELLER") ? 1000 : 0) + (c.isAvailable ? 10000 : 0);
    return [...cards].sort((a, b) => score(b) - score(a));
  }
  const dir = sort === "price-asc" ? 1 : -1;
  return [...cards].sort(
    (a, b) => Number(b.isAvailable) - Number(a.isAvailable) || (a.fromPrice - b.fromPrice) * dir,
  );
}

export const getProductBySlug = cache(async (slug: string) => {
  const p = await db.product.findFirst({
    where: { slug, ...visibleProduct },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: { orderBy: { price: "asc" } },
    },
  });
  if (!p) return null;
  const ratings = await ratingsFor([p.id]);
  const r = ratings.get(p.id);
  const reviews = await db.review.findMany({
    where: { productId: p.id, isApproved: true },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, customerName: true, rating: true, comment: true, createdAt: true },
  });
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    image: p.image,
    ingredients: p.ingredients,
    tags: p.tags as ProductTag[],
    isAvailable: p.isAvailable && p.variants.some((v) => v.isAvailable),
    allowSugarChoice: p.allowSugarChoice,
    allowIceChoice: p.allowIceChoice,
    category: p.category,
    variants: [...p.variants]
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
      .map((v) => ({ size: v.size as Size, volumeMl: v.volumeMl, price: v.price, isAvailable: v.isAvailable })),
    rating: r && r.count ? Math.round(r.avg * 10) / 10 : null,
    reviewCount: r?.count ?? 0,
    reviews,
  };
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function getRelatedProducts(productId: string, categoryId: string, limit = 4) {
  const products = await db.product.findMany({
    where: { ...visibleProduct, categoryId, id: { not: productId } },
    include: cardInclude,
    orderBy: [{ isAvailable: "desc" }, { sortOrder: "asc" }],
    take: limit,
  });
  return toCards(products);
}

export async function getActiveCoupons() {
  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: { isActive: true, validFrom: { lte: now }, validTo: { gte: now } },
    orderBy: { createdAt: "asc" },
  });
  return coupons
    .filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit)
    .map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      minOrderAmount: c.minOrderAmount,
      maxDiscount: c.maxDiscount,
      buyQuantity: c.buyQuantity,
      getQuantity: c.getQuantity,
      validTo: c.validTo.toISOString(),
    }));
}

export type PublicCoupon = Awaited<ReturnType<typeof getActiveCoupons>>[number];

export async function getApprovedReviews(limit = 6) {
  return db.review.findMany({
    where: { isApproved: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      customerName: true,
      rating: true,
      comment: true,
      createdAt: true,
      product: { select: { name: true, slug: true } },
    },
  });
}

export async function getReviewStats() {
  const agg = await db.review.aggregate({
    where: { isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return { average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, count: agg._count._all };
}
