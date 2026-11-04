// The numbers on the dashboard home: the last 30 days of activity across all of an owner's
// projects. Pure helpers, so they are unit tested without a database.

export const OVERVIEW_DAYS = 30;
// Daily counts are read from the messages themselves; this caps one read.
export const MAX_OVERVIEW_ROWS = 10_000;

export interface DayCount {
  day: string; // YYYY-MM-DD, UTC
  count: number;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// One entry per day for the last `days` days, oldest first, zero where nothing happened.
export function dailyCounts(createdAt: string[], now: Date, days = OVERVIEW_DAYS): DayCount[] {
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    counts.set(dayKey(new Date(now.getTime() - i * 86_400_000)), 0);
  }
  for (const iso of createdAt) {
    const key = iso.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([day, count]) => ({ day, count }));
}

// Whole percent, or null when there is nothing to divide by.
export function percentOf(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

export function sinceIso(now: Date, days = OVERVIEW_DAYS): string {
  const start = new Date(now.getTime() - (days - 1) * 86_400_000);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

export interface Overview {
  questions: number;
  conversations: number;
  answeredPercent: number | null; // of the bot's replies, how many were real answers
  helpfulPercent: number | null; // thumbs up of all thumbs
  daily: DayCount[];
  truncated: boolean;
}

export function buildOverview(input: {
  visitorMessageTimes: string[];
  conversations: number;
  botReplies: number;
  unansweredReplies: number;
  thumbsUp: number;
  thumbsDown: number;
  now: Date;
}): Overview {
  return {
    questions: input.visitorMessageTimes.length,
    conversations: input.conversations,
    answeredPercent: percentOf(Math.max(0, input.botReplies - input.unansweredReplies), input.botReplies),
    helpfulPercent: percentOf(input.thumbsUp, input.thumbsUp + input.thumbsDown),
    daily: dailyCounts(input.visitorMessageTimes, input.now),
    truncated: input.visitorMessageTimes.length >= MAX_OVERVIEW_ROWS,
  };
}
