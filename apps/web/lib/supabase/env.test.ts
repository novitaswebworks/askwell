import { describe, expect, it } from "vitest";
import { requireEnv } from "./env";

describe("requireEnv", () => {
  it("returns the value when set", () => {
    expect(requireEnv("X", "abc")).toBe("abc");
  });
  it("throws a clear error when missing or empty", () => {
    expect(() => requireEnv("SUPABASE_SECRET_KEY", undefined)).toThrow(
      "Missing environment variable: SUPABASE_SECRET_KEY",
    );
    expect(() => requireEnv("X", "")).toThrow(/Missing environment variable: X/);
  });
});
