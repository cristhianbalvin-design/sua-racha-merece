import { haversineMeters } from "@/features/buky/engine";
import type { RouteRules } from "./hooks";

export interface DraftPoint {
  lat: number;
  lon: number;
}

export interface DraftCheck {
  lengthM: number;
  /** Índices de puntos a menos de la distancia mínima de otro. */
  tooClose: number[];
  /** Índices de puntos fuera del área de la ciudad. */
  outside: number[];
  problems: ("points_count" | "points_too_close" | "route_too_short" | "point_outside_city")[];
  ok: boolean;
}

/** Misma validación que buky_create_athlete_route (paso 16), para avisar antes de guardar. */
export function checkDraft(points: DraftPoint[], rules: RouteRules, cityCenter?: DraftPoint | null): DraftCheck {
  let lengthM = 0;
  for (let i = 1; i < points.length; i++) {
    lengthM += haversineMeters(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  const tooClose = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < i; j++) {
      if (haversineMeters(points[i].lat, points[i].lon, points[j].lat, points[j].lon) < rules.minGapM) {
        tooClose.add(i);
        tooClose.add(j);
      }
    }
  }
  const outside = cityCenter
    ? points.flatMap((p, i) => (haversineMeters(cityCenter.lat, cityCenter.lon, p.lat, p.lon) > rules.maxCityKm * 1000 ? [i] : []))
    : [];
  const problems: DraftCheck["problems"] = [];
  if (points.length < rules.minPoints || points.length > rules.maxPoints) problems.push("points_count");
  if (tooClose.size) problems.push("points_too_close");
  if (lengthM < rules.minLengthM) problems.push("route_too_short");
  if (outside.length) problems.push("point_outside_city");
  return { lengthM, tooClose: [...tooClose].sort((a, b) => a - b), outside, problems, ok: problems.length === 0 };
}
