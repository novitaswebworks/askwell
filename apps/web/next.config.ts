import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Also read env files from the monorepo root. Next has already loaded apps/web,
// and loadEnvFile never overrides a variable that is already set, so apps/web wins.
for (const name of [".env.local", ".env"]) {
  const path = `${process.cwd()}/../../${name}`;
  if (existsSync(path)) process.loadEnvFile(path);
}

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
