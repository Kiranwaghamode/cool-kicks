import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/server/storage";

/** Serves locally stored uploads (STORAGE_DRIVER=local). Only .webp files we wrote ourselves. */
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await ctx.params;
  if (!parts.every((p) => /^[a-zA-Z0-9_-]+(\.webp)?$/.test(p)) || !parts.at(-1)?.endsWith(".webp")) {
    return new Response("Not found", { status: 404 });
  }
  const full = path.join(UPLOAD_DIR, ...parts);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(full);
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
