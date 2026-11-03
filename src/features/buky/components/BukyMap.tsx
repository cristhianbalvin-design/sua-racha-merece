import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadDarkStyle } from "../lib/mapStyle";

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  radiusM?: number;
  /** "idle": punto por recoger (Início); "pending" / "visited": durante el entrenamiento. */
  state?: "idle" | "pending" | "visited";
}

interface Props {
  center: { lat: number; lon: number } | null;
  zoom?: number;
  points: MapPoint[];
  user?: { lat: number; lon: number; accuracy?: number } | null;
  /** Radio (m) del círculo punteado "cerca de ti" alrededor del atleta. */
  nearRadiusM?: number;
  /** Sigue al atleta (entrenamiento). */
  follow?: boolean;
  interactive?: boolean;
  onMapClick?: (lngLat: { lat: number; lon: number }) => void;
  /** Línea que une los puntos en orden (crear ruta). */
  showPath?: boolean;
  className?: string;
}

const NEON = "#39FF14";

const toFeatures = (points: MapPoint[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((p, i) => ({
    type: "Feature" as const,
    id: i,
    properties: { id: p.id, state: p.state ?? "idle", n: i + 1 },
    geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
  })),
});

/** Círculo geográfico como polígono (para el radio "cerca de ti"). */
function circle(lat: number, lon: number, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coords] } };
}

const EMPTY = { type: "FeatureCollection" as const, features: [] };

export default function BukyMap({
  center,
  zoom = 14,
  points,
  user,
  nearRadiusM,
  follow,
  interactive = true,
  onMapClick,
  showPath,
  className,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const latest = useRef({ points, user, nearRadiusM, showPath });
  latest.current = { points, user, nearRadiusM, showPath };

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!el.current) return;
    let cancelled = false;
    const start = center ?? { lat: -22.9035, lon: -43.1153 };
    loadDarkStyle().then((style) => {
      if (cancelled || !el.current) return;
      const m = new maplibregl.Map({
        container: el.current,
        style,
        center: [start.lon, start.lat],
        zoom,
        attributionControl: { compact: true, customAttribution: "© OpenStreetMap" },
        interactive,
        pitchWithRotate: false,
        dragRotate: false,
      });
      map.current = m;
      m.on("load", () => {
        m.addSource("near", { type: "geojson", data: EMPTY });
        m.addLayer({
          id: "near-line",
          type: "line",
          source: "near",
          paint: { "line-color": NEON, "line-opacity": 0.55, "line-width": 1, "line-dasharray": [2, 2] },
        });
        m.addSource("path", { type: "geojson", data: EMPTY });
        m.addLayer({ id: "path-line", type: "line", source: "path", paint: { "line-color": NEON, "line-width": 2, "line-opacity": 0.6 } });
        m.addSource("points", { type: "geojson", data: EMPTY });
        // halo de los puntos recogidos / por recoger
        m.addLayer({
          id: "points-glow",
          type: "circle",
          source: "points",
          filter: ["!=", ["get", "state"], "pending"],
          paint: {
            "circle-radius": ["match", ["get", "state"], "visited", 16, 10],
            "circle-color": NEON,
            "circle-opacity": 0.18,
            "circle-blur": 0.4,
          },
        });
        m.addLayer({
          id: "points-core",
          type: "circle",
          source: "points",
          paint: {
            "circle-radius": ["match", ["get", "state"], "visited", 9, "pending", 5, 5],
            "circle-color": ["match", ["get", "state"], "pending", "rgba(0,0,0,0)", NEON],
            "circle-stroke-color": ["match", ["get", "state"], "pending", "#cfcfcf", NEON],
            "circle-stroke-width": ["match", ["get", "state"], "pending", 1.4, 0],
          },
        });
        // Números de orden (crear ruta); solo si el estilo trae tipografías (sin teselas no hay)
        if (latest.current.showPath && m.getStyle().glyphs) {
          m.addLayer({
            id: "points-number",
            type: "symbol",
            source: "points",
            layout: { "text-field": ["to-string", ["get", "n"]], "text-size": 11, "text-offset": [0, -1.4], "text-font": ["Noto Sans Bold"] },
            paint: { "text-color": "#ffffff", "text-halo-color": "#050505", "text-halo-width": 1.5 },
          });
        }
        ready.current = true;
        if (el.current) el.current.dataset.ready = "1";
        sync();
      });
      m.on("click", (e) => clickRef.current?.({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
    });
    return () => {
      cancelled = true;
      ready.current = false;
      userMarker.current?.remove();
      userMarker.current = null;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { points: pts, user: u, nearRadiusM: near, showPath: path } = latest.current;
    (m.getSource("points") as GeoJSONSource).setData(toFeatures(pts));
    if (el.current) {
      el.current.dataset.points = String(pts.length);
      el.current.dataset.zoom = m.getZoom().toFixed(2);
    }
    (m.getSource("path") as GeoJSONSource).setData(
      path && pts.length > 1
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) } }
        : EMPTY,
    );
    (m.getSource("near") as GeoJSONSource).setData(u && near ? circle(u.lat, u.lon, near) : EMPTY);
    if (u) {
      if (!userMarker.current) {
        const dot = document.createElement("div");
        dot.setAttribute("aria-label", "Você está aqui");
        dot.style.cssText =
          "width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center";
        dot.innerHTML =
          '<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:4px solid #050505;box-shadow:0 0 0 2px #fff"></div>';
        userMarker.current = new maplibregl.Marker({ element: dot }).setLngLat([u.lon, u.lat]).addTo(m);
      } else {
        userMarker.current.setLngLat([u.lon, u.lat]);
      }
    } else {
      userMarker.current?.remove();
      userMarker.current = null;
    }
  };

  useEffect(sync, [points, user, nearRadiusM, showPath]);

  // Centrar cuando cambia el centro pedido o al seguir al atleta
  useEffect(() => {
    const m = map.current;
    if (!m || !center) return;
    m.easeTo({ center: [center.lon, center.lat], duration: 600 });
  }, [center?.lat, center?.lon]);

  useEffect(() => {
    const m = map.current;
    if (!m || !follow || !user) return;
    m.easeTo({ center: [user.lon, user.lat], duration: 800 });
  }, [follow, user?.lat, user?.lon]);

  // MapLibre pone position:relative en su contenedor: el tamaño lo da el envoltorio.
  return (
    <div className={className ?? "absolute inset-0"}>
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
