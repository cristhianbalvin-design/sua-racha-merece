import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { generateCodes } from "@/features/buky/admin/adminApi";

describe("códigos de resgate", () => {
  it("genera N códigos únicos con prefijo y sin caracteres ambiguos", () => {
    const codes = generateCodes(300, "[TESTE] Nike");
    expect(codes).toHaveLength(300);
    expect(new Set(codes).size).toBe(300);
    for (const c of codes) expect(c).toMatch(/^TESTEN-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });
  it("prefijo vacío usa 3BUK", () => {
    expect(generateCodes(1, "··")[0]).toMatch(/^3BUK-/);
  });
});
