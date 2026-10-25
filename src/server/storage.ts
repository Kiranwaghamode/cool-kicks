import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Image storage behind one interface so it can move to Cloudinary/S3 later.
 *
 * STORAGE_DRIVER=local (default): files are written to <project>/uploads and served by
 * src/app/uploads/[...path]/route.ts at /uploads/... (works in dev and on a VPS).
 * On serverless hosting (Vercel) switch to "cloudinary" or "s3" – see DEPLOYMENT.md.
 */

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export class UploadError extends Error {}

export async function saveImage(file: File, folder: "products" | "categories" | "misc" = "misc"): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("Choose an image to upload.");
  if (!ALLOWED.has(file.type)) throw new UploadError("Only JPG, PNG or WebP images are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Image is too large (max 3 MB).");

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    // Re-encode: strips metadata and anything that isn't a real image.
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new UploadError("That file doesn't look like a valid image.");
  }

  const driver = process.env.STORAGE_DRIVER ?? "local";
  const name = `${randomUUID()}.webp`;

  switch (driver) {
    case "local": {
      const dir = path.join(UPLOAD_DIR, folder);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), output);
      return `/uploads/${folder}/${name}`;
    }
    case "cloudinary":
    case "s3":
      // Add the provider SDK and upload `output` here; return its public URL.
      // Remember to add the provider's host to images.remotePatterns in next.config.ts.
      throw new UploadError(`Storage driver "${driver}" is not configured yet. See DEPLOYMENT.md.`);
    default:
      throw new UploadError(`Unknown STORAGE_DRIVER "${driver}".`);
  }
}

/** Best-effort delete of a previously uploaded local image. */
export async function deleteImage(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/")) return;
  const rel = url.replace(/^\/uploads\//, "");
  const full = path.join(UPLOAD_DIR, rel);
  if (!full.startsWith(UPLOAD_DIR)) return;
  await unlink(full).catch(() => {});
}
