import { describe, expect, it } from "vitest";
import type { RaffleResult } from "./adminApi";
import { summarizeResults } from "./resultSummary";

const result = (role: RaffleResult["role"], user_id: string | null, delivery_status: RaffleResult["delivery_status"]): RaffleResult =>
  ({ role, user_id, delivery_status }) as RaffleResult;

describe("resumo dos resultados do sorteio", () => {
  it("conta ganhadores, suplentes e estados de entrega sem incluir vagas vazias", () => {
    const results = [
      result("winner", "atleta-1", "notified"),
      result("winner", "atleta-2", "delivered"),
      result("winner", "atleta-3", "expired"),
      result("substitute", "atleta-4", "standby"),
      result("substitute", "atleta-5", "pending"),
      result("substitute", "atleta-6", "delivered"),
      result("winner", null, "unclaimed"),
    ];

    expect(summarizeResults(results)).toEqual({
      winners: 3,
      substitutes: 3,
      pendingDelivery: 2,
      delivered: 2,
      withoutEligibleParticipants: 1,
    });
  });

  it("retorna zeros quando ainda não há resultados", () => {
    expect(summarizeResults([])).toEqual({
      winners: 0,
      substitutes: 0,
      pendingDelivery: 0,
      delivered: 0,
      withoutEligibleParticipants: 0,
    });
  });
});
