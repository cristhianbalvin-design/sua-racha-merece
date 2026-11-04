import assert from "node:assert/strict";
const assertEquals = (a: unknown, b: unknown) => assert.deepEqual(a, b);
const assertThrows = (fn: () => unknown, cls: new (...args: never[]) => Error, msg?: string) =>
  assert.throws(fn, (e: Error) => e instanceof cls && (msg === undefined || e.message === msg));
import { BadRequest, buildFinalize, gzipJson, parseCloseRequest, rulesFromSettings } from "./logic.ts";

const SID = "5e000000-0000-0000-0000-000000000001";
const M = 1 / 111_320;
const T0 = 1_800_000_000_000;

function compactTrack(kmh: number, secs: number, simulated = 0) {
  const out: number[][] = [];
  for (let s = 0; s < secs; s++) out.push([s, T0 + s * 1000, T0 + s * 1000 + 300, -22.9035 + (-100 + (s * kmh) / 3.6) * M, -43.1153, 6, simulated]);
  return out;
}
const points = [0, 400, 800].map((m, i) => ({ id: `p${i}`, label: "", lat: -22.9035 + m * M, lon: -43.1153, radiusM: 50 }));

Deno.test("rechaza entradas inválidas", () => {
  assertThrows(() => parseCloseRequest(null), BadRequest);
  assertThrows(() => parseCloseRequest({ session_id: "x", readings: [] }), BadRequest, "session_id_invalid");
  assertThrows(() => parseCloseRequest({ session_id: SID, readings: [[1, 2, 3]] }), BadRequest, "reading_invalid:0");
  assertThrows(() => parseCloseRequest({ session_id: SID, readings: [[0, 1, 1, 95, 0, 5, 0]] }), BadRequest);
});

Deno.test("reglas desde app_settings con valores por defecto", () => {
  const r = rulesFromSettings([{ key: "buky_speed_min_kmh", value: 7 }, { key: "buky_speed_max_kmh", value: "x" }]);
  assertEquals(r.speedMinKmh, 7);
  assertEquals(r.speedMaxKmh, 25);
});

Deno.test("trote: arma la llamada con 3 pasadas válidas", () => {
  const { readings } = parseCloseRequest({ session_id: SID, readings: compactTrack(10, 400) });
  const { evaluation, params } = buildFinalize({
    sessionId: SID, userId: "u", startedAt: T0, now: T0 + 500_000, points, readings,
    rules: rulesFromSettings([]), trackPath: "u/s.json.gz",
  });
  assertEquals(evaluation.status, "valid");
  assertEquals(params.p_status, "valid");
  const passes = params.p_passes as { valid: boolean }[];
  assertEquals(passes.length, 3);
  assertEquals(passes.every((p) => p.valid), true);
});

Deno.test("ubicación falsa: sesión inválida", () => {
  const { readings } = parseCloseRequest({ session_id: SID, readings: compactTrack(10, 400, 1) });
  const { params } = buildFinalize({
    sessionId: SID, userId: "u", startedAt: T0, now: T0 + 500_000, points, readings,
    rules: rulesFromSettings([]), trackPath: null,
  });
  assertEquals(params.p_status, "invalid");
  assertEquals(params.p_reason, "mock_location");
});

Deno.test("reloj adelantado: lecturas del futuro se descartan", () => {
  const { readings } = parseCloseRequest({ session_id: SID, readings: compactTrack(10, 400) });
  const { evaluation } = buildFinalize({
    sessionId: SID, userId: "u", startedAt: T0 + 3_600_000, now: T0 + 3_700_000, points, readings,
    rules: rulesFromSettings([]), trackPath: null,
  });
  assertEquals(evaluation.reason, "no_readings");
});

Deno.test("comprime el recorrido", async () => {
  const gz = await gzipJson({ a: compactTrack(10, 2400) });
  assertEquals(gz[0], 0x1f);
  assertEquals(gz[1], 0x8b);
});
