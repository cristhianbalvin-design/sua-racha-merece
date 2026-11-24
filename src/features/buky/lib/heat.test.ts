import { describe, expect, it } from "vitest";
import { trackToHeatCells } from "./heat";
import { BUKY_RADIUS, VERTEX_OPACITY, VERTEX_RADIUS } from "./mapLayerStyles";
describe("heat grid", () => {
  it("groups negative coordinates and ignores inaccurate or invalid fixes", () => {
    expect(
      trackToHeatCells([
        { lat: -22, lon: -43, acc: 5 },
        { lat: -22, lon: -43, acc: 25 },
        { lat: -22, lon: -43, acc: 26 },
        { lat: NaN, lon: 1, acc: 2 },
      ]),
    ).toEqual([{
      x: Math.floor(-43 / 0.0003),
      y: Math.floor(-22 / 0.0003),
      hits: 2,
    }]);
  });
  it("gives Bukys greater visual weight than vertices", () => {
    expect(BUKY_RADIUS).toBeGreaterThan(VERTEX_RADIUS);
    expect(VERTEX_OPACITY).toBeLessThan(1);
  });
});
