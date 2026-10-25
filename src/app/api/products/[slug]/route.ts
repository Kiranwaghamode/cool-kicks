import { NextResponse } from "next/server";
import { getProductBySlug } from "@/server/catalog";

/** Public product data for the mobile quick-view sheet. */
export async function GET(_req: Request, ctx: RouteContext<"/api/products/[slug]">) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const product = await getProductBySlug(slug);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { reviews: _reviews, ...rest } = product;
  void _reviews;
  return NextResponse.json(rest, { headers: { "Cache-Control": "no-store" } });
}
