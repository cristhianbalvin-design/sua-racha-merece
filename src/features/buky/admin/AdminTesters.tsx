import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addRouteTester, listRouteTesters, removeRouteTester, searchAthletes } from "./adminApi";
import { btnGhost, btnPrimary, dt, inputCls } from "./ui";

/**
 * Testadores de rotas (paso 19): pueden crear rutas propias en cualquier lugar (p. ej. en Perú),
 * sin el límite de distancia al centro de su ciudad. Los admins ya lo son.
 */
export default function AdminTesters() {
  const qc = useQueryClient();
  const { data: testers = [], isLoading } = useQuery({ queryKey: ["admin-buky", "testers"], queryFn: listRouteTesters });
  const [q, setQ] = useState("");
  const { data: hits = [] } = useQuery({ queryKey: ["admin-buky", "athletes", q], queryFn: () => searchAthletes(q), enabled: q.trim().length >= 2 });
  const ids = new Set(testers.map((t) => t.user_id));
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-buky", "testers"] });

  const add = async (id: string) => {
    try {
      await addRouteTester(id, "Teste de rotas");
      toast.success("Testador adicionado.");
      setQ("");
      await refresh();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };
  const remove = async (id: string) => {
    try {
      await removeRouteTester(id);
      toast.success("Testador removido.");
      await refresh();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        Testadores podem criar rotas próprias em qualquer lugar (por exemplo, fora do Brasil), sem o limite de distância ao centro da cidade.
        As demais regras continuam valendo. Administradores já são testadores.
      </p>
      <div className="relative">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar atleta por nome, e-mail ou Instagram…" />
        {hits.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-xl">
            {hits.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <b>{h.name ?? "—"}</b> <span className="text-muted-foreground">{h.email}</span>
                </span>
                <button type="button" className={btnPrimary} disabled={ids.has(h.id)} onClick={() => void add(h.id)}>
                  <Plus size={14} /> {ids.has(h.id) ? "Já é" : "Adicionar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : testers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum testador.</p>
      ) : (
        <ul className="divide-y divide-border">
          {testers.map((t) => (
            <li key={t.user_id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <b>{t.name ?? "—"}</b> <span className="text-muted-foreground">{t.email}</span>
                <span className="block text-[11px] text-muted-foreground">desde {dt(t.added_at)}</span>
              </span>
              <button type="button" className={btnGhost} onClick={() => void remove(t.user_id)} aria-label="Remover testador">
                <Trash2 size={14} /> Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
