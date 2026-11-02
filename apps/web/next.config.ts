import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Also read env files from the monorepo root. Next has already loaded apps/web,
// and loadEnvFile never overrides a variable that is already set, so apps/web wins.
for (const name of [".env.local", ".env"]) {
  const path = `${process.cwd()}/../../${name}`;
  if (existsSync(path)) process.loadEnvFile(path);
}

// The production site also answers on its *.vercel.app alias. Send that host to the
// public address so search engines index one version. Preview deployments use other
// hosts and are left alone.
const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
export const ALIAS_HOSTS = ["askwell-theta.vercel.app"];

const nextConfig: NextConfig = {
  transpilePackages: ["@askwell/shared"],
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    if (!PUBLIC_URL) return [];
    return ALIAS_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${PUBLIC_URL}/:path*`,
      permanent: true,
    }));
  },
  // Security headers: clickjacking, frame-ancestors, MIME sniffing, HSTS (project.md section 9).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
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
