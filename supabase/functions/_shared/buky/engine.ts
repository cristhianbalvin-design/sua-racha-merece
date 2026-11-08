/**
 * Motor de Buky compartido por la app (detección en vivo) y la Edge Function
 * buky-close-session (recalcula y decide en el servidor). Un solo archivo y sin imports
 * para que lo puedan cargar tanto Vite/Vitest como Deno.
 *
 * Reglas de detección (documento maestro de Buky 0.6, validadas en las pruebas de GPS):
 * - una lectura cuenta solo si su precisión es ≤ 25 m y tiene menos de 20 s;
 * - un salto mayor a 12 m/s se descarta, salvo que se repita 3 veces seguidas;
 * - hacen falta 2 lecturas seguidas dentro del radio para registrar la pasada;
 * - para volver a contar hay que salir a más de radio + 10 m.
 *
 * Reglas de velocidad (decisión del cliente, 3 de noviembre de 2026; valores en app_settings):
 * - la pasada vale si la velocidad al cruzar el punto está entre la mínima y la máxima
 *   (caminar no cuenta);
 * - (hasta el 8/11/2026) si la velocidad superaba la máxima 60 s seguidos se anulaba todo el entrenamiento.
 *
 * Bicicleta (decisión del cliente, 8 de noviembre de 2026; paso 24):
 * - un aviso cuando la velocidad supera bikeSpeedKmh durante bikeWindowS seguidos SIN pasos en el podómetro;
 *   sin podómetro (web o permiso negado) solo cuenta la velocidad, con una ventana más larga;
 * - al 3.er aviso la app corta el entrenamiento; las pasadas legítimas de antes siguen valiendo.
 *   El servidor ya no anula el entrenamiento: cada pasada rápida se rechaza sola (too_fast).
 */

// ---------------------------------------------------------------- tipos

/** Una lectura de GPS tal como la entrega el teléfono. */
export interface GpsReading {
  /** UUID generado en el teléfono. */
  id: string;
  sessionId: string;
  /** Número de orden dentro de la sesión (0, 1, 2…). */
  seq: number;
  /** Momento en que el GPS produjo la posición (ms desde epoch). */
  fixTime: number;
  /** Momento en que el código JS recibió la lectura (ms desde epoch). */
  receivedAt: number;
  lat: number;
  lon: number;
  /** Radio de incertidumbre horizontal en metros. */
  accuracy: number;
  speed: number | null;
  altitude: number | null;
  bearing: number | null;
  /** true si el sistema marca la posición como simulada (ubicación falsa). */
  simulated: boolean;
}

/** Punto de una ruta Buky (geocerca circular). */
export interface BukyPoint {
  id: string;
  label: string;
  lat: number;
  lon: number;
  radiusM: number;
}

// ---------------------------------------------------------------- geo

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (Haversine). Igual a public.buky_distance_m. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ---------------------------------------------------------------- detección de pasadas

export interface EngineConfig {
  maxAccuracyM: number;
  maxAgeMs: number;
  maxJumpSpeedMs: number;
  jumpsToAccept: number;
  confirmReadings: number;
  exitMarginM: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  maxAccuracyM: 25,
  maxAgeMs: 20_000,
  maxJumpSpeedMs: 12,
  jumpsToAccept: 3,
  confirmReadings: 2,
  exitMarginM: 10,
};

export type PointState = "OUTSIDE" | "CONFIRMING" | "VISITED";
export type RejectReason = "imprecise" | "stale" | "out_of_order" | "jump";

export interface PassEvent {
  pointId: string;
  readingId: string;
  at: number;
  distanceM: number;
  accuracyM: number;
  simulated: boolean;
}

export interface ReadingResult {
  accepted: boolean;
  reason?: RejectReason;
  passes: PassEvent[];
}

interface PointRuntime {
  state: PointState;
  insideCount: number;
  lastDistanceM: number | null;
}

export class CollectionEngine {
  private readonly config: EngineConfig;
  private readonly points: BukyPoint[];
  private runtime = new Map<string, PointRuntime>();
  private lastAccepted: GpsReading | null = null;
  private consecutiveJumps = 0;

  constructor(points: BukyPoint[], config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.points = points;
    for (const p of points) {
      this.runtime.set(p.id, { state: "OUTSIDE", insideCount: 0, lastDistanceM: null });
    }
  }

