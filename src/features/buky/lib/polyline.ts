/** Decodifica una polilínea Google de precisión 5. */
export function decodePolyline(encoded: string): { lat: number; lon: number }[] {
  const points: { lat: number; lon: number }[] = [];
  let index = 0, lat = 0, lon = 0;
  const read = () => { let value = 0, shift = 0, part: number; do { if (index >= encoded.length || shift > 30) throw new Error("invalid_polyline"); part = encoded.charCodeAt(index++) - 63; value |= (part & 31) << shift; shift += 5; } while (part >= 32); return value & 1 ? ~(value >> 1) : value >> 1; };
  try { while (index < encoded.length) { lat += read(); lon += read(); points.push({ lat: lat / 1e5, lon: lon / 1e5 }); } } catch { return []; }
  return points;
}
