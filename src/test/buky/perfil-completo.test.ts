import { describe, expect, it, vi } from "vitest";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({}) }));
vi.mock("@/features/buky/lib/api", () => ({}));
import { isProfileComplete } from "@/features/buky/lib/hooks";
import type { BukyProfile } from "@/features/buky/lib/api";

const base = { id: "u", city_code: null, instagram: null, neighborhood: null } as unknown as BukyProfile;

describe("perfil completo para jugar", () => {
  it("sin ciudad del catálogo no puede jugar", () => {
    expect(isProfileComplete(base)).toBe(false);
    expect(isProfileComplete({ ...base, instagram: "x", neighborhood: "Icaraí" })).toBe(false);
  });
  it("con ciudad basta: barrio e Instagram son opcionales", () => {
    expect(isProfileComplete({ ...base, city_code: 3303302 })).toBe(true);
  });
});
