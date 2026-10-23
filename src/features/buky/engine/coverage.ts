import type { GpsReading } from "../gps/types";

/**
 * Métricas para decidir si el GPS en segundo plano es fiable.
 * Criterios de la prueba: cobertura ≥ 95 % y ningún hueco mayor a 20 s.
 */

export interface CoverageOptions {
  /** Intervalo tolerado entre lecturas antes de contar tiempo "sin cubrir". */
  toleratedIntervalMs: number;
  /** Un hueco mayor a esto se reporta como hueco grave. */
  gapThresholdMs: number;
}

export const DEFAULT_COVERAGE_OPTIONS: CoverageOptions = {
  toleratedIntervalMs: 5_000,
  gapThresholdMs: 20_000,
};

export interface Gap {
  fromMs: number;
  toMs: number;
  durationMs: number;
}

export interface CoverageReport {
  readings: number;
  durationMs: number;
  /** Tiempo desde que se inicia la sesión hasta la primera lectura (arranque del GPS). */
  timeToFirstFixMs: number | null;
  coveragePct: number;
  maxGapMs: number;
  gaps: Gap[];
  accurateReadingsPct: number;
  medianAccuracyM: number | null;
  /** Retraso entre que el GPS produce la lectura y JS la recibe. */
  deliveryDelayMs: { median: number | null; p95: number | null; max: number | null };
  simulatedReadings: number;
  passesCriteria: boolean;
}

const percentile = (sorted: number[], p: number): number | null => {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

export function computeCoverage(
  readings: GpsReading[],
  sessionStart: number,
  sessionEnd: number,
  options: Partial<CoverageOptions> = {},
  maxAccuracyM = 25,
): CoverageReport {
  const o = { ...DEFAULT_COVERAGE_OPTIONS, ...options };
  const fixes = readings.map((r) => r.fixTime).sort((a, b) => a - b);
  const inWindow = fixes.filter((t) => t >= sessionStart && t <= sessionEnd);
  // La cobertura se mide desde la primera lectura: el arranque del GPS se reporta aparte.
  const windowStart = inWindow.length ? inWindow[0] : sessionStart;
  const durationMs = Math.max(0, sessionEnd - windowStart);
  const timeToFirstFixMs = inWindow.length ? inWindow[0] - sessionStart : null;

  // Tramos entre lecturas consecutivas y de la última lectura al fin de la sesión.
  const marks = [...(inWindow.length ? inWindow : [sessionStart]), sessionEnd];
  let uncovered = 0;
  let maxGapMs = 0;
  const gaps: Gap[] = [];
  for (let i = 1; i < marks.length; i++) {
    const interval = marks[i] - marks[i - 1];
    uncovered += Math.max(0, interval - o.toleratedIntervalMs);
    maxGapMs = Math.max(maxGapMs, interval);
    if (interval > o.gapThresholdMs) {
      gaps.push({ fromMs: marks[i - 1], toMs: marks[i], durationMs: interval });
    }
  }
  const coveragePct = durationMs > 0 ? Math.max(0, 100 * (1 - uncovered / durationMs)) : 0;

  const accuracies = readings.map((r) => r.accuracy).sort((a, b) => a - b);
  const delays = readings.map((r) => Math.max(0, r.receivedAt - r.fixTime)).sort((a, b) => a - b);
  const accurate = readings.filter((r) => r.accuracy <= maxAccuracyM).length;

  return {
    readings: readings.length,
    durationMs,
    timeToFirstFixMs,
    coveragePct,
    maxGapMs,
    gaps,
    accurateReadingsPct: readings.length ? (100 * accurate) / readings.length : 0,
    medianAccuracyM: percentile(accuracies, 50),
    deliveryDelayMs: {
      median: percentile(delays, 50),
      p95: percentile(delays, 95),
      max: delays.length ? delays[delays.length - 1] : null,
    },
    simulatedReadings: readings.filter((r) => r.simulated).length,
    passesCriteria: readings.length > 0 && coveragePct >= 95 && maxGapMs <= o.gapThresholdMs,
  };
}
