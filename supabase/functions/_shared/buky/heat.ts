/** Grid in degrees: floor(longitude / 0.0003), floor(latitude / 0.0003).
 * A cell is approximately 33 m north-south; longitude width varies with latitude.
 * Only fixes accurate to 25 m or better are included. */
export const HEAT_CELL_DEGREES = 0.0003;
export const HEAT_MAX_ACCURACY_M = 25;
export type HeatFix = { lat: number; lon: number; acc: number };
export type HeatCell = { x: number; y: number; hits: number };
export function trackToHeatCells(points: HeatFix[]): HeatCell[] {
  const cells = new Map<string, HeatCell>();
  for (const p of points) {
    if (
      !Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
      !Number.isFinite(p.acc) || p.acc < 0 || p.acc > HEAT_MAX_ACCURACY_M ||
      Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180
    ) continue;
    const x = Math.floor(p.lon / HEAT_CELL_DEGREES),
      y = Math.floor(p.lat / HEAT_CELL_DEGREES);
    const key = `${x},${y}`;
    const cell = cells.get(key);
    if (cell) cell.hits++;
    else cells.set(key, { x, y, hits: 1 });
  }
  return [...cells.values()];
}
