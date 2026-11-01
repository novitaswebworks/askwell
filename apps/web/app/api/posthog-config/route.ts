import { connection, NextResponse } from "next/server";
import { postHogConfig } from "@/lib/analytics";

// The browser asks for PostHog's public key and host here instead of having them
// baked in at build time, so each environment uses its own (project.md section 8).
export async function GET() {
  // Without this, Next would render the answer once at build time.
  await connection();
  const config = postHogConfig();
  return NextResponse.json(
    { key: config?.key ?? null, host: config?.host ?? null },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
