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
  // Only /embed may be framed by other websites (project.md section 9).
  async headers() {
    return [
      { source: "/embed", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      {
        source: "/((?!embed).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
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