  stateOf(pointId: string): { state: PointState; distanceM: number | null } {
    const rt = this.runtime.get(pointId);
    return { state: rt?.state ?? "OUTSIDE", distanceM: rt?.lastDistanceM ?? null };
  }

  /** Procesa una lectura. `now` es la hora de recepción (por defecto, receivedAt). */
  process(reading: GpsReading, now: number = reading.receivedAt): ReadingResult {
    const c = this.config;
    if (!(reading.accuracy <= c.maxAccuracyM)) {
      return { accepted: false, reason: "imprecise", passes: [] };
    }
    if (now - reading.fixTime > c.maxAgeMs) {
      return { accepted: false, reason: "stale", passes: [] };
    }
    const prev = this.lastAccepted;
    if (prev) {
      const dtSec = (reading.fixTime - prev.fixTime) / 1000;
      if (dtSec <= 0) {
        return { accepted: false, reason: "out_of_order", passes: [] };
      }
      const speed = haversineMeters(prev.lat, prev.lon, reading.lat, reading.lon) / dtSec;
      if (speed > c.maxJumpSpeedMs) {
        this.consecutiveJumps += 1;
        if (this.consecutiveJumps < c.jumpsToAccept) {
          return { accepted: false, reason: "jump", passes: [] };
        }
      }
    }
    this.consecutiveJumps = 0;
    this.lastAccepted = reading;

    const passes: PassEvent[] = [];
    for (const point of this.points) {
      const rt = this.runtime.get(point.id)!;
      const d = haversineMeters(point.lat, point.lon, reading.lat, reading.lon);
      rt.lastDistanceM = d;
      const inside = d <= point.radiusM;
      switch (rt.state) {
        case "OUTSIDE":
        case "CONFIRMING":
          if (inside) {
            rt.insideCount += 1;
            if (rt.insideCount >= c.confirmReadings) {
              rt.state = "VISITED";
              rt.insideCount = 0;
              passes.push({
                pointId: point.id,
                readingId: reading.id,
                at: reading.fixTime,
                distanceM: d,
                accuracyM: reading.accuracy,
                simulated: reading.simulated,
              });
            } else {
              rt.state = "CONFIRMING";
            }
          } else {
            rt.state = "OUTSIDE";
            rt.insideCount = 0;
          }
          break;
        case "VISITED":
          if (d > point.radiusM + c.exitMarginM) {
            rt.state = "OUTSIDE";
            rt.insideCount = 0;
          }
          break;
      }
    }
    return { accepted: true, passes };
  }
}

/** Ejecuta el motor sobre una lista completa de lecturas. */
export function replayPasses(
  points: BukyPoint[],
  readings: GpsReading[],
  config: Partial<EngineConfig> = {},
): { passes: PassEvent[]; rejected: Record<RejectReason, number>; accepted: GpsReading[] } {
  const engine = new CollectionEngine(points, config);
  const rejected: Record<RejectReason, number> = { imprecise: 0, stale: 0, out_of_order: 0, jump: 0 };
  const passes: PassEvent[] = [];
  const accepted: GpsReading[] = [];
  for (const r of [...readings].sort((a, b) => a.seq - b.seq)) {
    const res = engine.process(r);
    if (res.accepted) accepted.push(r);
    else if (res.reason) rejected[res.reason] += 1;
    passes.push(...res.passes);
  }
  return { passes, rejected, accepted };
}

// ---------------------------------------------------------------- evaluación del entrenamiento

export interface SessionRules {
  /** Velocidad mínima para que una pasada cuente (km/h). Caminar no cuenta. */
  speedMinKmh: number;
  /** Velocidad máxima para que una pasada cuente (km/h). */
  speedMaxKmh: number;
  /** Obsoleto (paso 24): ya no anula el entrenamiento. Se conserva por compatibilidad. */
  vehicleWindowS: number;
  /** Bicicleta: velocidad (km/h) a partir de la cual corre la ventana de aviso. */
  bikeSpeedKmh: number;
  /** Bicicleta sin podómetro: segundos seguidos por encima de la velocidad para un aviso. */
  bikeWindowNoStepsS: number;
  /** Ventana (s), centrada en la pasada, para medir la velocidad del atleta. */
  speedWindowS: number;
  /** Precisión GPS máxima (m). */
  maxAccuracyM: number;
  /** Proporción de lecturas simuladas que anula el entrenamiento. */
  mockMaxRatio: number;
}

