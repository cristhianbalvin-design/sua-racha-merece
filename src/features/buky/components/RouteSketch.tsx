/**
 * Croquis liviano del recorrido para las tarjetas del historial: la línea de la ruta sobre una
 * cuadrícula oscura (sin cargar un mapa por tarjeta; el mapa real está en el detalle del treino).
 */
export default function RouteSketch({ shape, className = "" }: { shape: { lat: number; lon: number }[]; className?: string }) {
  const W = 320;
  const H = 150;
  const pad = 16;
  if (shape.length < 2) {
    return <div className={`rounded-2xl bg-[#0d0d0d] ${className}`} style={{ aspectRatio: `${W} / ${H}` }} aria-hidden />;
  }
  const lat0 = shape.reduce((a, p) => a + p.lat, 0) / shape.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = shape.map((p) => p.lon * kx);
  const ys = shape.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, (Math.max(...ys) - minY) * (W / H), 1e-6);
  const s = (W - pad * 2) / span;
  const ox = (W - (Math.max(...xs) - minX) * s) / 2;
  const oy = (H - (Math.max(...ys) - minY) * s) / 2;
  const pts = xs.map((x, i) => `${(ox + (x - minX) * s).toFixed(1)},${(oy + (ys[i] - minY) * s).toFixed(1)}`);
  const [sx, sy] = pts[0].split(",");
  const [ex, ey] = pts[pts.length - 1].split(",");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block w-full rounded-2xl bg-[#0d0d0d] ${className}`} role="img" aria-label="Croqui do percurso">
      <defs>
        <pattern id="buky-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1b1b1b" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#buky-grid)" />
      <polyline points={pts.join(" ")} fill="none" stroke="#39ff14" strokeOpacity="0.25" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts.join(" ")} fill="none" stroke="#39ff14" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx} cy={sy} r="5" fill="#fff" stroke="#050505" strokeWidth="2" />
      <circle cx={ex} cy={ey} r="5" fill="#39ff14" stroke="#050505" strokeWidth="2" />
    </svg>
  );
}
