import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { haversineMeters } from "@/features/buky/engine";
import type { City } from "../lib/api";
import { getCity } from "../lib/api";
import { listRoutes, routeLength, saveOfficialRoute, setRouteActive, type AdminPoint, type AdminRoute } from "./adminApi";
import RouteEditorMap from "./RouteEditorMap";
import { AdminCityPicker, Badge, btnDanger, btnGhost, btnPrimary, card, dt, Field, inputCls } from "./ui";

const NITEROI = { lat: -22.8832, lon: -43.1034 };

interface Draft {
  id?: string;
  name: string;
  city: City | null;
  active: boolean;
  points: AdminPoint[];
}

export default function AdminRotas() {
  const qc = useQueryClient();
  const [city, setCity] = useState<City | null>(null);
  const [kind, setKind] = useState<"all" | "official" | "athlete">("official");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["admin-buky", "routes", city?.code, kind],
    queryFn: () => listRoutes({ cityCode: city?.code, kind }),
  });

  const edit = async (r?: AdminRoute) => {
    setSelected(null);
    if (!r) return setDraft({ name: "", city, active: true, points: [] });
    setDraft({ id: r.id, name: r.name, city: await getCity(r.city_code), active: r.active, points: r.points });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.city) return toast.error("Escolha a cidade da rota.");
    if (draft.name.trim().length < 3) return toast.error("O nome precisa ter pelo menos 3 letras.");
    if (draft.points.length < 1) return toast.error("Marque pelo menos um ponto no mapa.");
    setSaving(true);
    try {
      await saveOfficialRoute({ id: draft.id, name: draft.name.trim(), city_code: draft.city.code, active: draft.active, points: draft.points });
      toast.success("Rota salva.");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["admin-buky"] });
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg.includes("foreign key") ? "Um ponto removido já tem passagens registradas: desative a rota em vez de remover o ponto." : `Erro ao salvar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const setPoint = (i: number, patch: Partial<AdminPoint>) =>
    setDraft((d) => d && { ...d, points: d.points.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const movePoint = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const ps = [...d.points];
      const j = i + dir;
      if (j < 0 || j >= ps.length) return d;
      [ps[i], ps[j]] = [ps[j], ps[i]];
      return { ...d, points: ps.map((p, k) => ({ ...p, seq: k })) };
    });

  if (draft) {
    const center = draft.points[0] ?? draft.city ?? NITEROI;
    const closePairs = draft.points.flatMap((p, i) =>
      draft.points.slice(0, i).flatMap((q, j) => (haversineMeters(p.lat, p.lon, q.lat, q.lon) < p.radius_m + q.radius_m + 10 ? [`${j + 1}–${i + 1}`] : [])),
    );
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="h-[520px] lg:h-[640px]">
          <RouteEditorMap
            points={draft.points}
            selected={selected}
            center={{ lat: center.lat, lon: center.lon }}
            onAdd={(p) => setDraft((d) => d && { ...d, points: [...d.points, { seq: d.points.length, label: `BUKY_${String(d.points.length + 1).padStart(2, "0")}`, lat: p.lat, lon: p.lon, radius_m: 50 }] })}
            onMove={(i, p) => setPoint(i, p)}
            onSelect={setSelected}
          />
          <p className="mt-2 text-xs text-muted-foreground">Clique no mapa para adicionar um ponto no fim do percurso. Arraste os pontos para ajustar.</p>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Ativa (visível para os atletas)
          </label>
          <div>
            <p className="mb-2 text-xs font-bold text-muted-foreground">
              {draft.points.length} pontos · {(routeLength(draft.points) / 1000).toFixed(2)} km
            </p>
            {closePairs.length > 0 && (
              <p className="mb-2 rounded-lg bg-yellow-500/10 p-2 text-[11px] text-yellow-400">
                Raios encostados ({closePairs.join(", ")}): o atleta pode ganhar os dois pontos de uma vez.
              </p>
            )}
            <ul className="max-h-[300px] space-y-1 overflow-auto pr-1">
              {draft.points.map((p, i) => (
                <li key={i} className={`flex items-center gap-2 rounded-lg p-2 text-xs ${selected === i ? "bg-primary/10" : "bg-muted/40"}`} onClick={() => setSelected(i)}>
                  <span className="w-5 font-bold text-primary">{i + 1}</span>
                  <input className="w-24 rounded bg-input px-2 py-1" value={p.label} onChange={(e) => setPoint(i, { label: e.target.value })} aria-label="Nome do ponto" />
                  <input
                    type="number"
                    min={20}
                    max={200}
                    step={5}
                    className="w-16 rounded bg-input px-2 py-1"
                    value={p.radius_m}
                    onChange={(e) => setPoint(i, { radius_m: Math.min(200, Math.max(20, Number(e.target.value) || 50)) })}
                    aria-label="Raio em metros"
                    title="Raio (m)"
                  />
                  <span className="text-muted-foreground">m</span>
                  <span className="ml-auto flex gap-1">
                    <button type="button" onClick={() => movePoint(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => movePoint(i, 1)} aria-label="Descer"><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => setDraft({ ...draft, points: draft.points.filter((_, k) => k !== i).map((q, k) => ({ ...q, seq: k })) })} aria-label="Remover" className="text-destructive">
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
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
                <th className="px-4 py-3">Pontos</th>
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
