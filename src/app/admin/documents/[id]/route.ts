import { db } from "@/lib/db";
import { ForbiddenError, requireRoleForAction } from "@/server/auth-guard";
import { documentResponse } from "@/server/document-response";

/** Business verification document – staff with access to Businesses only. */
export async function GET(request: Request, ctx: RouteContext<"/admin/documents/[id]">) {
  try {
    await requireRoleForAction("businesses");
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const { id } = await ctx.params;
  const doc = await db.businessDocument.findUnique({ where: { id }, select: { data: true, mimeType: true, fileName: true } });
  if (!doc) return new Response("Not found", { status: 404 });
  return documentResponse(doc, new URL(request.url).searchParams.has("download"));
}
