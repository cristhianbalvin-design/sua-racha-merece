import { describe, expect, it } from "vitest";
import { computeCoverage } from "@/features/buky/engine/coverage";
import type { GpsReading } from "@/features/buky/gps/types";

const r = (seq: number, fixTime: number, extra: Partial<GpsReading> = {}): GpsReading => ({
  id: `r${seq}`,
  sessionId: "s",
  seq,
  fixTime,
  receivedAt: fixTime + 100,
  lat: 0,
  lon: 0,
  accuracy: 8,
  speed: null,
  altitude: null,
  bearing: null,
  simulated: false,
  ...extra,
});

describe("computeCoverage", () => {
  it("lecturas cada segundo durante 10 min: 100 % y pasa", () => {
    const start = 0;
    const readings = Array.from({ length: 600 }, (_, i) => r(i, 3_000 + i * 1_000));
    const rep = computeCoverage(readings, start, 3_000 + 599 * 1_000 + 500);
    expect(rep.timeToFirstFixMs).toBe(3_000);
    expect(rep.coveragePct).toBeCloseTo(100, 0);
    expect(rep.maxGapMs).toBeLessThanOrEqual(1_000);
    expect(rep.gaps).toHaveLength(0);
    expect(rep.passesCriteria).toBe(true);
  });

  it("un hueco de 60 s se reporta y la prueba no pasa", () => {
    const readings = [
      ...Array.from({ length: 300 }, (_, i) => r(i, i * 1_000)),
      ...Array.from({ length: 300 }, (_, i) => r(300 + i, 359_000 + i * 1_000)),
    ];
    const rep = computeCoverage(readings, 0, 659_000);
    expect(rep.gaps).toHaveLength(1);
    expect(rep.gaps[0].durationMs).toBe(60_000);
    expect(rep.maxGapMs).toBe(60_000);
    expect(rep.passesCriteria).toBe(false);
    // 50 s sin cubrir (60 - 10 tolerados) sobre 659 s
    expect(rep.coveragePct).toBeCloseTo(100 * (1 - 50_000 / 659_000), 1);
  });

  it("si la app deja de recibir lecturas antes de detener, cuenta como hueco final", () => {
    const readings = Array.from({ length: 60 }, (_, i) => r(i, i * 1_000));
    const rep = computeCoverage(readings, 0, 59_000 + 120_000);
    expect(rep.maxGapMs).toBe(120_000);
    expect(rep.passesCriteria).toBe(false);
  });

  it("calcula retraso de entrega y precisión", () => {
    const readings = [
      r(0, 1_000, { receivedAt: 1_100, accuracy: 5 }),
      r(1, 2_000, { receivedAt: 2_100, accuracy: 30 }),
      r(2, 3_000, { receivedAt: 9_000, accuracy: 10 }),
    ];
    const rep = computeCoverage(readings, 0, 3_000);
    expect(rep.deliveryDelayMs.max).toBe(6_000);
    expect(rep.deliveryDelayMs.median).toBe(100);
    expect(rep.accurateReadingsPct).toBeCloseTo(66.67, 1);
    expect(rep.medianAccuracyM).toBe(10);
  });

  it("teléfono quieto con lecturas cada ~7 s cuenta como cubierto", () => {
    const readings = Array.from({ length: 40 }, (_, i) => r(i, i * 7_300));
    const rep = computeCoverage(readings, 0, 39 * 7_300 + 1_000);
    expect(rep.coveragePct).toBeCloseTo(100, 0);
    expect(rep.passesCriteria).toBe(true);
  });

  it("sin lecturas no pasa", () => {
    const rep = computeCoverage([], 0, 60_000);
    expect(rep.readings).toBe(0);
    expect(rep.timeToFirstFixMs).toBeNull();
    expect(rep.passesCriteria).toBe(false);
  });
});
