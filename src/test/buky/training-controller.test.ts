import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompactReading } from "@/features/buky/lib/api";

// --- servidor simulado
const api = vi.hoisted(() => ({
  startSession: vi.fn(async () => {}),
  heartbeat: vi.fn(async () => {}),
  closeSession: vi.fn(async (_id: string, readings: CompactReading[], _info?: unknown) => ({ status: "valid", reason: null, bukys: 2, balance: 2, readings: readings.length })),
}));
vi.mock("@/features/buky/lib/api", () => ({ ...api, BukyApiError: class extends Error {} }));

// --- almacenamiento en memoria (IndexedDB no existe en jsdom)
const store = vi.hoisted(() => ({ meta: null as unknown, readings: new Map<string, CompactReading[]>() }));
vi.mock("@/features/buky/training/storage", () => ({
  loadMeta: () => store.meta,
  saveMeta: (m: unknown) => (store.meta = m),
  appendReadings: async (id: string, rs: CompactReading[]) => store.readings.set(id, [...(store.readings.get(id) ?? []), ...rs]),
  readReadings: async (id: string) => [...(store.readings.get(id) ?? [])].sort((a, b) => a[0] - b[0]),
  deleteReadings: async (id: string) => void store.readings.delete(id),
}));

import { registerNativeGpsSource, type RawFix } from "@/features/buky/training/gpsSource";

// --- GPS simulado: la prueba empuja posiciones
let push: (f: RawFix) => void = () => {};
registerNativeGpsSource({
  kind: "native",
  background: true,
  start: async (onFix) => {
    push = onFix;
    return async () => {
      push = () => {};
    };
  },
});

const M = 1 / 111_320;
const BASE = { lat: -22.9035, lon: -43.1153 };
const route = {
  id: "r1",
  name: "Orla",
  city_code: 1,
  kind: "official" as const,
  owner_id: null,
  active: true,
  length_m: 500,
  points: [0, 300].map((m, i) => ({ id: `p${i}`, seq: i, label: `BUKY_0${i + 1}`, lat: BASE.lat + m * M, lon: BASE.lon, radiusM: 50 })),
};

let t0 = 1_800_000_000_000;
/** Trote hacia el norte de `fromM` a `toM` metros, 3 m por lectura (1 s). */
function run(fromM: number, toM: number) {
  for (let m = fromM; m <= toM; m += 3) {
    t0 += 1000;
    push({ lat: BASE.lat + m * M, lon: BASE.lon, accuracy: 6, speed: null, simulated: false, fixTime: t0, receivedAt: t0 + 100 });
  }
}

async function freshController() {
  vi.resetModules();
  const mod = await import("@/features/buky/training/controller");
  // El GPS registrado vive en el módulo gpsSource recargado: se vuelve a registrar
  const gps = await import("@/features/buky/training/gpsSource");
  gps.registerNativeGpsSource({ kind: "native", background: true, start: async (onFix) => ((push = onFix), async () => void (push = () => {})) });
  return mod.training;
}

