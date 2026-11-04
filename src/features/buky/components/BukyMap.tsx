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
  /** Línea que une los puntos en orden (si no se da `path`). */
  showPath?: boolean;
  /** Trazo del recorrido (rutas dibujadas): se dibuja como línea. */
  path?: { lat: number; lon: number }[] | null;
  /** Encuadra el mapa para que entren todos estos puntos (historial). */
  fitTo?: { lat: number; lon: number }[];
  /** Recorrido ya hecho por el atleta (entrenamiento): línea blanca sobre la ruta. */
  trail?: { lat: number; lon: number }[];
  /** Editor: vértices del trazo (puntos blancos que se tocan y arrastran). */
  vertices?: { lat: number; lon: number }[];
  /** Dibuja el radio de captura de cada Buky (m reales, escala con el zoom). */
  showRadius?: boolean;
  /** Cambiarlo vuelve a centrar el mapa en `center` (botón "mi posición"). */
  recenterKey?: number;
  /** Editor de ruta: los vértices se arrastran y se tocan para elegirlos. */
  editable?: boolean;
  /** Índice del vértice elegido (se resalta). */
  selected?: number | null;
  onPointTap?: (index: number) => void;
  /** Durante el arrastre (en vivo) y al soltar (`done`). */
  onPointDrag?: (index: number, pos: { lat: number; lon: number }, done: boolean) => void;
  className?: string;
}

const NEON = "#39FF14";

