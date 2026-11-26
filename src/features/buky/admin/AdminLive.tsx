import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { btnGhost, card } from "./ui";

type Row = { name: string; uf: string; count: number };
type Live = {
  now: { total: number; route: number; free: number };
  states: Row[];
  cities: Row[];
  athletes_today: number;
  athletes_24h: number;
  sessions_today: number;
  bukys_today: number;
  invalid_today: number;
  recent: {
    city: string;
    mode: string;
    started_at: string;
    status: string;
    athlete: string;
  }[];
};
async function fetchLive(): Promise<Live> {
  const { data, error } = await supabase.rpc("admin_buky_live");
  if (error) throw error;
  return data as Live;
}
function Breakdown(
  { title, rows, total }: { title: string; rows: Row[]; total: number },
) {
  const [sort, setSort] = useState<"count" | "name">("count");
  const sorted = [...rows].sort((a, b) =>
    sort === "count" ? b.count - a.count : a.name.localeCompare(b.name)
  );
  return (
    <div className={`${card} p-4`}>
      <div className="flex justify-between">
        <h3 className="font-bold">{title}</h3>
        <button
          className="text-xs underline"
          onClick={() => setSort(sort === "count" ? "name" : "count")}
        >
          Ordenar: {sort === "count" ? "quantidade" : "nome"}
        </button>
      </div>
      {sorted.map((r, i) => (
        <div key={`${r.uf}-${r.name}-${i}`} className="mt-3 text-sm">
          <div className="flex justify-between">
            <span>{r.name} · {r.uf}</span>
            <span>{r.count}</span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-muted">
            <div
              className="h-full rounded bg-primary"
              style={{ width: `${total ? r.count / total * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
export default function AdminLive() {
  const q = useQuery({
    queryKey: ["admin-buky", "live"],
    queryFn: fetchLive,
    refetchInterval: 15000,
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (q.isLoading) return <p>Carregando…</p>;
  if (q.isError || !q.data) {
    return (
      <div>
        Não foi possível carregar os dados.{" "}
        <button className={btnGhost} onClick={() => q.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  }
  const d = q.data;
  const metrics = [
    ["Agora", d.now.total],
    ["Em rotas", d.now.route],
    ["Treino livre", d.now.free],
    ["Atletas hoje", d.athletes_today],
    ["Atletas nas últimas 24 h", d.athletes_24h],
    ["Treinos iniciados hoje", d.sessions_today],
    ["Bukys encontrados hoje", d.bukys_today],
    ["Não validados hoje", d.invalid_today],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Atualizado há{" "}
          {Math.max(0, Math.floor((now - q.dataUpdatedAt) / 1000))}s
        </span>
        <button className={btnGhost} onClick={() => q.refetch()}>
          Atualizar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div className={`${card} p-4`} key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <p>Brasil · {d.now.total} treinando agora</p>
      {!d.now.total && <p>Nenhum atleta treinando agora</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown title="Estados" rows={d.states} total={d.now.total} />
        <Breakdown title="Cidades" rows={d.cities} total={d.now.total} />
      </div>
      <div className={`${card} p-4`}>
        <h3 className="font-bold">Últimos treinos</h3>
        {d.recent.map((s, i) => (
          <div key={i} className="mt-2 text-sm">
            {s.athlete} · {s.city} · {s.mode === "free" ? "Livre" : "Rota"} ·
            {" "}
            {s.status} · há{" "}
            {Math.max(0, Math.floor((now - Date.parse(s.started_at)) / 60000))}
            {" "}
            min
          </div>
        ))}
      </div>
    </div>
  );
}
