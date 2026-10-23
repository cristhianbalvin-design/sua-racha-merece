import type { GpsReading } from "./types";

/** Convierte las lecturas a GPX para abrirlas en mapas (Google Earth, Strava, gpx.studio…). */
export function toGpx(name: string, readings: GpsReading[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pts = readings
    .map(
      (r) =>
        `      <trkpt lat="${r.lat.toFixed(7)}" lon="${r.lon.toFixed(7)}">` +
        (r.altitude != null ? `<ele>${r.altitude.toFixed(1)}</ele>` : "") +
        `<time>${new Date(r.fixTime).toISOString()}</time>` +
        `<hdop>${(r.accuracy / 5).toFixed(1)}</hdop>` +
        `</trkpt>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="3BUK Buky GPS spike" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
