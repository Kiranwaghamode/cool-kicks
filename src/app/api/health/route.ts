import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Health check for uptime monitors and load balancers. 200 = app + database OK. */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", database: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "error", database: "unreachable", time: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
