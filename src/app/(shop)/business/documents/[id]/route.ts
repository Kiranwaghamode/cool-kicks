import { db } from "@/lib/db";
import { getBusiness } from "@/server/business-auth";
import { documentResponse } from "@/server/document-response";

/** A business can view the documents it uploaded – nobody else's. */
export async function GET(request: Request, ctx: RouteContext<"/business/documents/[id]">) {
  const business = await getBusiness();
  if (!business) return new Response("Please log in", { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.businessDocument.findFirst({ where: { id, businessId: business.id }, select: { data: true, mimeType: true, fileName: true } });
  if (!doc) return new Response("Not found", { status: 404 });
  return documentResponse(doc, new URL(request.url).searchParams.has("download"));
}
