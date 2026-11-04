import { describe, expect, it } from "vitest";
import { nextSort, sortRows, withinRange } from "./table-sort";

const rows = [
  { email: "b@x.com", name: "Bo", createdAt: "2026-11-02T00:00:00Z" },
  { email: "a@x.com", name: "", createdAt: "2026-11-04T00:00:00Z" },
  { email: "c@x.com", name: "Cy", createdAt: "2026-10-01T00:00:00Z" },
];

describe("sortRows", () => {
  it("sorts text both ways, case-insensitively", () => {
    expect(sortRows(rows, "email", "asc").map((r) => r.email)).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(sortRows(rows, "email", "desc").map((r) => r.email)).toEqual(["c@x.com", "b@x.com", "a@x.com"]);
  });
  it("puts empty values last in either direction", () => {
    expect(sortRows(rows, "name", "asc").map((r) => r.name)).toEqual(["Bo", "Cy", ""]);
    expect(sortRows(rows, "name", "desc").map((r) => r.name)).toEqual(["Cy", "Bo", ""]);
  });
  it("does not change the input", () => {
    const copy = [...rows];
    sortRows(rows, "email", "asc");
    expect(rows).toEqual(copy);
  });
});

describe("nextSort", () => {
  it("flips the direction on the same column and starts a new one sensibly", () => {
    expect(nextSort({ key: "email", dir: "asc" }, "email")).toEqual({ key: "email", dir: "desc" });
    expect(nextSort({ key: "email", dir: "asc" }, "createdAt")).toEqual({ key: "createdAt", dir: "desc" });
    expect(nextSort({ key: "createdAt", dir: "desc" }, "email")).toEqual({ key: "email", dir: "asc" });
  });
});

describe("withinRange", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  it("keeps everything for all, and the last N days otherwise", () => {
    expect(withinRange(rows, "all", now)).toHaveLength(3);
    expect(withinRange(rows, "7", now).map((r) => r.email)).toEqual(["b@x.com", "a@x.com"]);
    expect(withinRange(rows, "30", now)).toHaveLength(2);
  });
});
