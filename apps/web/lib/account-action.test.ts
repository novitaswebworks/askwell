import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const ensureAccount = vi.fn();
vi.mock("./accounts", () => ({ ensureAccount: (...a: unknown[]) => ensureAccount(...a) }));

import { ensureAccountAction } from "./account-action";

beforeEach(() => vi.clearAllMocks());

describe("ensureAccountAction", () => {
  it("creates the account for the signed-in user", async () => {
    auth.mockResolvedValue({ userId: "user_1" });
    await ensureAccountAction();
    expect(ensureAccount).toHaveBeenCalledWith("user_1");
  });
  it("does nothing when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    await ensureAccountAction();
    expect(ensureAccount).not.toHaveBeenCalled();
  });
});