export const DEFAULT_SESSION_RULES: SessionRules = {
  speedMinKmh: 6,
  speedMaxKmh: 25,
  vehicleWindowS: 60,
  bikeSpeedKmh: 25,
  bikeWindowNoStepsS: 60,
  speedWindowS: 30,
  maxAccuracyM: 25,
  mockMaxRatio: 0.05,
};

export type PassRejectReason = "too_slow" | "too_fast" | "no_speed" | "mock_location";
export type SessionInvalidReason = "vehicle" | "mock_location" | "no_readings";

export interface EvaluatedPass {
  pointId: string;
  at: number;
  distanceM: number;
  accuracyM: number;
  speedKmh: number | null;
  valid: boolean;
  rejectReason: PassRejectReason | null;
}

export interface SessionStats {
  readings: number;
  acceptedReadings: number;
  outOfWindow: number;
  simulatedReadings: number;
  rejected: Record<RejectReason, number>;
  startedAt: number | null;
  endedAt: number | null;
  distanceM: number;
  durationS: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  /** Mayor tramo continuo (s) por encima de la velocidad máxima. */
  longestFastS: number;
  /** Avisos de bicicleta según la velocidad (el servidor no ve el podómetro). */
  bikeWarnings: number;
}

export interface SessionEvaluation {
  status: "valid" | "invalid";
  reason: SessionInvalidReason | null;
  passes: EvaluatedPass[];
  stats: SessionStats;
}

/** Velocidad (km/h) en una ventana centrada en cada lectura aceptada. null si la ventana mide < 5 s. */
export function windowedSpeedsKmh(accepted: GpsReading[], windowS: number): (number | null)[] {
  const n = accepted.length;
  const cum: number[] = new Array(n).fill(0); // distancia acumulada hasta i
  for (let i = 1; i < n; i++) {
    const a = accepted[i - 1];
    const b = accepted[i];
    cum[i] = cum[i - 1] + haversineMeters(a.lat, a.lon, b.lat, b.lon);
  }
  const half = (windowS * 1000) / 2;
  const out: (number | null)[] = new Array(n).fill(null);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const t = accepted[i].fixTime;
    while (accepted[lo].fixTime < t - half) lo++;
    if (hi < i) hi = i;
    while (hi + 1 < n && accepted[hi + 1].fixTime <= t + half) hi++;
    const dt = (accepted[hi].fixTime - accepted[lo].fixTime) / 1000;
    if (dt >= 5) out[i] = ((cum[hi] - cum[lo]) / dt) * 3.6;
  }
  return out;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Decide un entrenamiento completo: recalcula las pasadas con el motor, mide la velocidad
 * y aplica las reglas de velocidad, vehículo y ubicación falsa.
 * `window` descarta lecturas con hora fuera del entrenamiento (reloj manipulado).
 */
