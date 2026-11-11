import { describe, expect, it } from "vitest";
import { bukysLabel, fitRoute, stickerLayout } from "./stickerLayout";

describe("sticker", () => {
  it("mantém o quadrado e centraliza a composição na story", () => {
    expect(stickerLayout("sticker")).toMatchObject({ width: 1080, height: 1080, sticker: { x: 0, y: 0, size: 1080 } });
    expect(stickerLayout("story")).toMatchObject({ width: 1080, height: 1920, sticker: { x: 0, y: 270, size: 1080 } });
  });
  it("ajusta o percurso ? ?rea sem deform?-lo", () => {
    const points = fitRoute(
      [
        { lat: 0, lon: 0 },
        { lat: 1, lon: 1 },
      ],
      { x: 10, y: 20, width: 50, height: 80 },
    );
    expect(points).toHaveLength(2);
    expect(points[0].x).toBeCloseTo(10);
    expect(points[1].x).toBeCloseTo(60);
    expect(points.every((p) => p.y >= 20 && p.y <= 100)).toBe(true);
    expect(fitRoute([], { x: 0, y: 0, width: 1, height: 1 })).toEqual([]);
  });
  it("usa o dia de São Paulo para distinguir hoje de outra data", () => {
    const now = new Date("2026-11-11T02:00:00Z");
    expect(bukysLabel("2026-11-10T12:00:00Z", now)).toBe("BUKYS HOJE");
    expect(bukysLabel("2026-11-09T12:00:00Z", now)).toBe("BUKYS · 09/11");
  });
});
