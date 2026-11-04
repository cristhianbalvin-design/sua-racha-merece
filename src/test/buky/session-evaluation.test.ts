import { describe, expect, it } from "vitest";
import { evaluateSession, windowedSpeedsKmh, type BukyPoint, type GpsReading } from "@/features/buky/engine";

// Ruta recta hacia el norte en Niterói: 1 m ≈ 1/111 320 grados de latitud.
const BASE = { lat: -22.9035, lon: -43.1153 };
const M = 1 / 111_320;
const T0 = 1_800_000_000_000;
const route: BukyPoint[] = [0, 400, 800, 1200].map((m, i) => ({
  id: `P${i + 1}`,
  label: `P${i + 1}`,
  lat: BASE.lat + m * M,
  lon: BASE.lon,
  radiusM: 50,
}));

/**
 * Recorrido a velocidad constante, una lectura por segundo.
 * `segments`: tramos [km/h, segundos]. Empieza 100 m antes del primer punto.
 */
function track(segments: [number, number][], extra: Partial<GpsReading> = {}): GpsReading[] {
  const out: GpsReading[] = [];
  let pos = -100;
  let t = T0;
  let seq = 0;
  for (const [kmh, secs] of segments) {
    for (let s = 0; s < secs; s++) {
      out.push({
        id: `r${seq}`,
        sessionId: "s",
        seq: seq++,
        fixTime: t,
        receivedAt: t + 300,
        lat: BASE.lat + pos * M,
        lon: BASE.lon,
        accuracy: 6,
        speed: null,
        altitude: null,
        bearing: null,
        simulated: false,
        ...extra,
      });
      t += 1000;
      pos += kmh / 3.6;
    }
  }
  return out;
}

describe("windowedSpeedsKmh", () => {
  it("mide la velocidad constante del trote", () => {
    const r = track([[10, 120]]);
    const s = windowedSpeedsKmh(r, 30);
    expect(s[60]).toBeCloseTo(10, 0);
  });
});

describe("evaluateSession", () => {
  it("trote de 10 km/h: 4 pasadas válidas y estadísticas", () => {
    const ev = evaluateSession(route, track([[10, 560]]));
    expect(ev.status).toBe("valid");
    expect(ev.passes.map((p) => p.pointId)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(ev.passes.every((p) => p.valid)).toBe(true);
    expect(ev.passes[0].speedKmh).toBeCloseTo(10, 0);
    expect(ev.stats.distanceM).toBeGreaterThan(1500);
    expect(ev.stats.avgSpeedKmh).toBeCloseTo(10, 0);
  });

  it("caminando (4 km/h) no da Bukys pero el entrenamiento es válido", () => {
    const ev = evaluateSession(route, track([[4, 1300]]));
    expect(ev.status).toBe("valid");
    expect(ev.passes.length).toBe(4);
    expect(ev.passes.every((p) => !p.valid && p.rejectReason === "too_slow")).toBe(true);
  });

  it("trote y caminata mezclados: solo cuentan los puntos cruzados trotando", () => {
    // 10 km/h hasta pasar P2 (~500 m → 180 s), luego caminata
    const ev = evaluateSession(route, track([[10, 200], [4, 900]]));
    const valid = ev.passes.filter((p) => p.valid).map((p) => p.pointId);
    expect(valid).toEqual(["P1", "P2"]);
  });

  it("bicicleta a 30 km/h por 40 s: pasadas rechazadas, sesión válida", () => {
    const ev = evaluateSession(route, track([[10, 80], [30, 40], [10, 400]]));
    expect(ev.status).toBe("valid");
    expect(ev.stats.longestFastS).toBeLessThan(60);
    expect(ev.passes.some((p) => p.rejectReason === "too_fast")).toBe(true);
  });

  it("vehículo: 30 km/h sostenidos por más de 60 s anula el entrenamiento", () => {
    const ev = evaluateSession(route, track([[10, 60], [30, 120], [10, 120]]));
    expect(ev.status).toBe("invalid");
    expect(ev.reason).toBe("vehicle");
  });

  it("vehículo rápido (45 km/h) también se detecta pese al filtro de saltos", () => {
    const ev = evaluateSession(route, track([[45, 150]]));
    expect(ev.reason).toBe("vehicle");
  });

  it("ubicación falsa: anula el entrenamiento", () => {
    const ev = evaluateSession(route, track([[10, 560]], { simulated: true }));
    expect(ev.status).toBe("invalid");
    expect(ev.reason).toBe("mock_location");
    expect(ev.passes.every((p) => p.rejectReason === "mock_location")).toBe(true);
  });

  it("descarta lecturas fuera del horario del entrenamiento", () => {
    const r = track([[10, 560]]);
    const ev = evaluateSession(route, r, {}, { from: T0 + 200_000, to: T0 + 600_000 });
    expect(ev.stats.outOfWindow).toBe(200);
    expect(ev.passes.map((p) => p.pointId)).not.toContain("P1");
  });

  it("sin lecturas: inválido", () => {
    expect(evaluateSession(route, []).reason).toBe("no_readings");
  });

  it("respeta los límites configurados por el admin", () => {
    const ev = evaluateSession(route, track([[7, 800]]), { speedMinKmh: 8 });
    expect(ev.passes.every((p) => p.rejectReason === "too_slow")).toBe(true);
  });
});