beforeEach(() => {
  store.meta = null;
  store.readings.clear();
  api.closeSession.mockClear();
  api.startSession.mockClear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

describe("controlador del entrenamiento", () => {
  it("inicia, cuenta pasadas en vivo y cierra enviando todas las lecturas", async () => {
    const training = await freshController();
    const seen: string[] = [];
    training.setPassListener((p) => seen.push(p.label));
    await training.start("u1", route, "Niterói");
    expect(api.startSession).toHaveBeenCalledOnce();
    expect(training.getSnapshot().status).toBe("running");

    run(-60, 360);
    expect(seen).toEqual(["BUKY_01", "BUKY_02"]);
    expect(training.getSnapshot().visited).toEqual(["p0", "p1"]);

    const res = await training.finish();
    expect(res?.bukys).toBe(2);
    const [, sent] = api.closeSession.mock.calls[0];
    expect(sent.length).toBe(training.getSnapshot().readings);
    expect(sent.map((r: CompactReading) => r[0])).toEqual([...sent.keys()]); // seq 0..n en orden
    expect(training.getSnapshot().status).toBe("done");
    expect(store.meta).toBeNull(); // nada pendiente
  });

  it("sin internet al terminar: queda pendiente y se envía al reintentar, sin perder lecturas", async () => {
    const training = await freshController();
    await training.start("u1", route, "Niterói");
    run(-60, 100);
    const total = training.getSnapshot().readings;
    api.closeSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await training.finish()).toBeNull();
    expect(training.getSnapshot().status).toBe("pending");
    expect(training.getSnapshot().error).toBe("offline");
    expect((store.meta as { phase: string }).phase).toBe("pending");

    const res = await training.sendPending();
    expect(res?.status).toBe("valid");
    expect(api.closeSession.mock.calls[1][1].length).toBe(total);
  });

  it("si la app se recarga a mitad del entrenamiento, reanuda con las pasadas ya hechas", async () => {
    let training = await freshController();
    await training.start("u1", route, "Niterói");
    run(-60, 60); // pasa BUKY_01 (las lecturas se guardan en lotes de 10)
    const sessionId = training.getSnapshot().sessionId!;
    await new Promise((r) => setTimeout(r, 0));
    const saved = store.readings.get(sessionId)?.length ?? 0;
    expect(saved).toBeGreaterThan(30);

    // "recarga": controlador nuevo con lo guardado en el dispositivo
    training = await freshController();
    await training.restore("u1");
    const s = training.getSnapshot();
    expect(s.status).toBe("running");
    expect(s.sessionId).toBe(sessionId);
    expect(s.visited).toEqual(["p0"]);
    expect(s.readings).toBe(saved);

    run(61, 360); // sigue corriendo y pasa BUKY_02 sin volver a contar BUKY_01
    expect(training.getSnapshot().visited).toEqual(["p0", "p1"]);
    await training.finish();
    const sent = api.closeSession.mock.calls.at(-1)![1] as CompactReading[];
    const seqs = sent.map((r) => r[0]);
    expect(new Set(seqs).size).toBe(seqs.length); // sin seq repetidos tras reanudar
  });

  it("restore de otro usuario no toca el entrenamiento guardado", async () => {
    const training = await freshController();
    store.meta = { sessionId: "s", userId: "otro", routeId: "r1", routeName: "x", routeKind: "official", cityName: "", points: route.points, startedAt: 0, phase: "running" };
    await training.restore("u1");
    expect(training.getSnapshot().status).toBe("idle");
  });

  it("paso 24: 3 avisos de bicicleta (sin podómetro, solo velocidad) cortan el entrenamiento y lo informan", async () => {
    const training = await freshController();
    const warns: number[] = [];
    training.setBikeListener((n) => warns.push(n));
    await training.start("u1", route, "Niterói", { ...(await import("@/features/buky/training/rules")).DEFAULT_TRAINING_RULES, bike_window_nosteps_s: 20 });
    run(-60, 60);
    // 36 km/h (10 m/s) hacia el norte durante 80 s
    for (let s = 1, m = 60; s <= 80 && training.getSnapshot().status === "running"; s++) {
      m += 10;
      t0 += 1000;
      push({ lat: BASE.lat + m * M, lon: BASE.lon, accuracy: 6, speed: null, simulated: false, fixTime: t0, receivedAt: t0 + 100 });
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(warns).toEqual([1, 2, 3]);
    await vi.waitFor(() => expect(api.closeSession).toHaveBeenCalled());
    expect(api.closeSession.mock.calls.at(-1)![2]).toEqual({ stop_reason: "bike", bike_warnings: 3 });
  });

  it("paso 24: en vivo, el mismo punto no suma otra vez antes de 3 minutos", async () => {
    const training = await freshController();
    const seen: string[] = [];
    training.setPassListener((p) => seen.push(p.label));
    await training.start("u1", route, "Niterói");
    run(-60, 60); // BUKY_01
    // vuelve hacia el sur y entra de nuevo al radio de BUKY_01 (menos de 3 min)
    for (let m = 60; m >= -80; m -= 3) {
      t0 += 1000;
      push({ lat: BASE.lat + m * M, lon: BASE.lon, accuracy: 6, speed: null, simulated: false, fixTime: t0, receivedAt: t0 + 100 });
    }
    expect(seen).toEqual(["BUKY_01"]);
    await training.finish();
    expect(api.closeSession.mock.calls.at(-1)![2]).toEqual({ stop_reason: "user", bike_warnings: 0 });
  });
});
