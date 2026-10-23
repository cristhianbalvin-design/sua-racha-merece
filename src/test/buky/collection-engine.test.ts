import { describe, expect, it } from "vitest";
import { CollectionEngine, replayPasses } from "@/features/buky/engine/collectionEngine";
import { haversineMeters } from "@/features/buky/engine/geo";
import type { BukyPoint, GpsReading } from "@/features/buky/gps/types";

// Punto de referencia en Niterói. 1 m hacia el norte ≈ 1/111 320 grados de latitud.
const BASE = { lat: -22.9035, lon: -43.1153 };
const M = 1 / 111_320;
const point = (id: string, northM = 0, radiusM = 50): BukyPoint => ({
  id,
  label: id,
  lat: BASE.lat + northM * M,
  lon: BASE.lon,
  radiusM,
});

let seq = 0;
let clock = 1_800_000_000_000;
/** Lectura a `northM` metros al norte del punto base, 4 s después de la anterior. */
const at = (northM: number, extra: Partial<GpsReading> = {}): GpsReading => {
  clock += 4_000;
  const r: GpsReading = {
    id: `r${seq}`,
    sessionId: "s",
    seq: seq++,
    fixTime: clock,
    receivedAt: clock + 200,
    lat: BASE.lat + northM * M,
    lon: BASE.lon,
    accuracy: 8,
    speed: null,
    altitude: null,
    bearing: null,
    simulated: false,
    ...extra,
  };
  return r;
};
const passesOf = (engine: CollectionEngine, readings: GpsReading[]) =>
  readings.flatMap((r) => engine.process(r).passes);

describe("geo", () => {
  it("haversine mide ~100 m para 100 m al norte", () => {
    const d = haversineMeters(BASE.lat, BASE.lon, BASE.lat + 100 * M, BASE.lon);
    expect(d).toBeGreaterThan(99);
    expect(d).toBeLessThan(101);
  });
});

describe("CollectionEngine", () => {
  it("registra una pasada con 2 lecturas seguidas dentro", () => {
    const e = new CollectionEngine([point("P1")]);
    expect(e.process(at(70)).passes).toHaveLength(0);
    expect(e.process(at(30)).passes).toHaveLength(0);
    expect(e.stateOf("P1").state).toBe("CONFIRMING");
    const res = e.process(at(10));
    expect(res.passes).toHaveLength(1);
    expect(res.passes[0].pointId).toBe("P1");
    expect(e.stateOf("P1").state).toBe("VISITED");
  });

  it("quedarse dentro no suma más pasadas", () => {
    const e = new CollectionEngine([point("P1")]);
    const p = passesOf(e, [at(10), at(5), at(0), at(5), at(10), at(15)]);
    expect(p).toHaveLength(1);
  });

  it("una sola lectura dentro no cuenta", () => {
    const e = new CollectionEngine([point("P1")]);
    expect(passesOf(e, [at(100), at(20), at(100), at(110)])).toHaveLength(0);
  });

  it("salir y volver cuenta otra vez", () => {
    const e = new CollectionEngine([point("P1")]);
    const p = passesOf(e, [at(20), at(10), at(40), at(70), at(80), at(40), at(20)]);
    expect(p).toHaveLength(2);
  });

  it("oscilar en el borde (entre 50 y 60 m) no vuelve a contar", () => {
    const e = new CollectionEngine([point("P1")]);
    const p = passesOf(e, [at(10), at(5), at(55), at(45), at(58), at(48), at(30)]);
    expect(p).toHaveLength(1);
  });

  it("descarta lecturas imprecisas (> 25 m)", () => {
    const e = new CollectionEngine([point("P1")]);
    const r = e.process(at(5, { accuracy: 40 }));
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("imprecise");
    expect(passesOf(e, [at(5, { accuracy: 30 }), at(5, { accuracy: 26 })])).toHaveLength(0);
  });

  it("descarta lecturas antiguas (> 20 s)", () => {
    const e = new CollectionEngine([point("P1")]);
    const old = at(5);
    const r = e.process(old, old.fixTime + 25_000);
    expect(r.reason).toBe("stale");
  });

  it("descarta un salto GPS anómalo y lo acepta tras 3 seguidos", () => {
    const e = new CollectionEngine([point("P1", 0), point("FAR", 2_000)]);
    expect(e.process(at(0)).accepted).toBe(true);
    // 2 km en 4 s = 500 m/s
    expect(e.process(at(2_000)).reason).toBe("jump");
    expect(e.process(at(2_000)).reason).toBe("jump");
    expect(e.process(at(2_000)).accepted).toBe(true);
  });

  it("ejemplo 3 + 2 + 1 = 6 pasadas en 3 puntos", () => {
    const pts = [point("A", 0), point("B", 300), point("C", 600)];
    const visit = (m: number) => [at(m + 10), at(m)];
    const away = (m: number) => [at(m + 150)];
    const readings = [
      ...visit(0), ...away(0), ...visit(0), ...away(0), ...visit(0), ...away(0),
      ...visit(300), ...away(300), ...visit(300), ...away(300),
      ...visit(600), ...away(600),
    ];
    // Ajuste: cada tramo de 150 m en 4 s es 37 m/s → serían saltos. Se usa replay con
    // un límite de velocidad alto para probar solo el conteo de pasadas.
    const { passes } = replayPasses(pts, readings, { maxJumpSpeedMs: 1_000 });
    const count = (id: string) => passes.filter((p) => p.pointId === id).length;
    expect(count("A")).toBe(3);
    expect(count("B")).toBe(2);
    expect(count("C")).toBe(1);
    expect(passes).toHaveLength(6);
  });

  it("recorrido continuo a pie por 8 puntos cuenta 8 pasadas", () => {
    const pts = Array.from({ length: 8 }, (_, i) => point(`BUKY_0${i + 1}`, i * 200));
    const readings: GpsReading[] = [];
    // 3 m/s (trote), una lectura cada 4 s = 12 m entre lecturas
    for (let m = -100; m <= 1_600; m += 12) readings.push(at(m));
    const { passes, rejected } = replayPasses(pts, readings);
    expect(rejected.jump).toBe(0);
    expect(new Set(passes.map((p) => p.pointId)).size).toBe(8);
    expect(passes).toHaveLength(8);
  });

  it("marca como simuladas las pasadas con ubicación falsa", () => {
    const e = new CollectionEngine([point("P1")]);
    const p = passesOf(e, [at(5, { simulated: true }), at(0, { simulated: true })]);
    expect(p[0].simulated).toBe(true);
  });
});
