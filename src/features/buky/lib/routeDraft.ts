import { haversineMeters } from "@/features/buky/engine";
import type { RouteRules } from "./hooks";

export interface DraftPoint {
  lat: number;
  lon: number;
}

export interface DraftCheck {
  lengthM: number;
  /** Bukys calculados a lo largo del trazo (se recogen corriendo). */
  bukys: DraftPoint[];
  /** Índices de vértices del trazo fuera del área de la ciudad. */
  outside: number[];
  problems: ("path_points" | "points_count" | "route_too_short" | "route_too_long" | "point_outside_city")[];
  ok: boolean;
}

/**
 * Ubica los Bukys solos a lo largo del trazo, cada `everyM` metros desde el inicio. Mismo algoritmo
 * que `buky_create_athlete_route` (paso 21): un Buky a menos de 2 radios de otro (el trazo vuelve
 * sobre sí mismo) se omite.
 */
export function placeBukys(path: DraftPoint[], everyM: number, radiusM: number): { bukys: DraftPoint[]; lengthM: number } {
  const every = Math.max(everyM, 50);
  const bukys: DraftPoint[] = [];
  let len = 0;
  let next = every;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = haversineMeters(a.lat, a.lon, b.lat, b.lon);
    while (seg > 0 && next <= len + seg) {
      const f = (next - len) / seg;
      const p = { lat: a.lat + f * (b.lat - a.lat), lon: a.lon + f * (b.lon - a.lon) };
      if (!bukys.some((g) => haversineMeters(g.lat, g.lon, p.lat, p.lon) < 2 * radiusM)) bukys.push(p);
      next += every;
    }
    len += seg;
  }
  return { bukys, lengthM: len };
}

/** Misma validación que el servidor (paso 21), para avisar antes de guardar. */
export function checkDraft(path: DraftPoint[], rules: RouteRules, cityCenter?: DraftPoint | null): DraftCheck {
  const { bukys, lengthM } = placeBukys(path, rules.minGapM, rules.radiusM);
  const outside = cityCenter
    ? path.flatMap((p, i) => (haversineMeters(cityCenter.lat, cityCenter.lon, p.lat, p.lon) > rules.maxCityKm * 1000 ? [i] : []))
    : [];
  const problems: DraftCheck["problems"] = [];
  if (path.length < 2 || path.length > 400) problems.push("path_points");
  if (lengthM < rules.minLengthM) problems.push("route_too_short");
  else if (bukys.length < rules.minPoints) problems.push("points_count");
  if (bukys.length > rules.maxPoints) problems.push("route_too_long");
  if (outside.length) problems.push("point_outside_city");
  return { lengthM, bukys, outside, problems, ok: problems.length === 0 };
}
