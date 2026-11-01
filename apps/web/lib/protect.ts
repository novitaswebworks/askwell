import "server-only";
import arcjet, { detectPromptInjection, fixedWindow } from "@arcjet/next";

export type Protection = { ok: true } | { ok: false; reason: "rate_limit" | "injection" };

const RATE_LIMIT = 20; // messages per minute per public key + IP

let client: ReturnType<typeof build> | null = null;

function build(key: string) {
  return arcjet({
    key,
    characteristics: ["publicKey", "ip.src"],
    rules: [
      fixedWindow({ mode: "LIVE", window: "1m", max: RATE_LIMIT }),
      detectPromptInjection({ mode: "LIVE" }),
    ],
  });
}

// Fails open (project.md section 3): a missing key, an Arcjet error or a timeout
// lets the request through and is logged. The monthly quota stays in Postgres.
export async function protectChat(req: Request, publicKey: string, message: string): Promise<Protection> {
  const arcjetKey = process.env.ARCJET_KEY;
  if (!arcjetKey) {
    console.error("[arcjet] ARCJET_KEY is not set; chat is unprotected");
    return { ok: true };
  }
  try {
    client ??= build(arcjetKey);
    const decision = await Promise.race([
      client.protect(req, { publicKey, detectPromptInjectionMessage: message }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    if (decision.isErrored()) {
      console.error("[arcjet] error decision", decision.reason);
      return { ok: true };
    }
    if (decision.isDenied()) {
      return { ok: false, reason: decision.reason.isRateLimit() ? "rate_limit" : "injection" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[arcjet] failed open", error);
    return { ok: true };
  }
}
