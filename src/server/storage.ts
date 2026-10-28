import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Image storage behind one interface so it can move to Cloudinary/S3 later.
 *
 * STORAGE_DRIVER=local (default): files are written to <project>/uploads and served by
 * src/app/uploads/[...path]/route.ts at /uploads/... (works in dev and on a VPS).
 * STORAGE_DRIVER=cloudinary: uploaded to Cloudinary with its REST API (needed on Vercel,
 * whose filesystem is temporary). Needs CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET.
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
      return uploadToCloudinary(output, folder);
    case "s3":
      // Add the S3 SDK and upload `output` here; return its public URL. See DEPLOYMENT.md.
      throw new UploadError(`Storage driver "${driver}" is not configured yet. See DEPLOYMENT.md.`);
    default:
      throw new UploadError(`Unknown STORAGE_DRIVER "${driver}".`);
  }
}

/** Best-effort delete of a previously uploaded image (local file or Cloudinary asset). */
export async function deleteImage(url: string | null | undefined) {
  if (!url) return;
  if (url.startsWith("https://res.cloudinary.com/")) {
    await deleteFromCloudinary(url).catch(() => {});
    return;
  }
  if (!url.startsWith("/uploads/")) return;
  const rel = url.replace(/^\/uploads\//, "");
  const full = path.join(UPLOAD_DIR, rel);
  if (!full.startsWith(UPLOAD_DIR)) return;
  await unlink(full).catch(() => {});
}

/* ---------------- Cloudinary (signed REST uploads, no SDK) ---------------- */

function cloudinaryConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) throw new UploadError("Image storage is not configured (Cloudinary keys missing).");
  return { cloud, key, secret };
}

/** Cloudinary signature: sha1 of the sorted params joined with "&", followed by the API secret. */
function sign(params: Record<string, string>, secret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

async function uploadToCloudinary(output: Buffer, folder: string): Promise<string> {
  const { cloud, key, secret } = cloudinaryConfig();
  const params = { folder: `coolkick/${folder}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(output)], { type: "image/webp" }), "image.webp");
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append("api_key", key);
  form.append("signature", sign(params, secret));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.secure_url) {
    console.error("[storage] Cloudinary upload failed:", res.status, data?.error?.message);
    throw new UploadError("Couldn't upload the image. Please try again.");
  }
  return data.secure_url;
}

async function deleteFromCloudinary(url: string) {
  const { cloud, key, secret } = cloudinaryConfig();
  // https://res.cloudinary.com/<cloud>/image/upload/v123/coolkick/products/abc.webp -> coolkick/products/abc
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  if (!match) return;
  const params = { public_id: match[1], timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append("api_key", key);
  form.append("signature", sign(params, secret));
  await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: "POST", body: form });
}
