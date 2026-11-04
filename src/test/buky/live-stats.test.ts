import { describe, expect, it } from "vitest";
import { LiveStats } from "@/features/buky/training/liveStats";

const M = 1 / 111_320;
describe("estadísticas en vivo del entrenamiento", () => {
  it("corriendo a 10 km/h: distancia, velocidad y recorrido", () => {
    const s = new LiveStats();
    // 2,78 m/s = 10 km/h, una lectura por segundo durante 60 s
    for (let i = 0; i <= 60; i++) s.add(-22.9 - i * 2.7778 * M, -43.12, i * 1000);
    const snap = s.snapshot();
    expect(snap.distanceM).toBeGreaterThan(160);
    expect(snap.distanceM).toBeLessThan(175);
    expect(snap.speedKmh!).toBeGreaterThan(9);
    expect(snap.speedKmh!).toBeLessThan(11);
    expect(snap.track.length).toBeGreaterThan(20);
  });
  it("quieto con ruido del GPS no suma distancia", () => {
    const s = new LiveStats();
    for (let i = 0; i <= 30; i++) s.add(-22.9 + (i % 2) * 2 * M, -43.12, i * 1000);
    expect(s.snapshot().distanceM).toBe(0);
    expect(s.snapshot().speedKmh).toBe(0);
  });
  it("sin lecturas suficientes no inventa velocidad", () => {
    const s = new LiveStats();
    s.add(-22.9, -43.12, 0);
    expect(s.snapshot().speedKmh).toBeNull();
  });
});
