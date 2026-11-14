import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // static hosting on Vercel; the app only reads public/data/
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
