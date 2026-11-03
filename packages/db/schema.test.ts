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
    expect(cfg.rows[0]).toMatchObject({
      position: "bottom-right",
      show_badge: true,
      welcome_message: "Ask a question and we'll reply right here.",
      greeting_enabled: false,
      greeting_text: "Hi! Need a hand? Ask me anything.",
    });
    expect((cfg.rows[0] as { starter_questions: unknown }).starter_questions).toEqual([
      "What services do you offer?",
      "How do I get started?",
      "How can I contact you?",
    ]);
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

  it("lets owners describe their business, within 600 characters, and nobody else", async () => {
    await asRole(db, "authenticated", ALICE, async () => {
      const ok = await db.query(
        "update public.projects set about = 'A travel advisor.' where owner_id = $1 returning about",
        [ALICE],
      );
      expect(ok.rows.length).toBeGreaterThan(0);
      await expect(
        db.query("update public.projects set about = $2 where owner_id = $1", [ALICE, "x".repeat(601)]),
      ).rejects.toThrow(/check constraint/);
    });
    const other = await asRole(db, "authenticated", BOB, () =>
      db.query("update public.projects set about = 'hacked' where owner_id = $1 returning id", [ALICE]),
    );
    expect(other.rows).toHaveLength(0);
    await asRole(db, "anon", null, async () => {
      await expect(db.query("update public.projects set about = 'x'")).rejects.toThrow(/permission denied/);
    });
  });

  it("rates only the latest bot answer, only inside the right project, service role only", async () => {
    const alice = await svc(() => db.query<{ id: string }>("select id from public.projects where owner_id = $1 limit 1", [ALICE]));
    const bob = await svc(() => db.query<{ id: string }>("select id from public.projects where owner_id = $1 limit 1", [BOB]));
    const projectId = alice.rows[0]!.id;
    const conv = await svc(() =>
      db.query<{ c: string }>("select public.save_chat_turn($1, 'rater', null, 'q1', 'a1') as c", [projectId]),
    );
    const conversationId = conv.rows[0]!.c;
    await svc(() => db.query("select public.save_chat_turn($1, 'rater', $2, 'q2', 'a2')", [projectId, conversationId]));
    // The test clock is coarse: two turns saved back to back can share a timestamp. Real turns are seconds apart.
    await svc(() => db.query("update public.messages set created_at = created_at - interval '1 minute' where conversation_id = $1 and body in ('q1', 'a1')", [conversationId]));

    await svc(async () => {
      const ok = await db.query("select public.rate_last_reply($1, $2, 1::smallint) as ok", [projectId, conversationId]);
      expect(ok.rows[0]).toEqual({ ok: true });
      const rated = await db.query(
        "select body, rating from public.messages where conversation_id = $1 and rating is not null",
        [conversationId],
      );
      expect(rated.rows).toEqual([{ body: "a2", rating: 1 }]);

      const wrong = await db.query("select public.rate_last_reply($1, $2, -1::smallint) as ok", [bob.rows[0]!.id, conversationId]);
      expect(wrong.rows[0]).toEqual({ ok: false });
      await expect(
        db.query("select public.rate_last_reply($1, $2, 7::smallint)", [projectId, conversationId]),
      ).rejects.toThrow(/invalid_rating/);

      await db.query("select public.rate_last_reply($1, $2, 0::smallint)", [projectId, conversationId]);
      const cleared = await db.query("select count(*)::int as n from public.messages where rating is not null");
      expect(cleared.rows[0]).toEqual({ n: 0 });
    });
    await asRole(db, "authenticated", ALICE, async () => {
      await expect(
        db.query("select public.rate_last_reply($1, $2, 1::smallint)", [projectId, conversationId]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("lets owners list the websites allowed to show their chat, up to 10, and nobody else", async () => {
    await asRole(db, "authenticated", ALICE, async () => {
      const ok = await db.query(
        "update public.projects set allowed_domains = array['a.com','b.com'] where owner_id = $1 returning allowed_domains",
        [ALICE],
      );
      expect(ok.rows.length).toBeGreaterThan(0);
      await expect(
        db.query(
          "update public.projects set allowed_domains = array_fill('x.com'::text, array[11]) where owner_id = $1",
          [ALICE],
        ),
      ).rejects.toThrow(/check constraint/);
    });
    const other = await asRole(db, "authenticated", BOB, () =>
      db.query("update public.projects set allowed_domains = array['evil.com'] where owner_id = $1 returning id", [ALICE]),
    );
    expect(other.rows).toHaveLength(0);
    await asRole(db, "anon", null, async () => {
      await expect(db.query("update public.projects set allowed_domains = '{}'")).rejects.toThrow(/permission denied/);
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

  describe("hybrid search (meaning plus keywords)", () => {
    const axis = (i: number) => `[${Array.from({ length: 1536 }, (_, k) => (k === i ? 1 : 0)).join(",")}]`;
    let p: string;
    let other: string;

    beforeAll(async () => {
      p = await createProject(ALICE, "Hybrid 1", "pk_h1", 10);
      other = await createProject(ALICE, "Hybrid 2", "pk_h2", 10);
      await svc(async () => {
        const src = async (project: string, status: string) =>
          (
            await db.query<{ id: string }>(
              "insert into public.knowledge_sources (project_id, title, type, status) values ($1, 't', 'text', $2) returning id",
              [project, status],
            )
          ).rows[0]!.id;
        const ready = await src(p, "ready");
        const pending = await src(p, "processing");
        const foreign = await src(other, "ready");
        const add = (project: string, source: string, content: string, i: number) =>
          db.query(
            "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, $3, $4)",
            [project, source, content, axis(i)],
          );
        await add(p, ready, "Bali has lakeside temples and rice terraces.", 0);
        await add(p, ready, "Cape Town has Table Mountain and wine country.", 5);
        await add(p, ready, "Japan has pagodas and quiet temple towns.", 7);
        await add(p, pending, "Cape Town draft that is not ready.", 5);
        await add(other, foreign, "Cape Town in another project.", 5);
      });
    });

    const hybrid = (text: string, count = 2) =>
      svc(() =>
        db.query<{ content: string; similarity: number }>(
          "select content, similarity from public.match_chunks_hybrid($1, $2, $3, $4)",
          [p, axis(0), text, count],
        ),
      );

    it("brings back a chunk the keywords name even when its meaning is far from the question", async () => {
      const res = await hybrid("cape or town");
      expect(res.rows.map((r) => r.content)).toEqual(
        expect.arrayContaining(["Bali has lakeside temples and rice terraces.", "Cape Town has Table Mountain and wine country."]),
      );
      expect(res.rows.map((r) => r.content)).not.toContain("Japan has pagodas and quiet temple towns.");
    });

    it("falls back to meaning alone when there are no keywords", async () => {
      const res = await hybrid("", 1);
      expect(res.rows.map((r) => r.content)).toEqual(["Bali has lakeside temples and rice terraces."]);
    });

    it("reports the meaning similarity, not the fused score", async () => {
      const res = await hybrid("cape or town", 3);
      const bali = res.rows.find((r) => r.content.startsWith("Bali"))!;
      expect(bali.similarity).toBeCloseTo(1, 5);
      expect(res.rows.find((r) => r.content.startsWith("Cape"))!.similarity).toBeCloseTo(0, 5);
    });

    it("never returns chunks of another project or of a source that is not ready", async () => {
      const res = await hybrid("cape or town", 10);
      expect(res.rows.map((r) => r.content).sort()).toEqual([
        "Bali has lakeside temples and rice terraces.",
        "Cape Town has Table Mountain and wine country.",
        "Japan has pagodas and quiet temple towns.",
      ]);
    });

    it("accepts odd keyword text without an error", async () => {
      for (const text of ["'", '"unclosed', "a & | ! b", "(((", ":*"]) {
        await expect(hybrid(text)).resolves.toBeDefined();
      }
    });

    it("can be executed by the service role only", async () => {
      for (const role of ["anon", "authenticated"] as const) {
        await asRole(db, role, ALICE, async () => {
          await expect(
            db.query("select * from public.match_chunks_hybrid($1, $2, 'x', 3)", [p, axis(0)]),
          ).rejects.toThrow(/permission denied/);
        });
      }
    });
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

describe("billing", () => {
  it("keeps the Cashfree subscription ID on accounts, unique, and server-only", async () => {
    await svc(() =>
      db.exec(`insert into public.accounts (clerk_user_id, cashfree_subscription_id) values ('user_cf1', 'sub_1'), ('user_cf2', null), ('user_cf3', null)`),
    );
    await svc(async () => {
      await expect(
        db.exec(`insert into public.accounts (clerk_user_id, cashfree_subscription_id) values ('user_cf4', 'sub_1')`),
      ).rejects.toThrow(/duplicate key|unique/);
    });
    for (const role of ["anon", "authenticated"] as const) {
      await asRole(db, role, "user_cf1", async () => {
        await expect(db.query("select cashfree_subscription_id from public.accounts")).rejects.toThrow(/permission denied/);
      });
    }
  });
});

describe("widget last seen", () => {
  it("lets an owner read when their widget last loaded, but only the server can write it", async () => {
    await svc(() => db.exec("insert into public.accounts (clerk_user_id) values ('user_seen') on conflict do nothing"));
    const id = await createProject("user_seen", "Seen", "pk_seen1", 10);
    await svc(() =>
      db.query("update public.widget_configs set last_seen_at = now(), last_seen_host = 'shop.example.com' where project_id = $1", [id]),
    );
    const own = await asRole(db, "authenticated", "user_seen", () =>
      db.query<{ last_seen_host: string }>("select last_seen_host from public.widget_configs where project_id = $1", [id]),
    );
    expect(own.rows[0]?.last_seen_host).toBe("shop.example.com");

    const other = await asRole(db, "authenticated", BOB, () =>
      db.query("select last_seen_host from public.widget_configs where project_id = $1", [id]),
    );
    expect(other.rows).toHaveLength(0);

    await asRole(db, "authenticated", "user_seen", async () => {
      await expect(
        db.query("update public.widget_configs set last_seen_host = 'evil.example' where project_id = $1", [id]),
      ).rejects.toThrow(/permission denied/);
    });
    await asRole(db, "anon", null, async () => {
      await expect(db.query("select last_seen_host from public.widget_configs")).rejects.toThrow(/permission denied/);
    });
  });
  it("refuses a host name longer than a domain can be", async () => {
    await svc(() => db.exec("insert into public.accounts (clerk_user_id) values ('user_seen') on conflict do nothing"));
    const id = await createProject("user_seen", "Seen2", "pk_seen2", 10);
    await svc(async () => {
      await expect(
        db.query("update public.widget_configs set last_seen_host = $2 where project_id = $1", [id, "a".repeat(254)]),
      ).rejects.toThrow(/check constraint/);
    });
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

describe("cross-tenant isolation", () => {
  const TENANT_A = "user_sec_a";
  const TENANT_B = "user_sec_b";
  let aliceProj: string;
  let aliceSource: string;
  let aliceConv: string;

  beforeAll(async () => {
    await svc(() =>
      db.exec(`insert into public.accounts (clerk_user_id) values ('${TENANT_A}'), ('${TENANT_B}')`),
    );
    aliceProj = await createProject(TENANT_A, "Alice Private Corp", "pk_alice_sec", 5);
    aliceSource = await svc(async () => {
      const res = await db.query<{ id: string }>(
        "insert into public.knowledge_sources (project_id, title, type, status) values ($1, 'Alice Secret Doc', 'text', 'ready') returning id",
        [aliceProj],
      );
      return res.rows[0]!.id;
    });
    aliceConv = await svc(async () => {
      const res = await db.query<{ c: string }>(
        "select public.save_chat_turn($1, 'visitor-1', null, 'secret question', 'secret answer') as c",
        [aliceProj],
      );
      return res.rows[0]!.c;
    });
  });

  it("prevents Bob from reading or modifying Alice's project", async () => {
    const read = await asRole(db, "authenticated", TENANT_B, () =>
      db.query("select * from public.projects where id = $1", [aliceProj]),
    );
    expect(read.rows).toHaveLength(0);

    const update = await asRole(db, "authenticated", TENANT_B, () =>
      db.query("update public.projects set name = 'Hacked' where id = $1 returning id", [aliceProj]),
    );
    expect(update.rows).toHaveLength(0);

    const del = await asRole(db, "authenticated", TENANT_B, () =>
      db.query("delete from public.projects where id = $1 returning id", [aliceProj]),
    );
    expect(del.rows).toHaveLength(0);
  });

  it("prevents Bob from reading or modifying Alice's widget configs", async () => {
    const read = await asRole(db, "authenticated", TENANT_B, () =>
      db.query("select * from public.widget_configs where project_id = $1", [aliceProj]),
    );
    expect(read.rows).toHaveLength(0);

    await asRole(db, "authenticated", TENANT_B, async () => {
      await expect(
        db.query("update public.widget_configs set button_color = '#000000' where project_id = $1", [aliceProj]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("delete from public.widget_configs where project_id = $1", [aliceProj]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("prevents Bob from reading or deleting Alice's knowledge sources", async () => {
    const read = await asRole(db, "authenticated", TENANT_B, () =>
      db.query("select * from public.knowledge_sources where project_id = $1", [aliceProj]),
    );
    expect(read.rows).toHaveLength(0);

    // Direct deletes are revoked from authenticated API users
    await asRole(db, "authenticated", TENANT_B, async () => {
      await expect(
        db.query("delete from public.knowledge_sources where id = $1", [aliceSource]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("prevents Bob from reading Alice's conversations and messages", async () => {
    const readConv = await asRole(db, "authenticated", TENANT_B, () =>
      db.query("select * from public.conversations where id = $1", [aliceConv]),
    );
    expect(readConv.rows).toHaveLength(0);

    const readMsgs = await asRole(db, "authenticated", TENANT_B, () =>
      db.query("select * from public.messages where conversation_id = $1", [aliceConv]),
    );
    expect(readMsgs.rows).toHaveLength(0);

    // Direct deletes are revoked from authenticated API users
    await asRole(db, "authenticated", TENANT_B, async () => {
      await expect(
        db.query("delete from public.conversations where id = $1", [aliceConv]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("delete from public.messages where conversation_id = $1", [aliceConv]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("knowledge answers", () => {
  it("lets an owner read saved answers, but only the server can write them", async () => {
    await svc(() => db.exec("insert into public.accounts (clerk_user_id) values ('user_ans') on conflict do nothing"));
    const id = await createProject("user_ans", "Answers", "pk_ans1", 10);
    const src = await svc(async () => {
      const r = await db.query<{ id: string }>(
        "insert into public.knowledge_sources (project_id, title, type, status, answers) values ($1, 'Business answers', 'text', 'ready', $2::jsonb) returning id",
        [id, JSON.stringify({ template: "shop", items: [{ question: "Hours?", answer: "9 to 5" }] })],
      );
      return r.rows[0]!.id;
    });
    const own = await asRole(db, "authenticated", "user_ans", () =>
      db.query<{ answers: { items: { answer: string }[] } }>("select answers from public.knowledge_sources where id = $1", [src]),
    );
    expect(own.rows[0]?.answers.items[0]?.answer).toBe("9 to 5");

    const other = await asRole(db, "authenticated", BOB, () =>
      db.query("select answers from public.knowledge_sources where id = $1", [src]),
    );
    expect(other.rows).toHaveLength(0);

    await asRole(db, "authenticated", "user_ans", async () => {
      await expect(db.query("update public.knowledge_sources set answers = '{}' where id = $1", [src])).rejects.toThrow(/permission denied/);
    });
  });
  it("refuses answers that are too large", async () => {
    await svc(() => db.exec("insert into public.accounts (clerk_user_id) values ('user_ans') on conflict do nothing"));
    const id = await createProject("user_ans", "Answers2", "pk_ans2", 10);
    await svc(async () => {
      await expect(
        db.query("insert into public.knowledge_sources (project_id, title, type, status, answers) values ($1, 'x', 'text', 'ready', $2::jsonb)", [
          id,
          JSON.stringify({ blob: "a".repeat(100_100) }),
        ]),
      ).rejects.toThrow(/check/);
    });
  });

  describe("leads", () => {
    it("lets an owner read leads of their projects, hides them from others", async () => {
      await svc(() =>
        db.exec("insert into public.accounts (clerk_user_id) values ('user_leads_alice'), ('user_leads_bob') on conflict do nothing"),
      );
      const aliceProj = await createProject("user_leads_alice", "Alice Proj", "pk_leads_alice", 10);
      const bobProj = await createProject("user_leads_bob", "Bob Proj", "pk_leads_bob", 10);

      // Insert via service_role
      await svc(async () => {
        await db.query("insert into public.leads (project_id, email, name, phone) values ($1, $2, $3, $4)", [
          aliceProj,
          "lead@alice.com",
          "Alice Lead",
          "+1234567890",
        ]);
        await db.query("insert into public.leads (project_id, email, name) values ($1, $2, $3)", [
          bobProj,
          "lead@bob.com",
          "Bob Lead",
        ]);
      });

      // Alice can read her own lead
      const aliceLeads = await asRole(db, "authenticated", "user_leads_alice", () =>
        db.query<{ email: string }>("select email from public.leads where project_id = $1", [aliceProj]),
      );
      expect(aliceLeads.rows.map((r) => r.email)).toEqual(["lead@alice.com"]);

      // Alice cannot read Bob's leads
      const aliceReadBob = await asRole(db, "authenticated", "user_leads_alice", () =>
        db.query<{ email: string }>("select email from public.leads where project_id = $1", [bobProj]),
      );
      expect(aliceReadBob.rows).toEqual([]);

      // Anon cannot read any leads
      await expect(
        asRole(db, "anon", null, () => db.query("select * from public.leads")),
      ).rejects.toThrow(/permission denied/);

      // Authenticated cannot insert directly (service_role only)
      await expect(
        asRole(db, "authenticated", "user_leads_alice", () =>
          db.query("insert into public.leads (project_id, email) values ($1, 'evil@test.com')", [aliceProj]),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
