/**
 * Estilo oscuro del mapa (mockup): tierra casi negra, agua negra, calles grises, parques con
 * un verde muy apagado y etiquetas discretas. Se parte del estilo "positron" de OpenFreeMap
 * (OpenStreetMap, gratis, sin clave ni límite de uso) y se recolorea al cargar.
 * Si las teselas no cargan, queda un fondo negro y el mapa sigue mostrando los puntos.
 */
import type { StyleSpecification, LayerSpecification } from "maplibre-gl";

export const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const C = {
  land: "#0b0b0b",
  water: "#000000",
  park: "#0c1a0f",
  building: "#131313",
  road: "#262626",
  roadMajor: "#333333",
  highway: "#3d3420",
  rail: "#1d1d1d",
  boundary: "#2f2f2f",
  label: "#7d7d7d",
  labelStrong: "#a3a3a3",
  halo: "#050505",
};

export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": C.land } }],
};

function recolor(layer: LayerSpecification): LayerSpecification | null {
  const id = layer.id.toLowerCase();
  const l = { ...layer, paint: { ...(layer as { paint?: object }).paint } } as LayerSpecification & { paint: Record<string, unknown> };
  switch (l.type) {
    case "background":
      l.paint["background-color"] = C.land;
      return l;
    case "fill": {
      let color = C.land;
      if (id.includes("water")) color = C.water;
      else if (/park|wood|forest|grass|green|landcover|nature/.test(id)) color = C.park;
      else if (id.includes("building")) color = C.building;
      l.paint["fill-color"] = color;
      l.paint["fill-outline-color"] = color;
      if (id.includes("building")) l.paint["fill-opacity"] = 0.9;
      return l;
    }
    case "line": {
      let color = C.road;
      if (id.includes("water") || id.includes("river")) color = C.water;
      else if (/motorway|trunk/.test(id)) color = C.highway;
      else if (/primary|secondary/.test(id)) color = C.roadMajor;
      else if (/rail|transit/.test(id)) color = C.rail;
      else if (/boundary|admin/.test(id)) color = C.boundary;
      l.paint["line-color"] = color;
      return l;
    }
    case "symbol": {
      // Solo se dejan nombres de lugares, barrios y calles principales
      if (/poi|housenumber|aeroway|shield/.test(id)) return null;
      l.paint["text-color"] = /place|city|town/.test(id) ? C.labelStrong : C.label;
      l.paint["text-halo-color"] = C.halo;
      l.paint["text-halo-width"] = 1.2;
      return l;
    }
    case "fill-extrusion":
      return null;
    default:
      return l;
  }
}

let cached: Promise<StyleSpecification> | null = null;

export function loadDarkStyle(): Promise<StyleSpecification> {
  if (cached) return cached;
  cached = fetch(OPENFREEMAP_STYLE)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((style: StyleSpecification) => ({
      ...style,
      layers: style.layers.map(recolor).filter((l): l is LayerSpecification => l !== null),
    }))
    .catch(() => {
      cached = null; // reintenta la próxima vez
      return FALLBACK_STYLE;
    });
  return cached;
}
