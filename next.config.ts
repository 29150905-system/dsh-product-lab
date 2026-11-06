import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 自托管（Docker）需要 standalone 产物；Vercel 使用平台默认构建
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
