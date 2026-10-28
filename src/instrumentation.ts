/**
 * Runs once when the server starts. Fails fast on missing production configuration
 * so a misconfigured deploy never serves traffic.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is not set");
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) problems.push("AUTH_SECRET must be at least 32 characters");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!site.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(site)) problems.push("NEXT_PUBLIC_SITE_URL must be the https:// address of the site");
  if (process.env.STORAGE_DRIVER === "cloudinary") {
    for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
      if (!process.env[k]) problems.push(`${k} is not set (needed for STORAGE_DRIVER=cloudinary)`);
    }
  }
  if (problems.length) {
    console.error(`\n[Cool Kick] Configuration problems:\n - ${problems.join("\n - ")}\n`);
    throw new Error("Invalid production configuration – see the log above.");
  }
}
