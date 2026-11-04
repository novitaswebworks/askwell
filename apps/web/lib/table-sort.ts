// Sorting and date filtering for dashboard tables. Pure, so they are unit tested.

export type SortDir = "asc" | "desc";

export function nextSort<K extends string>(current: { key: K; dir: SortDir }, key: K): { key: K; dir: SortDir } {
  if (current.key !== key) return { key, dir: key === "createdAt" ? "desc" : "asc" };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

// Empty values sort last whichever way the column is sorted.
export function sortRows<T, K extends keyof T>(rows: T[], key: K, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const aEmpty = av === null || av === undefined || av === "";
    const bEmpty = bv === null || bv === undefined || bv === "";
    if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true }) * sign;
  });
}

export type DateRange = "all" | "7" | "30";

export function withinRange<T extends { createdAt: string }>(rows: T[], range: DateRange, now: Date): T[] {
  if (range === "all") return rows;
  const cutoff = now.getTime() - Number(range) * 86_400_000;
  return rows.filter((r) => Date.parse(r.createdAt) >= cutoff);
}
