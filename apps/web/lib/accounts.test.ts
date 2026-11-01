import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ensureAccount } from "./accounts";

function fakeClient(error: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { from } as never, from, upsert };
}

describe("ensureAccount", () => {
  it("upserts the Clerk user without overwriting an existing row", async () => {
    const { client, from, upsert } = fakeClient();
    await ensureAccount("user_123", client);
    expect(from).toHaveBeenCalledWith("accounts");
    expect(upsert).toHaveBeenCalledWith(
      { clerk_user_id: "user_123" },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    );
  });

  it("throws when the database call fails", async () => {
    const { client } = fakeClient({ message: "boom" });
    await expect(ensureAccount("user_123", client)).rejects.toThrow("Could not create account: boom");
  });
});
