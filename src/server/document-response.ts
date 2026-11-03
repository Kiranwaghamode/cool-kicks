import "server-only";

/** Stream a stored document with headers that stop it being cached or executed as a page. */
export function documentResponse(doc: { data: Uint8Array; mimeType: string; fileName: string }, download: boolean) {
  return new Response(Buffer.from(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
    },
  });
}
