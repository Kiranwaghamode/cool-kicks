import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const staticPages = ["", "/menu", "/offers", "/about", "/contact", "/faq", "/track", "/privacy", "/terms", "/refund-policy"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: (p === "" || p === "/menu" ? "daily" : "monthly") as "daily" | "monthly",
    priority: p === "" ? 1 : p === "/menu" ? 0.9 : 0.5,
  }));
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.product.findMany({ where: { isActive: true, category: { isActive: true } }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...staticPages,
    ...categories.map((c) => ({ url: `${base}/menu/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
