import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic caching model: DB-backed pages render on request and are
  // refreshed with revalidatePath() after admin changes.
  cacheComponents: false,
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
