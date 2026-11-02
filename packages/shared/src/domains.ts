import { z } from "zod";

export const MAX_ALLOWED_DOMAINS = 10;

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// "https://www.Example.com/shop?x=1" -> "example.com". Only a real domain name
// (at least two labels) is kept; anything else returns null.
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw || raw.length > 253) return null;
  let host: string;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  if (labels.every((l) => /^\d+$/.test(l))) return null; // an IP address
  return host;
}

export const allowedDomainSchema = z.string().transform((value, ctx) => {
  const domain = normalizeDomain(value);
  if (!domain) {
    ctx.addIssue({ code: "custom", message: "Enter a website address like example.com." });
    return z.NEVER;
  }
  return domain;
});

export const allowedDomainsSchema = z
  .array(allowedDomainSchema)
  .max(MAX_ALLOWED_DOMAINS)
  .transform((list) => [...new Set(list)]);

const ALWAYS_ALLOWED = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// An empty list allows every site. Otherwise the host must be a listed domain or
// one of its subdomains. Local addresses always work, so owners can test.
export function isHostAllowed(host: string | null, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true;
  if (!host) return false;
  const h = host.toLowerCase();
  if (ALWAYS_ALLOWED.has(h) || h.endsWith(".localhost")) return true;
  return allowed.some((d) => h === d || h.endsWith(`.${d}`));
}
