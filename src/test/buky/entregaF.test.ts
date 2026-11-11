import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { isValidCpf, maskCpf } from "@/lib/cpf";
import { topupCents } from "@/lib/walletApi";

describe("Entrega F", () => {
  it("valida e formata CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("529982247259")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
  });
  it("aceita apenas recargas inteiras no intervalo", () => {
    expect(topupCents("10")).toBe(1000);
    expect(topupCents("200")).toBe(20000);
    for (const v of ["", "9", "201", "10.5", "1e2", "-10"]) expect(topupCents(v)).toBeNull();
  });
});
