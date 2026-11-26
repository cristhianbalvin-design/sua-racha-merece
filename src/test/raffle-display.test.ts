import { describe, expect, it } from "vitest";
import { countCouponKinds, participationLabel } from "@/features/buky/lib/raffleDisplay";

describe("raffle display", () => {
  it("counts visible coupons and handles an empty list", () => {
    expect(countCouponKinds([])).toEqual({ physical: 0, digital: 0 });
    expect(countCouponKinds([{ kind: "physical" }, { kind: "digital" }, { kind: "physical" }])).toEqual({ physical: 2, digital: 1 });
  });
  it("describes participation", () => {
    expect(participationLabel(0)).toBe("Você ainda não participa");
    expect(participationLabel(2)).toBe("Participando · 2 tickets");
  });
});
