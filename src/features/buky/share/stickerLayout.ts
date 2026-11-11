export type ShareFormat = "sticker" | "story";
export type Point = { lat: number; lon: number };

/** Coordenadas de la composición de referencia sobre un lienzo lógico de 360×360. */
export function stickerLayout(format: ShareFormat) {
  return {
    width: 1080,
    height: format === "story" ? 1920 : 1080,
    sticker: { x: 0, y: format === "story" ? 270 : 0, size: 1080 },
    face: { x: 62, y: 81, width: 98, height: 68 },
    logo: { x: 165, y: 162, width: 30, height: 36 },
    route: { x: 104, y: 224, width: 54, height: 68 },
  };
}

export function bukysLabel(date: string | number | Date, now = new Date()) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const parsed = new Date(date);
  if (fmt.format(parsed) === fmt.format(now)) return "BUKYS HOJE";
  return `BUKYS · ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(parsed)}`;
}

export function fitRoute(shape: Point[], box: { x: number; y: number; width: number; height: number }) {
  const points = shape.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (points.length < 2) return [];
  const k = Math.cos(((points.reduce((sum, p) => sum + p.lat, 0) / points.length) * Math.PI) / 180);
  const xs = points.map((p) => p.lon * k),
    ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const dx = Math.max(...xs) - minX,
    dy = Math.max(...ys) - minY;
  const scale = Math.min(box.width / Math.max(dx, 1e-9), box.height / Math.max(dy, 1e-9));
  return points.map((_, i) => ({
    x: box.x + (box.width - dx * scale) / 2 + (xs[i] - minX) * scale,
    y: box.y + (box.height - dy * scale) / 2 + (ys[i] - minY) * scale,
  }));
}
