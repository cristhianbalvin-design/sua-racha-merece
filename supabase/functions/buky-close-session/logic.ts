// Lógica pura de buky-close-session (sin red): validar la entrada y armar la llamada a
// buky_finalize_session. Se prueba con `deno test`.
import {
  type BukyPoint,
  DEFAULT_SESSION_RULES,
  evaluateSession,
  type GpsReading,
  type SessionEvaluation,
  type SessionRules,
} from "../_shared/buky/engine.ts";

export const MAX_READINGS = 25_000; // ~7 h a 1 lectura por segundo
export const MAX_BODY_BYTES = 6_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Formato compacto que envía la app, una fila por lectura:
 *   [seq, fixTime, receivedAt, lat, lon, accuracy, simulated(0|1)]
 */
export type CompactReading = [number, number, number, number, number, number, number];

export interface CloseRequest {
  session_id: string;
  readings: CompactReading[];
  /** Por qué terminó (lo informa la app): el atleta, el límite de tiempo o la bicicleta. */
  stop_reason?: "user" | "time_limit" | "bike";
  /** Avisos de bicicleta que vio la app (con podómetro, si lo había). */
  bike_warnings?: number;
}

export interface CloseInfo {
  stopReason: "user" | "time_limit" | "bike" | null;
  bikeWarnings: number;
}

export class BadRequest extends Error {}

export function parseCloseRequest(body: unknown): { sessionId: string; readings: GpsReading[]; info: CloseInfo } {
  if (!body || typeof body !== "object") throw new BadRequest("body_invalid");
  const { session_id, readings, stop_reason, bike_warnings } = body as Partial<CloseRequest>;
  const info: CloseInfo = {
    stopReason: stop_reason === "user" || stop_reason === "time_limit" || stop_reason === "bike" ? stop_reason : null,
    bikeWarnings: typeof bike_warnings === "number" && Number.isFinite(bike_warnings) ? Math.max(0, Math.min(100, Math.round(bike_warnings))) : 0,
  };
  if (typeof session_id !== "string" || !UUID.test(session_id)) throw new BadRequest("session_id_invalid");
  if (!Array.isArray(readings)) throw new BadRequest("readings_invalid");
  if (readings.length > MAX_READINGS) throw new BadRequest("too_many_readings");
  const out: GpsReading[] = [];
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    if (!Array.isArray(r) || r.length < 7 || r.slice(0, 7).some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      throw new BadRequest(`reading_invalid:${i}`);
    }
    const [seq, fixTime, receivedAt, lat, lon, accuracy, simulated] = r;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || accuracy < 0) throw new BadRequest(`reading_invalid:${i}`);
    out.push({
      id: `${session_id}:${seq}`,
      sessionId: session_id,
      seq,
      fixTime,
      receivedAt,
      lat,
      lon,
      accuracy,
      speed: null,
      altitude: null,
      bearing: null,
      simulated: simulated === 1,
    });
  }
  return { sessionId: session_id, readings: out, info };
}

export interface CloseRules extends SessionRules {
  /** Duración máxima del entrenamiento (min): lo que pase después no cuenta. */
  sessionMaxMin: number;
  /** Avisos de bicicleta que cortan el entrenamiento. */
  bikeWarningsToStop: number;
}

