import { widgetConfigQuerySchema } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { generatePublicKey } from "./public-key";

describe("generatePublicKey", () => {
  it("starts with pk_ and is accepted by the shared schema", () => {
    expect(widgetConfigQuerySchema.safeParse({ key: generatePublicKey() }).success).toBe(true);
  });
  it("is different every time", () => {
    const keys = new Set(Array.from({ length: 200 }, generatePublicKey));
    expect(keys.size).toBe(200);
  });
});
