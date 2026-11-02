import { isIP } from "node:net";

// Rules for which web addresses the site crawler may visit. The crawler runs on our
// servers, so it must never be pointed at private networks, cloud metadata or
// ourselves (SSRF). The same check runs on every address a name resolves to.

export class BlockedAddressError extends Error {
  constructor(message = "That address cannot be read.") {
    super(message);
    this.name = "BlockedAddressError";
  }
}

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isPrivateIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

// Expands "::" and returns the eight 16-bit groups, or null when it is not valid.
function ipv6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase().split("%")[0];
  const embedded = text.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const v4 = ipv4Octets(embedded[2]);
    if (!v4) return null;
    text = `${embedded[1]}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.length === 8 && nums.every((n) => !Number.isNaN(n)) ? nums : null;
}

// True when an IP address is anything other than an ordinary public internet address.
// Unparseable input counts as private: when unsure, refuse.
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const octets = ipv4Octets(ip);
    return !octets || isPrivateIpv4(octets);
  }
  if (kind === 6) {
    const g = ipv6Groups(ip);
    if (!g) return true;
    // IPv4-mapped (::ffff:a.b.c.d): judge by the embedded IPv4 address.
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
      return isPrivateIpv4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);
    }
    // Only global unicast (2000::/3) is public, minus the documentation range.
    const isGlobal = (g[0] & 0xe000) === 0x2000;
    const isDocumentation = g[0] === 0x2001 && g[1] === 0x0db8;
    return !isGlobal || isDocumentation;
  }
  return true;
}

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".localdomain", ".lan", ".home", ".corp", ".intranet"];

// A website address the crawler may try: http(s), a real domain name (no IP address),
// no login in the address, standard ports only. Returns null for anything else.
export function parsePublicUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || isIP(host) || host.startsWith("[")) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return null;
  url.hash = "";
  return url;
}

// The site a page belongs to, ignoring a leading "www.", so example.com and
// www.example.com count as the same site.
export function siteKey(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}