export function evaluateSession(
  points: BukyPoint[],
  readings: GpsReading[],
  rules: Partial<SessionRules> = {},
  window: { from?: number; to?: number } = {},
): SessionEvaluation {
  const r = { ...DEFAULT_SESSION_RULES, ...rules };
  const from = window.from ?? -Infinity;
  const to = window.to ?? Infinity;
  const inWindow = readings.filter((x) => x.fixTime >= from && x.fixTime <= to);
  const { passes, rejected, accepted } = replayPasses(points, inWindow, { maxAccuracyM: r.maxAccuracyM });

  const speeds = windowedSpeedsKmh(accepted, r.speedWindowS);
  const indexById = new Map(accepted.map((x, i) => [x.id, i]));

  let distanceM = 0;
  for (let i = 1; i < accepted.length; i++) {
    const a = accepted[i - 1];
    const b = accepted[i];
    distanceM += haversineMeters(a.lat, a.lon, b.lat, b.lon);
  }
  const startedAt = accepted.length ? accepted[0].fixTime : null;
  const endedAt = accepted.length ? accepted[accepted.length - 1].fixTime : null;
  const durationS = startedAt !== null && endedAt !== null ? (endedAt - startedAt) / 1000 : 0;

  // Tramo más largo por encima de la máxima (vehículo)
  let longestFastS = 0;
  let runStart: number | null = null;
  let maxSpeed = 0;
  for (let i = 0; i < accepted.length; i++) {
    const s = speeds[i];
    if (s !== null && s > maxSpeed) maxSpeed = s;
    if (s !== null && s > r.speedMaxKmh) {
      if (runStart === null) runStart = accepted[i].fixTime;
      longestFastS = Math.max(longestFastS, (accepted[i].fixTime - runStart) / 1000);
    } else if (s !== null) {
      runStart = null;
    }
  }

  const simulatedReadings = inWindow.filter((x) => x.simulated).length;

  let reason: SessionInvalidReason | null = null;
  if (accepted.length === 0) reason = "no_readings";
  else if (inWindow.length > 0 && simulatedReadings / inWindow.length > r.mockMaxRatio) reason = "mock_location";

  // Bicicleta: solo se cuentan avisos (el servidor no ve el podómetro); no anula el entrenamiento.
  const bike = new BikeDetector({ speedKmh: r.bikeSpeedKmh, windowS: r.bikeWindowNoStepsS, windowNoStepsS: r.bikeWindowNoStepsS });
  for (let i = 0; i < accepted.length; i++) bike.update(accepted[i].fixTime, speeds[i], null);

  const evaluated: EvaluatedPass[] = passes.map((p) => {
    const i = indexById.get(p.readingId);
    const speed = i === undefined ? null : speeds[i];
    let rejectReason: PassRejectReason | null = null;
    if (p.simulated) rejectReason = "mock_location";
    else if (speed === null) rejectReason = "no_speed";
    else if (speed < r.speedMinKmh) rejectReason = "too_slow";
    else if (speed > r.speedMaxKmh) rejectReason = "too_fast";
    return {
      pointId: p.pointId,
      at: p.at,
      distanceM: round1(p.distanceM),
      accuracyM: round1(p.accuracyM),
      speedKmh: speed === null ? null : round1(speed),
      valid: rejectReason === null,
      rejectReason,
    };
  });

  return {
    status: reason ? "invalid" : "valid",
    reason,
    passes: evaluated,
    stats: {
      readings: readings.length,
      acceptedReadings: accepted.length,
      outOfWindow: readings.length - inWindow.length,
      simulatedReadings,
      rejected,
      startedAt,
      endedAt,
      distanceM: Math.round(distanceM),
      durationS: Math.round(durationS),
      maxSpeedKmh: round1(maxSpeed),
      avgSpeedKmh: durationS > 0 ? round1((distanceM / durationS) * 3.6) : 0,
      longestFastS: Math.round(longestFastS),
      bikeWarnings: bike.warnings,
    },
  };
}

// ---------------------------------------------------------------- bicicleta

export interface BikeRules {
  /** Velocidad (km/h) a partir de la cual corre la ventana. */
  speedKmh: number;
  /** Segundos seguidos rápido y SIN pasos para un aviso (con podómetro). */
  windowS: number;
  /** Segundos seguidos rápido para un aviso cuando no hay podómetro. */
  windowNoStepsS: number;
  /** Pasos tolerados dentro de la ventana (vibraciones del teléfono en la bicicleta). */
  stepTolerance?: number;
}

/**
 * Cuenta avisos de bicicleta. Se alimenta con la velocidad del momento y, si hay podómetro, con el
 * total de pasos acumulado. Un aviso = velocidad > speedKmh durante la ventana completa y (con
 * podómetro) casi sin pasos en ese intervalo. Tras un aviso la ventana vuelve a empezar.
 * Lo usan la app (en vivo, con pasos) y el servidor (sin pasos, solo para registrar).
 */
export class BikeDetector {
  warnings = 0;
  private runStart: number | null = null;
  private stepsAtStart: number | null = null;
  constructor(private readonly rules: BikeRules) {}

  /** t en ms; speedKmh null = sin dato (no corta la ventana); steps = pasos acumulados o null. Devuelve true si hubo aviso. */
  update(t: number, speedKmh: number | null, steps: number | null): boolean {
    if (speedKmh === null) return false;
    if (speedKmh <= this.rules.speedKmh) {
      this.runStart = null;
      return false;
    }
    if (this.runStart === null) {
      this.runStart = t;
      this.stepsAtStart = steps;
      return false;
    }
    const withSteps = steps !== null && this.stepsAtStart !== null;
    const windowMs = (withSteps ? this.rules.windowS : this.rules.windowNoStepsS) * 1000;
    if (t - this.runStart < windowMs) return false;
    if (withSteps && steps! - this.stepsAtStart! > (this.rules.stepTolerance ?? 5)) {
      // Rápido pero con pasos: es un corredor (o sprint). La ventana vuelve a empezar.
      this.runStart = t;
      this.stepsAtStart = steps;
      return false;
    }
    this.warnings += 1;
    this.runStart = t;
    this.stepsAtStart = steps;
    return true;
  }
}
