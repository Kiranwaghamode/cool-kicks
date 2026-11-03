import "server-only";

/**
 * Business verification documents (GST certificate, PAN…). Stored privately in the database and
 * only streamed to logged-in staff (src/app/admin/documents/[id]/route.ts) or the owning business.
 */

export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

const TYPES: { mime: string; ext: string; magic: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: "pdf", magic: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", magic: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

export class DocumentError extends Error {}

/** Validate an uploaded file by its real content (not the browser-supplied type). */
export async function readDocument(file: unknown): Promise<{ data: Buffer; mimeType: string; fileName: string; size: number }> {
  if (!(file instanceof File) || file.size === 0) throw new DocumentError("Choose a file to upload.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentError("File is too large (max 3 MB).");
  const data = Buffer.from(await file.arrayBuffer());
  const type = TYPES.find((t) => t.magic(data));
  if (!type) throw new DocumentError("Upload a PDF, JPG, PNG or WebP file.");
  const base = (file.name || "document")
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .slice(0, 60) || "document";
  return { data, mimeType: type.mime, fileName: `${base}.${type.ext}`, size: data.length };
}
