import { describe, expect, it } from "vitest";
import { buildCommands, filterCommands, withProject } from "./dashboard-links";

describe("withProject", () => {
  it("adds the project to a page link", () => {
    expect(withProject("/dashboard/knowledge", "abc")).toBe("/dashboard/knowledge?project=abc");
  });
  it("leaves the home link and a missing project alone", () => {
    expect(withProject("/dashboard", "abc")).toBe("/dashboard");
    expect(withProject("/dashboard/leads", null)).toBe("/dashboard/leads");
  });
  it("encodes the id", () => {
    expect(withProject("/dashboard/leads", "a b&c")).toBe("/dashboard/leads?project=a%20b%26c");
  });
});

const links = [{ href: "/dashboard/leads", label: "Leads" }, { href: "/dashboard/billing", label: "Billing" }];
const projects = [{ id: "p1", name: "Acme Travel" }, { id: "p2", name: "Suite Dreams" }];

describe("buildCommands and filterCommands", () => {
  const all = buildCommands(links, projects, "p2");
  it("lists pages (keeping the current project) and projects", () => {
    expect(all.map((c) => c.label)).toEqual(["Leads", "Billing", "Acme Travel", "Suite Dreams"]);
    expect(all[0]!.href).toBe("/dashboard/leads?project=p2");
  });
  it("matches every typed word in any order, ignoring case", () => {
    expect(filterCommands(all, "travel acme").map((c) => c.label)).toEqual(["Acme Travel"]);
    expect(filterCommands(all, "SWITCH").map((c) => c.label)).toEqual(["Acme Travel", "Suite Dreams"]);
    expect(filterCommands(all, "zzz")).toEqual([]);
  });
  it("returns everything for an empty query", () => {
    expect(filterCommands(all, "  ")).toHaveLength(4);
  });
});
