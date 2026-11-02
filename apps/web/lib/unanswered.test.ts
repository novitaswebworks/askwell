import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: vi.fn() }));

import { pairUnanswered } from "./unanswered";

const bot = (c: string, t: string) => ({ conversation_id: c, created_at: t });
const visitor = (c: string, t: string, body: string) => ({ conversation_id: c, created_at: t, body });

describe("pairUnanswered", () => {
  it("pairs each unanswered reply with the visitor message just before it", () => {
    const out = pairUnanswered(
      [bot("c1", "2026-11-02T10:00:02Z")],
      [visitor("c1", "2026-11-02T09:59:00Z", "Earlier"), visitor("c1", "2026-11-02T10:00:01Z", "Do you ship to Nepal?")],
      [],
    );
    expect(out).toEqual([{ question: "Do you ship to Nepal?", count: 1 }]);
  });
  it("ignores visitor messages from other conversations or after the reply", () => {
    expect(
      pairUnanswered(
        [bot("c1", "2026-11-02T10:00:02Z")],
        [visitor("c2", "2026-11-02T10:00:01Z", "Other chat"), visitor("c1", "2026-11-02T10:00:03Z", "Later")],
        [],
      ),
    ).toEqual([]);
  });
  it("groups repeats regardless of case and punctuation, most asked first", () => {
    const out = pairUnanswered(
      [bot("c1", "2026-11-02T10:00:02Z"), bot("c2", "2026-11-02T11:00:02Z"), bot("c3", "2026-11-02T12:00:02Z")],
      [
        visitor("c1", "2026-11-02T10:00:01Z", "Gift wrap?"),
        visitor("c2", "2026-11-02T11:00:01Z", "Do you do gift wrapping"),
        visitor("c3", "2026-11-02T12:00:01Z", "gift wrap??"),
      ],
      [],
    );
    expect(out).toEqual([
      { question: "Gift wrap?", count: 2 },
      { question: "Do you do gift wrapping", count: 1 },
    ]);
  });
  it("leaves out questions the owner has already answered", () => {
    expect(
      pairUnanswered(
        [bot("c1", "2026-11-02T10:00:02Z")],
        [visitor("c1", "2026-11-02T10:00:01Z", "What are your hours?")],
        ["what are your hours"],
      ),
    ).toEqual([]);
  });
  it("shows at most ten", () => {
    const bots = Array.from({ length: 15 }, (_, i) => bot(`c${i}`, "2026-11-02T10:00:02Z"));
    const visitors = Array.from({ length: 15 }, (_, i) => visitor(`c${i}`, "2026-11-02T10:00:01Z", `Question number ${i}`));
    expect(pairUnanswered(bots, visitors, [])).toHaveLength(10);
  });
});
