/** Calendar days use São Paulo civil dates. Weeks start on Monday. */
const zone = "America/Sao_Paulo";
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (day: string) => new Date(`${day}T12:00:00Z`);
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function saoPauloDay(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const d = utc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return key(d).slice(0, 7);
}

export function shiftDay(day: string, delta: number): string {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + delta);
  return key(d);
}

export function weekRange(day: string): { from: string; to: string; days: string[] } {
  const mondayOffset = (utc(day).getUTCDay() + 6) % 7;
  const from = shiftDay(day, -mondayOffset);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(from, i));
  return { from, to: days[6], days };
}

export function monthGrid(month: string): string[][] {
  const first = weekRange(`${month}-01`).from;
  const last = shiftDay(shiftMonth(month, 1) + "-01", -1);
  const weeks: string[][] = [];
  for (let start = first; start <= last; start = shiftDay(start, 7)) {
    weeks.push(weekRange(start).days);
  }
  return weeks;
}

export interface CalendarPeriod {
  id: string; name: string; starts_at: string; ends_at: string; draw_at: string;
  status: string; cadence: string; my_tickets: number; prize_count: number;
}

export function periodsByDay(periods: CalendarPeriod[]): Record<string, CalendarPeriod[]> {
  const grouped: Record<string, CalendarPeriod[]> = {};
  for (const period of periods) {
    const day = saoPauloDay(period.draw_at);
    (grouped[day] ??= []).push(period);
  }
  return grouped;
}
