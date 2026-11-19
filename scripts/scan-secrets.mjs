// Fails when a change adds something shaped like a secret key. Used by the secret-scan workflow:
//   node scripts/scan-secrets.mjs origin/main      scans the lines every commit added since that ref
//   node scripts/scan-secrets.mjs --self-test      checks the patterns themselves
// Put `secret-scan:allow` on a line to let it through (for example a documented fake).
import { execFileSync } from "node:child_process";

export const PATTERNS = {
  "Groq key": /gsk_[A-Za-z0-9]{20,}/,
  "Clerk or Stripe secret key": /sk_(live|test)_[A-Za-z0-9]{20,}/,
  "Supabase secret key": /sb_secret_[A-Za-z0-9_-]{20,}/,
  "Resend key": /\bre_[A-Za-z0-9]{24,}/,
  "Arcjet key": /ajkey_[A-Za-z0-9]{20,}/,
  "21st key": /21st_sk_[a-f0-9]{20,}/,
  "AWS access key": /AKIA[0-9A-Z]{16}/,
  "GitHub token": /gh[pousr]_[A-Za-z0-9]{36,}/,
  "Slack token": /xox[baprs]-[A-Za-z0-9-]{10,}/,
  "Private key block": /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, // secret-scan:allow (this is the pattern itself)
};

// A Supabase legacy JWT is only a secret when its role is service_role (the anon one is public).
function isServiceRoleJwt(line) {
  for (const m of line.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      if (JSON.parse(Buffer.from(m[1], "base64url").toString()).role === "service_role") return true;
    } catch {
      // not a JWT
    }
  }
  return false;
}

export function findSecrets(line) {
  if (line.includes("secret-scan:allow")) return [];
  const found = Object.entries(PATTERNS).filter(([, re]) => re.test(line)).map(([name]) => name);
  if (isServiceRoleJwt(line)) found.push("Supabase service_role JWT");
  return found;
}

function selfTest() {
  const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.abcdefghijklmnop`;
  const cases = [
    ["CLERK_SECRET_KEY=sk_test_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4", true],
    ["CLERK_SECRET_KEY=sk_test_xxx", false],
    ["GROQ_API_KEY=gsk_" + "abcdefghijklmnopqrstuvwx", true],
    ["GROQ_API_KEY=gsk_...", false],
    ["key = " + jwt("service_role"), true],
    ["key = " + jwt("anon"), false],
    ["-----BEGIN PRIVATE KEY-----", true], // secret-scan:allow (a test input)
    ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4", false],
    ["sk_test_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4 secret-scan:allow", false],
  ];
  const bad = cases.filter(([line, expected]) => (findSecrets(line).length > 0) !== expected);
  if (bad.length) {
    console.error("self-test failed for:", bad.map(([l]) => l.slice(0, 40)));
    process.exit(1);
  }
  console.log(`self-test ok (${cases.length} cases)`);
}

function scan(base) {
  // Every commit, not the net diff: a key added and then deleted in the same branch is still in its history.
  const diff = execFileSync("git", ["log", "-p", "-U0", "--no-color", "--format=", `${base}..HEAD`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  let file = "";
  const hits = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++")) {
      const names = findSecrets(line.slice(1));
      if (names.length) hits.push(`${file}: ${names.join(", ")}`);
    }
  }
  if (hits.length) {
    console.error("Possible secrets in this change (values not shown):\n" + [...new Set(hits)].map((h) => "  " + h).join("\n"));
    console.error("\nRemove them and rotate the key. If it is a harmless fake, add `secret-scan:allow` on that line.");
    process.exit(1);
  }
  console.log(`no secrets found in the commits since ${base}`);
}

const arg = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (arg === "--self-test") selfTest();
  else if (arg) scan(arg);
  else {
    console.error("usage: scan-secrets.mjs <base-ref> | --self-test");
    process.exit(2);
  }
}
