import { describe, expect, it } from "vitest";
import {
  cartTotal,
  exchangeAvailable,
  maskCep,
  shopStatusLabels,
  shopOrderTimeline,
} from "@/features/buky/lib/shop";
describe("loja", () => {
  it("limita e formata o CEP", () => {
    expect(maskCep("24210470")).toBe("24210-470");
    expect(maskCep("24x21047099")).toBe("24210-470");
  });
  it("soma produtos e frete em centavos", () => {
    expect(
      cartTotal(
        [
          { unit_cents: 1234, qty: 2 },
          { unit_cents: 100, qty: 1 },
        ],
        300,
      ),
    ).toBe(2868);
  });
  it("apresenta frete a combinar e as etapas do pedido", () => {
    expect(cartTotal([{ unit_cents: 1234, qty: 2 }])).toBe(2468);
    expect(shopStatusLabels.awaiting_freight).toBe("Aguardando frete");
    expect(shopStatusLabels.freight_pending).toBe("Frete aguardando pagamento");
    expect(shopOrderTimeline).toBe(
      "Pagamento → Frete → Preparando → Enviado → Entregue",
    );
  });
  it("restringe a troca a pedidos entregues no prazo", () => {
    const t = Date.parse("2026-01-01T00:00:00Z");
    expect(
      exchangeAvailable(
        "delivered",
        new Date(t).toISOString(),
        t + 7 * 86400000,
      ),
    ).toBe(true);
    expect(
      exchangeAvailable(
        "delivered",
        new Date(t).toISOString(),
        t + 7 * 86400000 + 1,
      ),
    ).toBe(false);
    expect(exchangeAvailable("shipped", new Date(t).toISOString(), t)).toBe(
      false,
    );
    expect(shopStatusLabels.cancelled).toBe("Cancelado");
  });
});
