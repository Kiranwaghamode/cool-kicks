import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic caching model: DB-backed pages render on request and are
  // refreshed with revalidatePath() after admin changes.
  cacheComponents: false,
  experimental: {
    // Product photo uploads are up to 3 MB (+ multipart overhead).
    serverActions: { bodySizeLimit: "3.5mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
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
