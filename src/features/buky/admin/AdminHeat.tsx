import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import { supabase } from "@/lib/supabase";
import { loadDarkStyle } from "../lib/mapStyle";
import { HEAT_CELL_DEGREES, trackToHeatCells } from "../lib/heat";
import { parseTrackFile } from "../lib/trackFile";
import { btnGhost, card, inputCls } from "./ui";

type City = {
  code: number;
  name: string;
  uf: string;
  lat: number;
  lon: number;
  sessions: number;
};
type Heat = {
  sessions: number;
  athletes: number;
  cells: { x: number; y: number; hits: number }[];
};
async function rpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}
function HeatMap({ city, heat }: { city: City; heat: Heat }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | undefined;
    loadDarkStyle().then((style) => {
      if (cancelled || !el.current) return;
      map = new maplibregl.Map({
        container: el.current,
        style,
        center: [city.lon, city.lat],
        zoom: 11,
      });
      map.on("load", () => {
        map?.addSource("heat", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: heat.cells.map((c) => ({
              type: "Feature",
              properties: { hits: c.hits },
              geometry: {
                type: "Point",
                coordinates: [
                  (c.x + 0.5) * HEAT_CELL_DEGREES,
                  (c.y + 0.5) * HEAT_CELL_DEGREES,
                ],
              },
            })),
          },
        });
        map?.addLayer({
          id: "heat",
          type: "heatmap",
          source: "heat",
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "hits"],
              0,
              0,
              20,
              1,
            ],
            "heatmap-intensity": 1,
            "heatmap-radius": 22,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,0,0)",
              0.2,
              "#166534",
              0.5,
              "#84cc16",
              1,
              "#facc15",
            ],
          },
        });
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [city, heat]);
  return <div ref={el} className="h-96 w-full rounded-xl" />;
}
export default function AdminHeat() {
  const qc = useQueryClient();
  const [cityCode, setCityCode] = useState<number>();
  const [days, setDays] = useState<number | null>(30);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const cities = useQuery({
    queryKey: ["admin-buky", "heat-cities"],
    queryFn: () => rpc<City[]>("admin_buky_heat_cities"),
  });
  const city = cities.data?.find((c) => c.code === cityCode) ??
    cities.data?.[0];
  const heat = useQuery({
    queryKey: ["admin-buky", "heat", city?.code, days],
    enabled: !!city,
    queryFn: () =>
      rpc<Heat>("admin_buky_heat", { p_city_code: city!.code, p_days: days }),
  });
  const backfill = async () => {
    setBusy(true);
    setProgress("Buscando treinos?");
    let done = 0;
    try {
      while (true) {
        const batch = await rpc<
          { id: string; city_code: number; track_path: string }[]
        >("admin_buky_heat_pending", { p_limit: 20 });
        if (!batch.length) break;
        for (const s of batch) {
          const { data, error } = await supabase.storage.from("buky-tracks")
            .download(s.track_path);
          if (error) throw error;
          const cells = trackToHeatCells(await parseTrackFile(data));
          await rpc("admin_buky_heat_add", {
            p_city_code: s.city_code,
            p_cells: { session_id: s.id, cells },
          });
          done++;
          setProgress(`${done} treino(s) processado(s)`);
        }
      }
      setProgress(`${done} treino(s) processado(s). Hist?rico atualizado.`);
      await qc.invalidateQueries({ queryKey: ["admin-buky", "heat"] });
      await qc.invalidateQueries({ queryKey: ["admin-buky", "heat-cities"] });
    } catch {
      setProgress(
        `N?o foi poss?vel processar o hist?rico. ${done} treino(s) conclu?do(s); tente novamente.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="min-w-56">
          Cidade<select
            className={inputCls}
            value={city?.code ?? ""}
            onChange={(e) => setCityCode(Number(e.target.value))}
          >
            {cities.data?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ? {c.uf}
                {c.sessions ? ` (${c.sessions})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Per?odo<select
            className={inputCls}
            value={days ?? "all"}
            onChange={(e) =>
              setDays(e.target.value === "all" ? null : Number(e.target.value))}
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value="all">Todo o per?odo</option>
          </select>
        </label>
        <button className={btnGhost} disabled={busy} onClick={backfill}>
          Recalcular hist?rico
        </button>
      </div>
      {progress && <p role="status">{progress}</p>}
      {(cities.isError || heat.isError) && (
        <p>N?o foi poss?vel carregar o mapa de calor.</p>
      )}
      {heat.data && city && (
        <div className={`${card} space-y-3 p-4`}>
          <p>
            {heat.data.sessions} treinos livres ? {heat.data.athletes} atletas
          </p>
          {heat.data.sessions === 0
            ? <p>Ainda n?o h? treinos livres nesta cidade</p>
            : heat.data.cells.length === 0
            ? (
              <p>
                Os dados desta cidade est?o protegidos pela regra de
                privacidade.
              </p>
            )
            : (
              <>
                <HeatMap city={city} heat={heat.data} />
                <p className="text-xs">Intensidade: baixa ?? ? alta ??</p>
              </>
            )}
          <p className="text-xs text-muted-foreground">
            Com menos de tr?s atletas no per?odo, c?lulas de apenas um atleta
            ficam ocultas.
          </p>
        </div>
      )}
    </div>
  );
}
