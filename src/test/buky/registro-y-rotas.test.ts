import { describe, expect, it } from "vitest";
import { cleanInstagram, isValidInstagram, isValidNeighborhood, isValidPassword, normalizeName } from "@/features/buky/lib/validation";
import { checkDraft } from "@/features/buky/lib/routeDraft";

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

describe("borrador de ruta del atleta (mismas reglas que el servidor)", () => {
  const rules = { minGapM: 200, minLengthM: 1000, minPoints: 3, maxPoints: 30, dailyCap: 10, maxCityKm: 60 };
  const M = 1 / 111_320;
  const at = (m: number) => ({ lat: -22.9 - m * M, lon: -43.12 });

  it("ruta válida: 4 puntos cada 400 m", () => {
    const c = checkDraft([0, 400, 800, 1200].map(at), rules, at(0));
    expect(c.ok).toBe(true);
    expect(Math.round(c.lengthM)).toBeGreaterThan(1190);
  });
  it("marca puntos demasiado cerca, ruta corta y pocos puntos", () => {
    const c = checkDraft([0, 100, 600].map(at), rules, at(0));
    expect(c.problems).toEqual(expect.arrayContaining(["points_too_close", "route_too_short"]));
    expect(c.tooClose).toEqual([0, 1]);
    expect(checkDraft([0, 1500].map(at), rules).problems).toContain("points_count");
  });
  it("marca puntos fuera de la ciudad", () => {
    const c = checkDraft([at(0), at(400), { lat: -23.55, lon: -46.63 }], rules, at(0));
    expect(c.outside).toEqual([2]);
  });
});
