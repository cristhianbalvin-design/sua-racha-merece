import { describe, expect, it } from "vitest";
import { evaluateFreeSession, type GpsReading } from "../../../../supabase/functions/_shared/buky/engine";

function track(speeds: number[], simulated = false): GpsReading[] {
  let lat = 0;
  return speeds.map((speed, i) => {
    if (i) lat += speed / 3.6 * 10 / 111_195;
    return { id: String(i), sessionId: "s", seq: i, fixTime: i * 10_000,
      receivedAt: i * 10_000, lat, lon: 0, accuracy: 5, speed: null,
      altitude: null, bearing: null, simulated };
  });
}

describe("treino livre", () => {
  it("emite marcas interpoladas a cada 1,5 km", () => {
    const result = evaluateFreeSession(track(Array(121).fill(10)), {}, {}, 1.5);
    expect(result.marks.map((m) => m.kmMark)).toEqual([1.5, 3]);
    expect(result.marks[0].at).toBeGreaterThan(530_000);
    expect(result.marks[0].at).toBeLessThan(550_000);
  });

  it("no suma caminatas ni tramos rápidos", () => {
    const result = evaluateFreeSession(track([...Array(200).fill(4), ...Array(100).fill(30)]));
    expect(result.marks).toHaveLength(0);
    expect(result.stats.distanceM).toBeLessThan(100);
  });

  it("rechaza las marcas de una sesión con ubicación simulada", () => {
    const readings = track(Array(121).fill(10));
    readings[0].simulated = true;
    const result = evaluateFreeSession(readings, { mockMaxRatio: 0.001 });
    expect(result.status).toBe("invalid");
    expect(result.marks.length).toBeGreaterThan(0);
    expect(result.marks.every((m) => !m.valid && m.rejectReason === "mock_location")).toBe(true);
  });
});
