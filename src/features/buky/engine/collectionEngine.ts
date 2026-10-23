import type { BukyPoint, GpsReading } from "../gps/types";
import { haversineMeters } from "./geo";

/**
 * Motor de detección de pasadas por los puntos de una ruta Buky.
 *
 * Reglas tomadas del documento maestro de Buky 0.6 (CollectionEngine.kt):
 * - una lectura cuenta solo si su precisión es ≤ 25 m y tiene menos de 20 s;
 * - un salto mayor a 12 m/s se descarta, salvo que se repita 3 veces seguidas
 *   (entonces se acepta la nueva posición);
 * - hacen falta 2 lecturas seguidas dentro del radio para registrar la pasada;
 * - para volver a contar hay que salir a más de radio + 10 m (histéresis).
 *
 * Es lógica pura, sin dependencias del teléfono: se usa en vivo en la app y
 * también se puede ejecutar en el servidor para validar pasadas.
 */

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

/** Ejecuta el motor sobre una lista completa de lecturas (para análisis o servidor). */
export function replayPasses(
  points: BukyPoint[],
  readings: GpsReading[],
  config: Partial<EngineConfig> = {},
): { passes: PassEvent[]; rejected: Record<RejectReason, number> } {
  const engine = new CollectionEngine(points, config);
  const rejected: Record<RejectReason, number> = { imprecise: 0, stale: 0, out_of_order: 0, jump: 0 };
  const passes: PassEvent[] = [];
  for (const r of [...readings].sort((a, b) => a.seq - b.seq)) {
    const res = engine.process(r);
    if (!res.accepted && res.reason) rejected[res.reason] += 1;
    passes.push(...res.passes);
  }
  return { passes, rejected };
}
