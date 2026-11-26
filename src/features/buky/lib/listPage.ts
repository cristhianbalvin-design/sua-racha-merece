/** Stable presentation helpers for lists already loaded by a query. */
export function groupByMonth<T>(items: T[], dayOf: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const month = dayOf(item).slice(0, 7);
    (groups[month] ??= []).push(item);
  }
  return groups;
}

export function pageSlice<T>(items: T[], shown: number): T[] {
  return items.slice(0, Math.max(0, shown));
}

export function appendUniquePage<T extends { id: string }>(previous: T[], next: T[], offset: number): T[] {
  if (offset === 0) return next;
  const ids = new Set(next.map((item) => item.id));
  return [...previous.filter((item) => !ids.has(item.id)), ...next];
}
