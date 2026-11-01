import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createTestDb } from "./supabase-pglite";

let db: PGlite;
const ALICE = "user_alice";
const BOB = "user_bob";

const vec = (n: number) => `[${[n, ...Array<number>(1535).fill(0)].join(",")}]`;

async function svc<T>(fn: () => Promise<T>) {
  return asRole(db, "service_role", null, fn);
}

async function createProject(owner: string, name: string, key: string, max = 5) {
  return svc(async () => {
    const r = await db.query<{ id: string }>(
      "select (public.create_project($1, $2, $3, $4)).id as id",
      [owner, name, key, max],
    );
    return r.rows[0]!.id;
  });
}

beforeAll(async () => {
  db = await createTestDb();
  await svc(() =>
    db.exec(`insert into public.accounts (clerk_user_id) values ('${ALICE}'), ('${BOB}')`),
  );
});

afterAll(async () => {
  await db.close();
});

describe("projects", () => {
  it("creates a project with a default widget config", async () => {
    const id = await createProject(ALICE, "Alice shop", "pk_alice1");
    const cfg = await svc(() =>
      db.query("select * from public.widget_configs where project_id = $1", [id]),
    );
    expect(cfg.rows).toHaveLength(1);
    expect(cfg.rows[0]).toMatchObject({ position: "bottom-right", show_badge: true });
  });

  it("refuses a project over the plan limit", async () => {
    await createProject(BOB, "Bob one", "pk_bob1", 1);
    await expect(createProject(BOB, "Bob two", "pk_bob2", 1)).rejects.toThrow(
      /project_limit_reached/,
    );
  });

  it("does not exceed the limit under concurrent creates", async () => {
    await svc(() => db.exec("insert into public.accounts (clerk_user_id) values ('user_race')"));
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((i) => createProject("user_race", `race${i}`, `pk_race${i}`, 2)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
  });
});

describe("row level security", () => {
  it("lets an owner read only their own projects", async () => {
    const rows = await asRole(db, "authenticated", ALICE, () =>
      db.query<{ owner_id: string }>("select owner_id from public.projects"),
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.owner_id === ALICE)).toBe(true);
  });

  it("returns nothing without a user", async () => {
    const rows = await asRole(db, "authenticated", null, () =>
      db.query("select * from public.projects"),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("denies anon everything", async () => {
    await asRole(db, "anon", null, async () => {
      await expect(db.query("select * from public.projects")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.messages")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.consume_message(gen_random_uuid(), 5)")).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it("hides accounts and chunks from owners", async () => {
    await asRole(db, "authenticated", ALICE, async () => {
      await expect(db.query("select * from public.accounts")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.knowledge_chunks")).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it("lets owners rename their project but not change other columns or insert", async () => {
    await asRole(db, "authenticated", ALICE, async () => {
      const ok = await db.query(
        "update public.projects set name = 'Renamed' where owner_id = $1 returning id",
        [ALICE],
      );
      expect(ok.rows.length).toBeGreaterThan(0);
      await expect(
        db.query("update public.projects set messages_used = 0 where owner_id = $1", [ALICE]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("insert into public.projects (owner_id, name, public_key) values ($1, 'x', 'pk_x')", [
          ALICE,
        ]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("does not let an owner change another owner's project", async () => {
    const res = await asRole(db, "authenticated", BOB, () =>
      db.query("update public.projects set name = 'hacked' where owner_id = $1 returning id", [ALICE]),
    );
    expect(res.rows).toHaveLength(0);
  });

  it("lets owners delete their project, which removes its data", async () => {
    const id = await createProject("user_race", "to delete", "pk_del", 10);
    const del = await asRole(db, "authenticated", "user_race", () =>
      db.query("delete from public.projects where id = $1 returning id", [id]),
    );
    expect(del.rows).toHaveLength(1);
    const cfg = await svc(() =>
      db.query("select 1 from public.widget_configs where project_id = $1", [id]),
    );
    expect(cfg.rows).toHaveLength(0);
  });

  it("denies TRUNCATE to the API roles", async () => {
    await asRole(db, "authenticated", ALICE, async () => {
      await expect(db.query("truncate public.projects")).rejects.toThrow(/permission denied/);
    });
    await svc(async () => {
      await expect(db.query("truncate public.projects")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("messages and quota", () => {
  it("stops counting at the monthly limit and resets in a new month", async () => {
    const id = await createProject(ALICE, "Quota", "pk_quota", 10);
    const consume = () =>
      svc(async () => {
        const r = await db.query<{ ok: boolean }>("select public.consume_message($1, 3) as ok", [id]);
        return r.rows[0]!.ok;
      });
    expect([await consume(), await consume(), await consume(), await consume()]).toEqual([
      true,
      true,
      true,
      false,
    ]);

    await svc(() =>
      db.query("update public.projects set period_start = '2000-01-01' where id = $1", [id]),
    );
    expect(await consume()).toBe(true);
    const row = await svc(() =>
      db.query<{ messages_used: number }>("select messages_used from public.projects where id = $1", [id]),
    );
    expect(row.rows[0]!.messages_used).toBe(1);
  });

  it("never lets concurrent messages pass the limit", async () => {
    const id = await createProject(ALICE, "Quota race", "pk_qrace", 10);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        svc(async () => {
          const r = await db.query<{ ok: boolean }>("select public.consume_message($1, 5) as ok", [id]);
          return r.rows[0]!.ok;
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("saves a turn, then appends to the same conversation", async () => {
    const id = await createProject(ALICE, "Chat", "pk_chat", 10);
    const save = (conv: string | null) =>
      svc(async () => {
        const r = await db.query<{ c: string }>(
          "select public.save_chat_turn($1, 'visitor-1', $2, 'hi', 'hello') as c",
          [id, conv],
        );
        return r.rows[0]!.c;
      });
    const conv = await save(null);
    expect(await save(conv)).toBe(conv);

    const msgs = await asRole(db, "authenticated", ALICE, () =>
      db.query<{ role: string }>(
        "select role from public.messages where conversation_id = $1 order by created_at",
        [conv],
      ),
    );
    expect(msgs.rows.map((m) => m.role)).toEqual(["visitor", "bot", "visitor", "bot"]);
  });

  it("rejects a conversation that belongs to another project", async () => {
    const a = await createProject(ALICE, "Chat A", "pk_chatA", 10);
    const b = await createProject(BOB, "Chat B", "pk_chatB", 10).catch(() => null);
    const other = b ?? (await createProject(ALICE, "Chat B2", "pk_chatB2", 10));
    const conv = await svc(async () => {
      const r = await db.query<{ c: string }>(
        "select public.save_chat_turn($1, 'v', null, 'q', 'a') as c",
        [a],
      );
      return r.rows[0]!.c;
    });
    await svc(async () => {
      await expect(
        db.query("select public.save_chat_turn($1, 'v', $2, 'q', 'a')", [other, conv]),
      ).rejects.toThrow(/conversation_not_found/);
    });
  });

  it("hides other owners' conversations", async () => {
    const rows = await asRole(db, "authenticated", BOB, () =>
      db.query("select c.id from public.conversations c join public.projects p on p.id = c.project_id where p.owner_id = $1", [ALICE]),
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe("knowledge", () => {
  it("enforces the source limit and reclaims stale uploads", async () => {
    const id = await createProject(ALICE, "Knowledge", "pk_know", 10);
    const reserve = (title: string, status = "processing") =>
      svc(() =>
        db.query("select public.reserve_knowledge_source($1, $2, 'text', null, $3, 2)", [id, title, status]),
      );
    await reserve("one");
    await reserve("two", "uploading");
    await expect(reserve("three")).rejects.toThrow(/source_limit_reached/);

    await svc(() =>
      db.query(
        "update public.knowledge_sources set created_at = now() - interval '3 hours' where project_id = $1 and status = 'uploading'",
        [id],
      ),
    );
    await reserve("three");
  });

  it("retrieves only ready chunks of the asked project, nearest first", async () => {
    const p1 = await createProject(ALICE, "Search 1", "pk_s1", 10);
    const p2 = await createProject(ALICE, "Search 2", "pk_s2", 10);
    await svc(async () => {
      const src = async (project: string, status: string) =>
        (
          await db.query<{ id: string }>(
            "insert into public.knowledge_sources (project_id, title, type, status) values ($1, 't', 'text', $2) returning id",
            [project, status],
          )
        ).rows[0]!.id;
      const ready = await src(p1, "ready");
      const pending = await src(p1, "processing");
      const foreign = await src(p2, "ready");
      const chunk = (project: string, source: string, content: string, v: number) =>
        db.query(
          "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, $3, $4)",
          [project, source, content, vec(v)],
        );
      await chunk(p1, ready, "near", 1);
      await chunk(p1, ready, "far", -1);
      await chunk(p1, pending, "not ready", 1);
      await chunk(p2, foreign, "other project", 1);
    });
    const res = await svc(() =>
      db.query<{ content: string }>("select content from public.match_chunks($1, $2, 5)", [p1, vec(1)]),
    );
    expect(res.rows.map((r) => r.content)).toEqual(["near", "far"]);
  });

  it("owner_activity is scoped to the caller", async () => {
    const res = await asRole(db, "authenticated", BOB, () =>
      db.query<{ project_id: string }>("select project_id from public.owner_activity()"),
    );
    const own = await asRole(db, "authenticated", BOB, () =>
      db.query<{ id: string }>("select id from public.projects"),
    );
    expect(res.rows.map((r) => r.project_id).sort()).toEqual(own.rows.map((r) => r.id).sort());
  });
});

describe("knowledge bucket", () => {
  it("is private, capped at 10 MB, and limited to PDF, Markdown and text", async () => {
    const res = await db.query<{
      public: boolean;
      file_size_limit: string;
      allowed_mime_types: string[];
    }>("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'knowledge'");
    expect(res.rows).toHaveLength(1);
    const bucket = res.rows[0]!;
    expect(bucket.public).toBe(false);
    expect(Number(bucket.file_size_limit)).toBe(10 * 1024 * 1024);
    expect([...bucket.allowed_mime_types].sort()).toEqual(["application/pdf", "text/markdown", "text/plain"]);
  });
});
