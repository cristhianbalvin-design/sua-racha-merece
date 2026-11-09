import { describe, expect, it } from "vitest";
import { redemptionStatus, redemptionValue } from "@/features/buky/lib/redemption";

describe("validación de premios", () => {
  it("extrae el token solo de la URL de validación de 3buk", () => {
    expect(redemptionValue(" https://www.3buk.com/patrocinador/validar/abc_123?x=1 ")).toBe("abc_123");
    expect(redemptionValue(" ABC-123 ")).toBe("ABC-123");
    expect(redemptionValue("https://example.com/patrocinador/validar/abc")).toBe("https://example.com/patrocinador/validar/abc");
  });

  it("respeta el plazo inclusivo y el estado de entrega", () => {
    const deadline = "2026-11-09T12:00:00Z";
    const prize = { delivery_status: "notified" as const, redeem_deadline: deadline };
    expect(redemptionStatus(prize, Date.parse(deadline))).toBe("available");
    expect(redemptionStatus(prize, Date.parse(deadline) + 1)).toBe("expired");
    expect(redemptionStatus({ delivery_status: "delivered", redeem_deadline: deadline }, Date.parse(deadline) + 1)).toBe("redeemed");
    expect(redemptionStatus({ delivery_status: "standby" })).toBe("inactive");
    expect(redemptionStatus({ delivery_status: "expired" })).toBe("expired");
  });
});
