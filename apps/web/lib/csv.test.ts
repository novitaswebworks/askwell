import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a header and rows, quoting commas, quotes and line breaks", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line1\nline2", "plain"]]);
    expect(csv).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n"line1\nline2",plain\r\n');
  });
  it("defuses spreadsheet formulas", () => {
    const csv = toCsv(["m"], [["=HYPERLINK(\"http://evil\")"], ["+1"], ["-2"], ["@SUM(A1)"], ["ok = fine"]]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(lines.slice(2, 5)).toEqual(["'+1", "'-2", "'@SUM(A1)"]);
    expect(lines[5]).toBe("ok = fine");
  });
  it("handles no rows", () => {
    expect(toCsv(["a"], [])).toBe("﻿a\r\n");
  });
});
