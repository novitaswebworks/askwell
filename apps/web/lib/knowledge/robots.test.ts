import { describe, expect, it } from "vitest";
import { isAllowedByRobots, parseRobots } from "./robots";

describe("robots.txt", () => {
  it("allows everything without rules", () => {
    expect(isAllowedByRobots(parseRobots(""), "/anything")).toBe(true);
  });
  it("follows the * group", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/open");
    expect(isAllowedByRobots(rules, "/private/x")).toBe(false);
    expect(isAllowedByRobots(rules, "/private/open/y")).toBe(true);
    expect(isAllowedByRobots(rules, "/public")).toBe(true);
  });
  it("prefers a group for our own name", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: AskwellBot\nAllow: /\nDisallow: /secret");
    expect(isAllowedByRobots(rules, "/page")).toBe(true);
    expect(isAllowedByRobots(rules, "/secret")).toBe(false);
  });
  it("blocks the whole site on Disallow: /", () => {
    expect(isAllowedByRobots(parseRobots("User-agent: *\nDisallow: /"), "/")).toBe(false);
  });
  it("supports * and $ and ignores comments and empty Disallow", () => {
    const rules = parseRobots("User-agent: * # all\nDisallow: /*.pdf$\nDisallow: /tmp*/cache # c\nDisallow:");
    expect(isAllowedByRobots(rules, "/a/file.pdf")).toBe(false);
    expect(isAllowedByRobots(rules, "/a/file.pdf?x=1")).toBe(true);
    expect(isAllowedByRobots(rules, "/tmp42/cache")).toBe(false);
    expect(isAllowedByRobots(rules, "/ok")).toBe(true);
  });
  it("merges consecutive User-agent lines into one group", () => {
    const rules = parseRobots("User-agent: Foo\nUser-agent: *\nDisallow: /x");
    expect(isAllowedByRobots(rules, "/x")).toBe(false);
  });
});
