import { describe, expect, it } from "vitest";
import { monthGrid, periodsByDay, saoPauloDay, shiftDay, shiftMonth, weekRange } from "./raffleCalendar";

describe("raffle calendar", () => {
  it("starts weeks on Monday across year boundaries", () => {
    expect(weekRange("2027-01-01").days).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("builds a complete month grid", () => {
    const grid = monthGrid("2027-02");
    expect(grid[0][0]).toBe("2027-02-01");
    expect(grid.at(-1)?.at(-1)).toBe("2027-02-28");
  });
  it("pads partial weeks and crosses leap days", () => {
    const grid = monthGrid("2028-02");
    expect(grid[0][0]).toBe("2028-01-31");
    expect(grid.at(-1)?.at(-1)).toBe("2028-03-05");
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(weekRange("2028-02-29").from).toBe("2028-02-28");
  });
  it("groups by São Paulo draw day", () => {
    const p = { id: "a", name: "A", starts_at: "", ends_at: "", draw_at: "2027-02-01T01:00:00Z", status: "scheduled", cadence: "weekly", my_tickets: 1, prize_count: 2 };
    expect(saoPauloDay(p.draw_at)).toBe("2027-01-31");
    expect(periodsByDay([p])["2027-01-31"]).toEqual([p]);
    expect(periodsByDay([p, { ...p, id: "b" }])["2027-01-31"]).toHaveLength(2);
  });
});