/** Lee las reglas desde las filas de app_settings (value jsonb). */
export function rulesFromSettings(rows: { key: string; value: unknown }[]): CloseRules {
  const get = (k: string, d: number) => {
    const v = Number(rows.find((r) => r.key === k)?.value);
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  const d = DEFAULT_SESSION_RULES;
  return {
    speedMinKmh: get("buky_speed_min_kmh", d.speedMinKmh),
    speedMaxKmh: get("buky_speed_max_kmh", d.speedMaxKmh),
    vehicleWindowS: get("buky_vehicle_window_s", d.vehicleWindowS),
    speedWindowS: get("buky_speed_window_s", d.speedWindowS),
    maxAccuracyM: get("buky_max_accuracy_m", d.maxAccuracyM),
    mockMaxRatio: get("buky_mock_max_ratio", d.mockMaxRatio),
    bikeSpeedKmh: get("buky_bike_speed_kmh", d.bikeSpeedKmh),
    bikeWindowNoStepsS: get("buky_bike_window_nosteps_s", d.bikeWindowNoStepsS),
    sessionMaxMin: get("buky_session_max_min", 60),
    bikeWarningsToStop: get("buky_bike_warnings_to_stop", 3),
  };
}

export const SETTINGS_KEYS = [
  "buky_speed_min_kmh",
  "buky_speed_max_kmh",
  "buky_vehicle_window_s",
  "buky_speed_window_s",
  "buky_max_accuracy_m",
  "buky_mock_max_ratio",
  "buky_bike_speed_kmh",
  "buky_bike_window_nosteps_s",
  "buky_session_max_min",
  "buky_bike_warnings_to_stop",
];

export interface PointRow {
  id: string;
  label: string | null;
  lat: number;
  lon: number;
  radius_m: number;
}

export function toEnginePoints(rows: PointRow[]): BukyPoint[] {
  return rows.map((p) => ({ id: p.id, label: p.label ?? "", lat: p.lat, lon: p.lon, radiusM: p.radius_m }));
}

/** Evalúa el entrenamiento y arma los parámetros de buky_finalize_session. */
export function buildFinalize(
  args: {
    sessionId: string;
    userId: string;
    startedAt: number;
    now: number;
    points: BukyPoint[];
    readings: GpsReading[];
    rules: SessionRules | CloseRules;
    trackPath: string | null;
    info?: CloseInfo;
  },
): { evaluation: SessionEvaluation; params: Record<string, unknown> } {
  const maxMin = "sessionMaxMin" in args.rules ? args.rules.sessionMaxMin : Infinity;
  const toStop = "bikeWarningsToStop" in args.rules ? args.rules.bikeWarningsToStop : 3;
  // Límite de tiempo (paso 24): lo que pase después de N minutos del inicio no cuenta.
  const limit = Math.min(args.now, args.startedAt + maxMin * 60_000);
  const evaluation = evaluateSession(args.points, args.readings, args.rules, {
    from: args.startedAt - 60_000, // tolerancia de reloj del teléfono
    to: limit + 120_000,
  });
  const s = evaluation.stats;
  const maxAcc = args.rules.maxAccuracyM;
  const first = [...args.readings].sort((a, b) => a.seq - b.seq).find((r) => r.accuracy <= maxAcc && !r.simulated);
  const bikeWarnings = Math.max(args.info?.bikeWarnings ?? 0, s.bikeWarnings);
  const stopReason = args.info?.stopReason === "bike" || s.bikeWarnings >= toStop ? "bike" : args.info?.stopReason ?? null;
  const params = {
    p_session_id: args.sessionId,
    p_user_id: args.userId,
    p_status: evaluation.status,
    p_reason: evaluation.reason,
    p_stats: {
      ended_at: new Date(s.endedAt ?? args.now).toISOString(),
      distance_m: s.distanceM,
      duration_s: s.durationS,
      max_speed_kmh: s.maxSpeedKmh,
      avg_speed_kmh: s.avgSpeedKmh,
      start_lat: first?.lat ?? null,
      start_lon: first?.lon ?? null,
      stop_reason: stopReason,
      bike_warnings: bikeWarnings,
    },
    p_passes: evaluation.passes.map((p) => ({
      point_id: p.pointId,
      passed_at: new Date(p.at).toISOString(),
      distance_m: p.distanceM,
      accuracy_m: p.accuracyM,
      speed_kmh: p.speedKmh,
      valid: p.valid,
      reject_reason: p.rejectReason,
    })),
    p_track_path: args.trackPath,
  };
  return { evaluation, params };
}

/** Comprime el recorrido completo para guardarlo en el bucket privado. */
export async function gzipJson(value: unknown): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
