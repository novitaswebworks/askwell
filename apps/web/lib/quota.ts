// When to warn an owner that a project is running out of messages.

export type QuotaWarningLevel = 80 | 100;

// How many messages past a threshold we still try to claim the warning. The claim itself is
// atomic (once per month and level); this window only guards against a stale read skipping
// the exact message that crosses the line, without asking the database on every message.
const WINDOW = 4;

// `messagesUsed` is the count read before this message was counted. Returns the warning to
// send for the message just counted, or null.
export function quotaWarningLevel(
  project: { messagesUsed: number; periodStart: string },
  limit: number,
  now: Date,
): QuotaWarningLevel | null {
  if (limit <= 0) return null;
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const before = project.periodStart.slice(0, 7) < thisMonth ? 0 : project.messagesUsed;
  const usedAfter = before + 1;
  const at80 = Math.ceil(limit * 0.8);
  if (usedAfter >= limit && usedAfter < limit + WINDOW) return 100;
  if (usedAfter >= at80 && usedAfter < at80 + WINDOW && usedAfter < limit) return 80;
  return null;
}
