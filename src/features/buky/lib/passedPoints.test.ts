import { afterEach, describe, expect, it, vi } from "vitest";
import { listMyPassedPointsToday } from "./api";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }));

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("listMyPassedPointsToday", () => {
  it("filtra o usuário, a rota e o dia de São Paulo e remove duplicados", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T01:00:00Z"));
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [{ point_id: "a" }, { point_id: "a" }, { point_id: "b" }], error: null }),
    };
    mocks.from.mockReturnValue(query);
    expect(await listMyPassedPointsToday("user", "route")).toEqual(["a", "b"]);
    expect(mocks.from).toHaveBeenCalledWith("buky_passes");
    expect(query.eq.mock.calls).toEqual([["user_id", "user"], ["route_id", "route"], ["valid", true], ["local_day", "2026-11-26"]]);
  });
});