// Radio en píxeles al zoom 22 (MapLibre usa teselas de 512 px): el círculo escala con el zoom.
const radiusAtZ22 = (lat: number, m: number) => m / ((78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** 22);

const toFeatures = (points: MapPoint[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((p, i) => ({
    type: "Feature" as const,
    id: i,
    properties: { id: p.id, state: p.state ?? "idle", n: i + 1, i, r22: radiusAtZ22(p.lat, p.radiusM ?? 50) },
    geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
  })),
});

const toVertexFeatures = (vs: { lat: number; lon: number }[]) => ({
  type: "FeatureCollection" as const,
  features: vs.map((p, i) => ({
    type: "Feature" as const,
    id: i,
    properties: { i, first: i === 0 ? 1 : 0 },
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
  path,
  trail,
  fitTo,
  vertices,
  showRadius,
  recenterKey,
  editable,
  selected = null,
  onPointTap,
  onPointDrag,
  className,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const editRef = useRef({ editable, onPointTap, onPointDrag });
  editRef.current = { editable, onPointTap, onPointDrag };
  const latest = useRef({ points, user, nearRadiusM, showPath, selected, path, vertices, showRadius, trail });
  latest.current = { points, user, nearRadiusM, showPath, selected, path, vertices, showRadius, trail };
  const fitRef = useRef(fitTo);
  fitRef.current = fitTo;

  const fit = () => {
    const m = map.current;
    const pts = fitRef.current;
    if (!m || !ready.current || !pts || pts.length < 2) return;
    const b = new maplibregl.LngLatBounds([pts[0].lon, pts[0].lat], [pts[0].lon, pts[0].lat]);
    for (const p of pts) b.extend([p.lon, p.lat]);
    m.fitBounds(b, { padding: 48, maxZoom: 17, duration: 0 });
  };

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
        attributionControl: false,
        interactive,
        pitchWithRotate: false,
        dragRotate: false,
      });
      map.current = m;
      // Créditos del mapa arriba a la derecha (bajo el avatar) y plegados en una "i", para que no
      // tapen los datos ni el botón Iniciar
      m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenStreetMap" }), "top-right");
      m.on("load", () => {
        el.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        m.addSource("near", { type: "geojson", data: EMPTY });
        m.addLayer({
          id: "near-line",
          type: "line",
          source: "near",
          paint: { "line-color": NEON, "line-opacity": 0.55, "line-width": 1, "line-dasharray": [2, 2] },
        });
        m.addSource("path", { type: "geojson", data: EMPTY });
        m.addLayer({
          id: "path-line",
          type: "line",
          source: "path",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": NEON, "line-width": 4, "line-opacity": 0.45 },
        });
        m.addSource("trail", { type: "geojson", data: EMPTY });
        m.addLayer({
          id: "trail-line",
          type: "line",
          source: "trail",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 3.5, "line-opacity": 0.95 },
        });
        m.addSource("points", { type: "geojson", data: EMPTY });
        // Zona de captura real de cada Buky (editor de rutas)
        m.addLayer({
          id: "points-radius",
          type: "circle",
          source: "points",
          filter: ["==", ["get", "state"], "idle"],
          layout: { visibility: "none" },
          paint: {
            "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, ["/", ["get", "r22"], 4194304], 22, ["get", "r22"]],
            "circle-color": NEON,
            "circle-opacity": 0.1,
            "circle-stroke-color": NEON,
            "circle-stroke-opacity": 0.45,
            "circle-stroke-width": 1,
          },
        });
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
        // Editor: vértices del trazo (blancos), el elegido con anillo y una zona de toque amplia e invisible
        m.addSource("vertices", { type: "geojson", data: EMPTY });
        m.addLayer({
          id: "vertex-core",
          type: "circle",
          source: "vertices",
          paint: {
            "circle-radius": ["case", ["==", ["get", "first"], 1], 6.5, 5],
            "circle-color": "#ffffff",
            "circle-stroke-color": "#050505",
            "circle-stroke-width": 2,
          },
        });
        m.addLayer({
          id: "vertex-selected",
          type: "circle",
          source: "vertices",
          filter: ["==", ["get", "i"], -1],
          paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 },
        });
        m.addLayer({ id: "vertex-hit", type: "circle", source: "vertices", paint: { "circle-radius": 20, "circle-opacity": 0 } });
        // Números de orden (crear ruta); solo si el estilo trae tipografías (sin teselas no hay)
        if ((latest.current.showPath || latest.current.vertices) && m.getStyle().glyphs) {
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
        fit();
      });
      m.on("click", (e) => {
        const hit = editRef.current.editable && ready.current ? m.queryRenderedFeatures(e.point, { layers: ["vertex-hit"] })[0] : undefined;
        if (hit) return editRef.current.onPointTap?.(Number(hit.properties?.i));
        clickRef.current?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      });

      // Arrastrar un punto (mouse y dedo). Si no se movió, el "click" de arriba lo toma como toque.
      let drag: number | null = null;
      const move = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
        if (drag === null) return;
        editRef.current.onPointDrag?.(drag, { lat: e.lngLat.lat, lon: e.lngLat.lng }, false);
      };
      const end = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
        if (drag === null) return;
        const i = drag;
        drag = null;
        m.dragPan.enable();
        m.getCanvas().style.cursor = "";
        m.off("mousemove", move);
        m.off("touchmove", move);
        editRef.current.onPointDrag?.(i, { lat: e.lngLat.lat, lon: e.lngLat.lng }, true);
      };
      const startDrag = (e: maplibregl.MapLayerMouseEvent | maplibregl.MapLayerTouchEvent) => {
        if (!editRef.current.editable || !e.features?.length) return;
        if ("touches" in e.originalEvent && e.originalEvent.touches.length > 1) return;
        e.preventDefault();
        drag = Number(e.features[0].properties?.i);
        m.dragPan.disable();
        m.getCanvas().style.cursor = "grabbing";
        m.on("mousemove", move);
        m.on("touchmove", move);
        m.once("mouseup", end);
        m.once("touchend", end);
      };
      m.on("mousedown", "vertex-hit", startDrag);
      m.on("touchstart", "vertex-hit", startDrag);
      m.on("mouseenter", "vertex-hit", () => editRef.current.editable && (m.getCanvas().style.cursor = "grab"));
      m.on("mouseleave", "vertex-hit", () => (m.getCanvas().style.cursor = ""));
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
    const { points: pts, user: u, nearRadiusM: near, showPath: linePts, selected: sel, path: trace, vertices: vs, showRadius: radius, trail: done } = latest.current;
    m.setFilter("vertex-selected", ["==", ["get", "i"], sel ?? -1]);
    m.setLayoutProperty("points-radius", "visibility", radius ? "visible" : "none");
    (m.getSource("points") as GeoJSONSource).setData(toFeatures(pts));
    (m.getSource("vertices") as GeoJSONSource).setData(toVertexFeatures(vs ?? []));
    if (el.current) {
      el.current.dataset.points = String(pts.length);
      el.current.dataset.zoom = m.getZoom().toFixed(2);
    }
    const line = trace && trace.length > 1 ? trace : vs && vs.length > 1 ? vs : linePts && pts.length > 1 ? pts : null;
    (m.getSource("path") as GeoJSONSource).setData(
      line ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line.map((p) => [p.lon, p.lat]) } } : EMPTY,
    );
    (m.getSource("trail") as GeoJSONSource).setData(
      done && done.length > 1
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: done.map((p) => [p.lon, p.lat]) } }
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

  useEffect(sync, [points, user, nearRadiusM, showPath, selected, path, vertices, showRadius, trail]);
  useEffect(fit, [fitTo?.length, fitTo?.[0]?.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centrar cuando cambia el centro pedido o al seguir al atleta
  useEffect(() => {
    const m = map.current;
    if (!m || !center) return;
    m.easeTo({ center: [center.lon, center.lat], duration: 600 });
  }, [center?.lat, center?.lon, recenterKey]);

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
