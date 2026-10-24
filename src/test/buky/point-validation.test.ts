import { describe, expect, it } from "vitest";
import { parsePointLines } from "@/features/buky/engine/pointValidation";

const LIMA = { lat: -11.98277, lon: -76.79605 };

describe("parsePointLines", () => {
  it("acepta puntos cercanos con formato correcto", () => {
    const r = parsePointLines("-11.98256, -76.79613\n-11.9830;-76.7955", LIMA);
    expect(r.errors).toEqual([]);
    expect(r.points).toHaveLength(2);
  });

  it("rechaza un punto a miles de km (el caso de la Antártida)", () => {
    const r = parsePointLines("-80.525, -88.675", LIMA);
    expect(r.points).toHaveLength(0);
    expect(r.errors[0]).toMatch(/km de tu posición/);
  });

  it("rechaza coordenadas fuera de rango", () => {
    const r = parsePointLines("-95.1, -76.7", null);
    expect(r.errors[0]).toMatch(/latitud fuera de rango/);
  });

  it("rechaza formatos ambiguos (comas decimales, grados-minutos, enteros)", () => {
    const r = parsePointLines(`-11,98256, -76,79613\n11°58'57.6"S 76°47'45.8"W\n-11 -76`, LIMA);
    expect(r.points).toHaveLength(0);
    expect(r.errors).toHaveLength(3);
  });

  it("sin posición actual solo valida el rango", () => {
    const r = parsePointLines("-80.525, -88.675", null);
    expect(r.points).toHaveLength(1);
  });
});
