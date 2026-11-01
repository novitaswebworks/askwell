import { describe, expect, it } from "vitest";
import { extractText, looksLikePdf } from "./extract";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("looksLikePdf", () => {
  it("checks the PDF header bytes", () => {
    expect(looksLikePdf(bytes("%PDF-1.7\n..."))).toBe(true);
    expect(looksLikePdf(bytes("<html>"))).toBe(false);
    expect(looksLikePdf(bytes(""))).toBe(false);
  });
});

describe("extractText", () => {
  it("decodes text and markdown as UTF-8", async () => {
    expect(await extractText("txt", bytes("Café open 9-5"))).toBe("Café open 9-5");
    expect(await extractText("md", bytes("# Title\n\nBody"))).toBe("# Title\n\nBody");
  });
  it("strips control characters but keeps newlines and tabs", async () => {
    expect(await extractText("txt", bytes("a\u0000b\tc\nd\u0007"))).toBe("ab\tc\nd");
  });
});
