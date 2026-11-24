import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

import { groupAvisos, isVisible, avisoLabel } from "./avisosApi";

describe("avisos", () => {
  it("oculta regras desativadas e mantém tipos desconhecidos", () => {
    const rules = [{ kind: "new_campaign", visible: false }, { kind: "premium_activated", visible: true }];
    expect(isVisible("new_campaign", rules)).toBe(false);
    expect(isVisible("premium_activated", rules)).toBe(true);
    expect(isVisible("outro", rules)).toBe(true);
  });
  it("agrupa por data e identifica categorias", () => {
    const base = { type: "wallet_credited", title: "Saldo", message: "", read: false };
    const groups = groupAvisos([{ ...base, id: "1", created_at: "2026-11-20T12:00:00Z" }, { ...base, id: "2", created_at: "2026-11-20T13:00:00Z" }]);
    expect(Object.values(groups)[0]).toHaveLength(2);
    expect(avisoLabel("wallet_credited")).toBe("Saldo");
    expect(avisoLabel("premium_activated")).toBe("Premium");
    expect(avisoLabel("buky_raffle_won")).toBe("Sorteio");
  });
});
