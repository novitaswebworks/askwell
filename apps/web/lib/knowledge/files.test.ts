import { describe, expect, it } from "vitest";
import { extensionMatchesType, newStorageKey } from "./files";

describe("extensionMatchesType", () => {
  it("accepts matching extensions, case-insensitively", () => {
    expect(extensionMatchesType("Guide.PDF", "pdf")).toBe(true);
    expect(extensionMatchesType("notes.markdown", "md")).toBe(true);
    expect(extensionMatchesType("a.txt", "txt")).toBe(true);
  });
  it("rejects a mismatch", () => {
    expect(extensionMatchesType("a.exe", "pdf")).toBe(false);
    expect(extensionMatchesType("a.pdf", "txt")).toBe(false);
  });
});

describe("newStorageKey", () => {
  it("is scoped to the project and never contains a filename", () => {
    const key = newStorageKey("0b1c2d3e-0000-4000-8000-000000000001", "pdf");
    expect(key).toMatch(/^0b1c2d3e-0000-4000-8000-000000000001\/[0-9a-f-]{36}\.pdf$/);
    expect(newStorageKey("p", "pdf")).not.toBe(newStorageKey("p", "pdf"));
  });
});
