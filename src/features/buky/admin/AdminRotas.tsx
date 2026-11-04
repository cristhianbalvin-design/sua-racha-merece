import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import type { City } from "../lib/api";
import { getCity } from "../lib/api";
import { useRouteRules } from "../lib/hooks";
import { placeBukys, type DraftPoint } from "../lib/routeDraft";
import BukyMap from "../components/BukyMap";
import { listRoutes, saveOfficialRoute, setRouteActive, type AdminRoute } from "./adminApi";
import { AdminCityPicker, Badge, btnDanger, btnGhost, btnPrimary, card, dt, Field, inputCls } from "./ui";

const NITEROI = { lat: -22.8832, lon: -43.1034 };

interface Draft {
  id?: string;
  name: string;
  city: City | null;
  active: boolean;
  /** Trazo del recorrido (vértices). */
  path: DraftPoint[];
  everyM: number;
  radiusM: number;
  /** La ruta era por puntos (antes del paso 21): se convierte en trazo al guardar. */
  legacy: boolean;
}

/**
 * Rutas oficiales: el admin DIBUJA el recorrido (igual que el atleta) y los Bukys se ubican solos
 * cada N metros a lo largo del camino. Distancia entre Bukys y radio se definen por ruta.
 */
export default function AdminRotas() {
  const qc = useQueryClient();
  const { data: rules } = useRouteRules();
  const [city, setCity] = useState<City | null>(null);
  const [kind, setKind] = useState<"all" | "official" | "athlete">("official");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<DraftPoint[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const dragStart = useRef<DraftPoint[] | null>(null);
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["admin-buky", "routes", city?.code, kind],
    queryFn: () => listRoutes({ cityCode: city?.code, kind }),
  });

  const placed = useMemo(() => (draft ? placeBukys(draft.path, draft.everyM, draft.radiusM) : { bukys: [], lengthM: 0 }), [draft]);

  const edit = async (r?: AdminRoute) => {
    setSelected(null);
    setHistory([]);
    const everyM = r?.buky_every_m ?? rules?.minGapM ?? 200;
    const radiusM = r?.points[0]?.radius_m ?? rules?.radiusM ?? 50;
    if (!r) return setDraft({ name: "", city, active: true, path: [], everyM, radiusM, legacy: false });
    const path = r.path && r.path.length > 1 ? r.path : r.points.map((p) => ({ lat: p.lat, lon: p.lon }));
    const routeCity = await getCity(r.city_code).catch(() => null);
    setDraft({ id: r.id, name: r.name, city: routeCity, active: r.active, path, everyM, radiusM, legacy: !r.path });
  };

  const setPath = (next: DraftPoint[], record = true) =>
    setDraft((d) => {
      if (!d) return d;
      if (record) setHistory((h) => [...h.slice(-49), d.path]);
      return { ...d, path: next };
    });

  const onMapClick = (p: DraftPoint) => {
    if (!draft || draft.path.length >= 400) return;
    if (selected !== null) {
      setPath([...draft.path.slice(0, selected + 1), p, ...draft.path.slice(selected + 1)]);
      setSelected(selected + 1);
    } else setPath([...draft.path, p]);
  };

  const onDrag = (i: number, p: DraftPoint, done: boolean) => {
    if (!draft) return;
    if (!dragStart.current) dragStart.current = draft.path;
    setDraft((d) => d && { ...d, path: d.path.map((q, k) => (k === i ? p : q)) });
    if (done) {
      const before = dragStart.current;
      dragStart.current = null;
      setHistory((h) => [...h.slice(-49), before]);
    }
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setDraft((d) => d && { ...d, path: prev });
    setSelected(null);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.city) return toast.error("Escolha a cidade da rota.");
    if (draft.name.trim().length < 3) return toast.error("O nome precisa ter pelo menos 3 letras.");
    if (placed.bukys.length < 1) return toast.error("Desenhe um caminho mais longo: ainda não há Bukys.");
    setSaving(true);
    try {
      await saveOfficialRoute({
        id: draft.id,
        name: draft.name.trim(),
        city_code: draft.city.code,
        active: draft.active,
        path: draft.path,
        everyM: draft.everyM,
        radiusM: draft.radiusM,
        bukys: placed.bukys,
        lengthM: placed.lengthM,
      });
      toast.success(`Rota salva com ${placed.bukys.length} Bukys.`);
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["admin-buky"] });
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(
        msg.includes("foreign key")
          ? "A rota ficou com menos Bukys e um deles já tem passagens registradas: crie uma rota nova e desative esta."
          : `Erro ao salvar: ${msg}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (draft) {
    // Centro estable (la ciudad); una ruta existente se encuadra con fitTo
    const center = draft.city ?? NITEROI;
    const chip = "flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40";
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="buky relative h-[520px] overflow-hidden rounded-2xl lg:h-[640px]">
            <BukyMap
              center={{ lat: center.lat, lon: center.lon }}
              zoom={15}
              editable
              showRadius
              selected={selected}
              vertices={draft.path}
              fitTo={draft.id ? draft.path : undefined}
              points={placed.bukys.map((b, i) => ({ id: `b${i}`, lat: b.lat, lon: b.lon, radiusM: draft.radiusM, state: "idle" as const }))}
              onMapClick={onMapClick}
              onPointTap={(i) => setSelected((x) => (x === i ? null : i))}
              onPointDrag={onDrag}
            />
            <div className="absolute left-3 top-3 flex gap-2">
              <button type="button" className={chip} onClick={undo} disabled={!history.length}>
                <Undo2 size={14} /> DESFAZER
              </button>
              <button
                type="button"
                className={chip}
                disabled={!draft.path.length}
                onClick={() => {
                  if (window.confirm("Apagar o caminho inteiro?")) {
                    setPath([]);
                    setSelected(null);
                  }
                }}
              >
                <Trash2 size={14} /> LIMPAR
              </button>
            </div>
            {selected !== null && draft.path[selected] && (
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-3 rounded-xl bg-black/85 px-3 py-2 text-xs text-white">
                <b>Ponto {selected + 1} do caminho</b>
                <span className="text-white/70">Clique no mapa para inserir um ponto depois dele.</span>
                <button
                  type="button"
                  className="ml-auto font-bold text-red-400"
                  onClick={() => {
                    setPath(draft.path.filter((_, k) => k !== selected));
                    setSelected(null);
                  }}
                >
                  REMOVER
                </button>
                <button type="button" onClick={() => setSelected(null)} aria-label="Fechar">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Clique no mapa para desenhar o caminho pelas ruas (nas curvas, marque pontos pertinho). Arraste um ponto para ajustá-lo; clique num
            ponto para removê-lo ou inserir outro depois. Os Bukys (verde, com a zona de captura) se posicionam sozinhos.
          </p>
        </div>
        <div className={`${card} space-y-4 p-4`}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold italic">{draft.id ? "EDITAR ROTA OFICIAL" : "NOVA ROTA OFICIAL"}</h2>
            <button type="button" onClick={() => setDraft(null)} className="text-muted-foreground" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <Field label="Nome">
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Orla de Icaraí" />
          </Field>
          <Field label="Cidade">
            <AdminCityPicker value={draft.city} onChange={(c) => setDraft({ ...draft, city: c })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distância entre Bukys (m)">
              <input
                type="number"
                min={50}
                max={5000}
                step={10}
                className={inputCls}
                value={draft.everyM}
                onChange={(e) => setDraft({ ...draft, everyM: Math.min(5000, Math.max(50, Number(e.target.value) || 200)) })}
              />
            </Field>
            <Field label="Raio de cada Buky (m)">
              <input
                type="number"
                min={20}
                max={200}
                step={5}
                className={inputCls}
                value={draft.radiusM}
                onChange={(e) => setDraft({ ...draft, radiusM: Math.min(200, Math.max(20, Number(e.target.value) || 50)) })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Ativa (visível para os atletas)
          </label>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { v: placed.bukys.length, l: "Bukys" },
              { v: (placed.lengthM / 1000).toFixed(2), l: "km" },
              { v: draft.path.length, l: "pontos do caminho" },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-muted/40 py-2">
                <p className={`text-lg font-black italic ${x.l === "Bukys" ? "text-primary" : ""}`}>{x.v}</p>
                <p className="text-[11px] text-muted-foreground">{x.l}</p>
              </div>
            ))}
          </div>
          {draft.legacy && (
            <p className="rounded-lg bg-yellow-500/10 p-2 text-[11px] text-yellow-400">
              Esta rota foi criada por pontos. O caminho foi montado com eles; ao salvar, os Bukys são recalculados ao longo do caminho a cada{" "}
              {draft.everyM} m.
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-black bg-white" /> Ponto do caminho
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#39ff14]" /> Buky para pegar
            </span>
          </div>
          <button type="button" className={`${btnPrimary} w-full justify-center`} onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? "SALVANDO…" : "SALVAR ROTA"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Field label="Cidade">
            <AdminCityPicker value={city} onChange={setCity} placeholder="Todas as cidades" />
          </Field>
        </div>
        <Field label="Tipo">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="official">Oficiais</option>
            <option value="athlete">De atletas</option>
            <option value="all">Todas</option>
          </select>
        </Field>
        <button type="button" className={`${btnPrimary} ml-auto`} onClick={() => edit()}>
          <Plus size={14} /> NOVA ROTA OFICIAL
        </button>
      </div>
      <div className={`${card} overflow-hidden`}>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : routes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma rota.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Rota</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Bukys</th>
                <th className="px-4 py-3">Extensão</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {routes.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.kind === "athlete" ? `de ${r.owner_name ?? "atleta"}` : "oficial"} · {dt(r.created_at)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{r.city_name} · {r.uf}</td>
                  <td className="px-4 py-3">{r.points.length}</td>
                  <td className="px-4 py-3">{r.length_m ? `${(r.length_m / 1000).toFixed(2)} km` : "—"}</td>
                  <td className="px-4 py-3">{r.active ? <Badge tone="green">ativa</Badge> : <Badge>inativa</Badge>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {r.kind === "official" && (
                        <button type="button" className={btnGhost} onClick={() => edit(r)}>EDITAR</button>
                      )}
                      <button
                        type="button"
                        className={r.active ? btnDanger : btnGhost}
                        onClick={async () => {
                          await setRouteActive(r.id, !r.active).catch((e) => toast.error(String(e.message)));
                          void qc.invalidateQueries({ queryKey: ["admin-buky"] });
                        }}
                      >
                        {r.active ? "DESATIVAR" : "ATIVAR"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
