// A small robots.txt reader. We follow the group for our own name if there is one,
// otherwise the "*" group. The longest matching rule wins and Allow beats Disallow on a tie.

export const CRAWLER_NAME = "AskwellBot";

interface Rule {
  allow: boolean;
  pattern: string;
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function parseRobots(text: string, agent = CRAWLER_NAME): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      if (value !== "") current.rules.push({ allow: field === "allow", pattern: value });
    }
  }
  const name = agent.toLowerCase();
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && name.includes(a)));
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

export function isAllowedByRobots(rules: Rule[], pathAndQuery: string): boolean {
  let best: { length: number; allow: boolean } | null = null;
  for (const rule of rules) {
    if (!patternToRegExp(rule.pattern).test(pathAndQuery)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { length, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}
