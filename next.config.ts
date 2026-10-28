import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
/** HTTPS-only headers (HSTS, upgrade-insecure-requests) only when the site is really served over https –
 *  otherwise a local `npm start` opened over http://<LAN-IP> can't load its own files. */
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/**
 * Content Security Policy. Next.js injects small inline scripts for hydration, so
 * 'unsafe-inline' is needed for scripts unless nonces are added via the proxy.
 * Everything else is locked to our own origin, plus Google Maps for the embed.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com https://*.google.com https://*.gstatic.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS only matters over HTTPS; browsers ignore it on plain http://localhost.
  ...(!isHttps ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // Classic caching model: DB-backed pages render on request and are
  // refreshed with revalidatePath() after admin changes.
  cacheComponents: false,
  poweredByHeader: false,
  // Docker/VPS builds set BUILD_STANDALONE=1 to get a self-contained .next/standalone server.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  experimental: {
    // Product photo uploads are up to 3 MB (+ multipart overhead).
    serverActions: { bodySizeLimit: "3.5mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Product photos uploaded with STORAGE_DRIVER=cloudinary.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Admin pages and exports must never be cached by shared caches.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
