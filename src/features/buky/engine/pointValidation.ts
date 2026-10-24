import type { BukyPoint } from "../gps/types";
import { haversineMeters } from "./geo";

/** Distancia máxima aceptada entre un punto nuevo y la posición actual del teléfono. */
export const MAX_POINT_DISTANCE_M = 5_000;

export interface ParsedPoint {
  lat: number;
  lon: number;
}

export interface ParseResult {
  points: ParsedPoint[];
  errors: string[];
}

/**
 * Lee puntos "latitud, longitud" (uno por línea) y rechaza los imposibles:
 * fuera de rango, formatos ambiguos o demasiado lejos de la posición actual.
 */
export function parsePointLines(text: string, current: ParsedPoint | null): ParseResult {
  const points: ParsedPoint[] = [];
  const errors: string[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Exactamente dos números decimales con punto, separados por coma, punto y coma o espacio.
    const m = line.match(/^(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)$/);
    if (!m) {
      errors.push(`"${line}": usa el formato -11.98256, -76.79613 (decimales con punto).`);
      continue;
    }
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    const problem = validatePoint({ lat, lon }, current);
    if (problem) errors.push(`"${line}": ${problem}`);
    else points.push({ lat, lon });
  }
  return { points, errors };
}

export function validatePoint(p: ParsedPoint, current: ParsedPoint | null): string | null {
  if (!Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90) return "latitud fuera de rango (-90 a 90).";
  if (!Number.isFinite(p.lon) || p.lon < -180 || p.lon > 180) return "longitud fuera de rango (-180 a 180).";
  if (current) {
    const d = haversineMeters(current.lat, current.lon, p.lat, p.lon);
    if (d > MAX_POINT_DISTANCE_M) return `está a ${formatDistance(d)} de tu posición actual (máximo 5 km).`;
  }
  return null;
}

export function formatDistance(m: number): string {
  return m >= 1_000 ? `${(m / 1_000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;
}

export function distanceToPoint(point: BukyPoint, at: ParsedPoint | null): number | null {
  return at ? haversineMeters(at.lat, at.lon, point.lat, point.lon) : null;
}
