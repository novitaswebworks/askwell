// Messages used this month against the plan's limit (project.md section 6.12).
// The counter resets lazily, when the first message of a new month arrives, so a
// project whose period_start is in an earlier month has used none yet.

export interface Usage {
  used: number;
  limit: number;
  percent: number;
  atLimit: boolean;
}

export function usageThisMonth(
  project: { messagesUsed: number; periodStart: string },
  limit: number,
  now: Date,
): Usage {
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const used = project.periodStart.slice(0, 7) < thisMonth ? 0 : project.messagesUsed;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return { used, limit, percent, atLimit: used >= limit };
}
