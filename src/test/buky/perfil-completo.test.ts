import { describe, expect, it, vi } from "vitest";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({}) }));
vi.mock("@/features/buky/lib/api", () => ({}));
import { isProfileComplete } from "@/features/buky/lib/hooks";
import type { BukyProfile } from "@/features/buky/lib/api";

const base = { id: "u", city_code: null, instagram: null, neighborhood: null, sport: "Corrida", gender: "Feminino", birth_date: "1995-06-01", phone: "+5511999999999" } as unknown as BukyProfile;

describe("perfil completo para jugar", () => {
  it("sin ciudad del catálogo no puede jugar", () => {
    expect(isProfileComplete(base)).toBe(false);
    expect(isProfileComplete({ ...base, instagram: "x", neighborhood: "Icaraí" })).toBe(false);
  });
  it("exige los datos del perfil antiguo además de la ciudad", () => {
    expect(isProfileComplete({ ...base, city_code: 3303302 })).toBe(true);
    for (const key of ["sport", "gender", "birth_date", "phone"] as const) {
      expect(isProfileComplete({ ...base, city_code: 3303302, [key]: null })).toBe(false);
    }
  });
  it("respeta perfiles antiguos completos que aún no tienen city_code", () => {
    expect(isProfileComplete({ ...base, city: "São Paulo", country: "SP" })).toBe(true);
  });
});
