import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../supabase/migrations");

// Stubs the parts of Supabase the migrations depend on: the extensions and
// auth schemas, the three API roles, auth.jwt(), and Supabase's permissive
// default privileges (so tests prove the migration revokes them).
const SUPABASE_STUB = `
  create schema extensions;
  create schema auth;
  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;

  grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  grant execute on function auth.jwt() to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type ApiRole = "anon" | "authenticated" | "service_role";

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(
    "grant all on all tables in schema public to service_role; revoke truncate on all tables in schema public from service_role;",
  );
  return db;
}

// Runs `fn` as an API role, with the Clerk user ID in the JWT `sub` claim.
export async function asRole<T>(
  db: PGlite,
  role: ApiRole,
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify(sub ? { sub, role } : { role });
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec("select set_config('request.jwt.claims', '', false)");
  }
}
