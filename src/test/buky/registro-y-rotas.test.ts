import { describe, expect, it } from "vitest";
import { cleanInstagram, isValidInstagram, isValidNeighborhood, isValidPassword, normalizeName } from "@/features/buky/lib/validation";
import { checkDraft, placeBukys } from "@/features/buky/lib/routeDraft";
import { haversineMeters } from "@/features/buky/engine";

describe("validaciones del registro", () => {
  it("Instagram acepta @usuario, enlaces y rechaza caracteres prohibidos", () => {
    expect(cleanInstagram("@jesus.run")).toBe("jesus.run");
    expect(cleanInstagram("https://www.instagram.com/rafa_corre/")).toBe("rafa_corre");
    expect(isValidInstagram("@rafa.corre")).toBe(true);
    expect(isValidInstagram("no válido!")).toBe(false);
    expect(isValidInstagram("a".repeat(31))).toBe(false);
  });
  it("barrio con mínimo 3 caracteres", () => {
    expect(isValidNeighborhood("  Ingá ")).toBe(true);
    expect(isValidNeighborhood("SG")).toBe(false);
  });
  it("contraseña de 8+ con letras y números", () => {
    expect(isValidPassword("abc12345")).toBe(true);
    expect(isValidPassword("abcdefgh")).toBe(false);
    expect(isValidPassword("1234567")).toBe(false);
  });
  it("normaliza nombres de ciudad como br_norm() del servidor", () => {
    expect(normalizeName("  Niterói, RJ ")).toBe("niteroi rj");
    expect(normalizeName("São Gonçalo")).toBe("sao goncalo");
  });
});

describe("trazo de ruta del atleta (mismas reglas que el servidor, paso 21)", () => {
  const rules = { minGapM: 200, radiusM: 50, minLengthM: 1000, minPoints: 3, maxPoints: 30, dailyCap: 10, maxCityKm: 60 };
  const M = 1 / 111_320;
  const at = (m: number) => ({ lat: -22.9 - m * M, lon: -43.12 });

  it("ubica un Buky cada 200 m; los vértices pueden estar pegados (curvas)", () => {
    const c = checkDraft([at(0), at(5), at(12), at(1112)], rules, at(0));
    expect(c.ok).toBe(true);
    expect(c.bukys).toHaveLength(5);
    expect(Math.abs(c.lengthM - 1112)).toBeLessThan(3);
    expect(Math.round(haversineMeters(at(0).lat, at(0).lon, c.bukys[0].lat, c.bukys[0].lon))).toBe(200);
  });
  it("ida y vuelta por la misma calle no duplica Bukys", () => {
    const c = placeBukys([at(0), at(667), at(0)], 200, 50);
    expect(c.bukys).toHaveLength(3);
  });
  it("corta, larga y fuera de la ciudad", () => {
    expect(checkDraft([at(0), at(300)], rules, at(0)).problems).toContain("route_too_short");
    expect(checkDraft([at(0), at(7800)], rules, at(0)).problems).toContain("route_too_long");
    const c = checkDraft([at(0), at(1200), { lat: -23.55, lon: -46.63 }], rules, at(0));
    expect(c.outside).toEqual([2]);
    expect(c.problems).toContain("point_outside_city");
    expect(checkDraft([at(0)], rules).problems).toContain("path_points");
  });
});
