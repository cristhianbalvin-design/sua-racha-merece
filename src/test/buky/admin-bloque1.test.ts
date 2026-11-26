import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
import { deleteRoute, drawNow, listEntries } from "@/features/buky/admin/adminApi";

describe("admin Buky RPCs", () => {
  beforeEach(() => rpc.mockReset());

  it("reports whether a route was archived", async () => {
    rpc.mockResolvedValue({ data: { status: "archived" }, error: null });
    await expect(deleteRoute("route")).resolves.toBe("archived");
    expect(rpc).toHaveBeenCalledWith("admin_buky_delete_route", { p_route_id: "route" });
  });

  it("passes the test flag to the draw", async () => {
    rpc.mockResolvedValue({ data: { status: "review", duplicate: false }, error: null });
    await expect(drawNow("period", true)).resolves.toMatchObject({ status: "review" });
    expect(rpc).toHaveBeenCalledWith("admin_buky_draw_now", { p_period_id: "period", p_is_test: true });
  });

  it("propagates participant access errors", async () => {
    const result = Promise.resolve({ data: null, error: { message: "forbidden" } });
    const builder = { order: () => builder, range: () => result };
    rpc.mockReturnValue(builder);
    await expect(listEntries("period")).rejects.toThrow("forbidden");
  });
});
