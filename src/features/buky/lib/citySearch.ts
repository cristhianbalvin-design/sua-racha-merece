/**
 * Buscador de ciudades en el dispositivo: tolera acentos, mayúsculas, errores de tipeo,
 * la sigla del estado ("niteroi rj") y encuentra por cualquier palabra del nombre.
 */
import { normalizeName } from "./validation";

export interface CatalogCity {
  code: number;
  name: string;
  state_code: number;
  uf: string;
  lat: number;
  lon: number;
  is_capital: boolean;
  /** nombre normalizado (sin acentos, minúsculas) */
  norm: string;
}

/** Distancia de edición (Levenshtein) con corte temprano. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Puntaje de una ciudad para la consulta (0 = no coincide). */
export function scoreCity(norm: string, q: string): number {
  if (!q) return 1;
  if (norm === q) return 100;
  if (norm.startsWith(q)) return 90;
  const words = norm.split(" ");
  if (words.some((w) => w.startsWith(q))) return 80;
  if (norm.includes(q)) return 70;
  // Errores de tipeo: se compara con el inicio del nombre del mismo largo (y con el nombre entero)
  const tol = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (tol === 0) return 0;
  const d = Math.min(editDistance(q, norm.slice(0, q.length), tol), editDistance(q, norm, tol));
  return d <= tol ? 60 - d * 10 : 0;
}

/**
 * Busca ciudades. `stateCode` limita a un estado. Una sigla de estado al final de la consulta
 * ("niteroi rj", "campos - rj") también filtra por ese estado.
 */
export function searchCatalog(cities: CatalogCity[], query: string, stateCode?: number | null, limit = 40): CatalogCity[] {
  let q = normalizeName(query);
  let uf: string | null = null;
  const m = q.match(/^(.*\S)\s+([a-z]{2})$/);
  if (m && cities.some((c) => c.uf.toLowerCase() === m[2])) {
    q = m[1];
    uf = m[2].toUpperCase();
  }
  const pool = cities.filter((c) => (!stateCode || c.state_code === stateCode) && (!uf || c.uf === uf));
  if (!q) {
    // Sin texto: capitales primero (o todas las del estado, en orden alfabético)
    const base = stateCode || uf ? pool : pool.filter((c) => c.is_capital);
    return [...base].sort((a, b) => Number(b.is_capital) - Number(a.is_capital) || a.name.localeCompare(b.name, "pt-BR")).slice(0, limit);
  }
  return pool
    .map((c) => ({ c, s: scoreCity(c.norm, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(b.c.is_capital) - Number(a.c.is_capital) || a.c.name.localeCompare(b.c.name, "pt-BR"))
    .slice(0, limit)
    .map((x) => x.c);
}
