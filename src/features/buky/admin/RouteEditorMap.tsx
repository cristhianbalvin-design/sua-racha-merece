import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadDarkStyle } from "../lib/mapStyle";
import type { AdminPoint } from "./adminApi";

/**
 * Editor de puntos para el admin: clic en el mapa agrega un punto al final del recorrido;
 * cada punto es un marcador numerado que se puede arrastrar; el círculo muestra su radio real.
 */
export default function RouteEditorMap({
  points,
  selected,
  center,
  onAdd,
  onMove,
  onSelect,
}: {
  points: AdminPoint[];
  selected: number | null;
  center: { lat: number; lon: number };
  onAdd: (p: { lat: number; lon: number }) => void;
  onMove: (index: number, p: { lat: number; lon: number }) => void;
  onSelect: (index: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const markers = useRef<maplibregl.Marker[]>([]);
  const cb = useRef({ onAdd, onMove, onSelect });
  cb.current = { onAdd, onMove, onSelect };
  const latest = useRef({ points, selected });
  latest.current = { points, selected };

  useEffect(() => {
    let cancelled = false;
    loadDarkStyle().then((style) => {
      if (cancelled || !el.current) return;
      const m = new maplibregl.Map({ container: el.current, style, center: [center.lon, center.lat], zoom: 14, dragRotate: false });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.current = m;
      m.on("load", () => {
        m.addSource("radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#39ff14", "fill-opacity": 0.12 } });
        m.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#39ff14", "line-width": 1, "line-opacity": 0.6 } });
        m.addSource("path", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "path", type: "line", source: "path", paint: { "line-color": "#39ff14", "line-width": 2, "line-dasharray": [2, 1.5], "line-opacity": 0.7 } });
        ready.current = true;
        if (el.current) el.current.dataset.ready = "1";
        sync();
      });
      m.on("click", (e) => cb.current.onAdd({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
    });
    return () => {
      cancelled = true;
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { points: pts, selected: sel } = latest.current;
    const circles = pts.map((p) => {
      const coords: [number, number][] = [];
      const dLat = p.radius_m / 111_320;
      const dLon = p.radius_m / (111_320 * Math.cos((p.lat * Math.PI) / 180));
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * 2 * Math.PI;
        coords.push([p.lon + dLon * Math.cos(a), p.lat + dLat * Math.sin(a)]);
      }
      return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coords] } };
    });
    (m.getSource("radius") as GeoJSONSource).setData({ type: "FeatureCollection", features: circles });
    (m.getSource("path") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: pts.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) } }] : [],
    });
    // Marcadores numerados y arrastrables
    markers.current.forEach((mk) => mk.remove());
    markers.current = pts.map((p, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.textContent = String(i + 1);
      dot.setAttribute("aria-label", `Ponto ${i + 1}`);
      dot.style.cssText = `width:26px;height:26px;border-radius:50%;font:700 12px Inter,system-ui;cursor:grab;border:2px solid ${
        i === sel ? "#fff" : "#050505"
      };background:#39ff14;color:#050505;box-shadow:0 0 0 ${i === sel ? 4 : 0}px rgba(57,255,20,.35)`;
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onSelect(i);
      });
      const mk = new maplibregl.Marker({ element: dot, draggable: true }).setLngLat([p.lon, p.lat]).addTo(m);
      mk.on("dragend", () => {
        const ll = mk.getLngLat();
        cb.current.onMove(i, { lat: ll.lat, lon: ll.lng });
      });
      return mk;
    });
  };

  useEffect(sync, [points, selected]);

  useEffect(() => {
    map.current?.easeTo({ center: [center.lon, center.lat], duration: 500 });
  }, [center.lat, center.lon]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
