import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Also read env files from the monorepo root (apps/web/.env.local still wins).
loadEnvConfig(`${process.cwd()}/../..`);

const nextConfig: NextConfig = {
  transpilePackages: ["@askwell/shared"],
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
