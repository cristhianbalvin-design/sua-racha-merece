import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useAvisos, groupAvisos, avisoLabel } from "../lib/avisosApi";
import { avisos } from "../i18n";
import { toast } from "sonner";
export default function Avisos() {
  const { user } = useAuth();
  const [limit, setLimit] = useState(50);
  const query = useAvisos(limit);
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function mark(id?: string) {
    if (!user) return false;
    let req = supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id);
    req = id ? req.eq("id", id) : req.eq("read", false);
    const { error } = await req;
    if (error) {
      toast.error("Não foi possível marcar como lido.");
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["buky-avisos", user.id] });
    return true;
  }
  return (
    <main className="px-6 pt-[calc(env(safe-area-inset-top,0px)+30px)]">
      <Link to="/app" className="text-sm text-[var(--buky-muted)]">
        ← Voltar
      </Link>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="font-buky text-3xl">{avisos.titulo}</h1>
        <button
          onClick={() => void mark()}
          className="text-sm text-[var(--buky-neon)]"
        >
          {avisos.marcarTodos}
        </button>
      </div>
      <p className="mt-3 text-sm text-[var(--buky-muted)]">Aqui você vê os avisos de prêmios, Premium e saldo.</p>
      {query.isLoading ? (
        <p>Carregando…</p>
      ) : query.error ? (
        <p>{avisos.erro}</p>
      ) : !query.data?.length ? (
        <p className="mt-6">{avisos.vazios}</p>
      ) : (
        <div className="mt-4">
          {Object.entries(groupAvisos(query.data)).map(([date, notices]) => (
          <section key={date}><h2 className="mt-4 font-bold">{date}</h2><ul>
          {notices.map((n) => (
            <li key={n.id} className="border-b border-[var(--buky-line)]">
              <button
                className="w-full py-4 text-left"
                onClick={async () => {
                  await mark(n.id);
                  if (
                    [
                      "buky_raffle_won",
                      "buky_raffle_substitute",
                      "buky_prize_redeemed",
                    ].includes(n.type)
                  )
                    navigate("/app/bolsa/sorteios?aba=resultados");
                }}
              >
                <span className="block text-xs text-[var(--buky-muted)]">{avisoLabel(n.type)}</span>
                <b>
                  {!n.read && "• "}
                  {n.title}
                </b>
                <p className="mt-1 text-sm text-[var(--buky-muted)]">
                  {n.message}
                </p>
                <time className="text-xs text-[var(--buky-faint)]">
                  {new Date(n.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </time>
              </button>
            </li>
          ))}
          </ul></section>))}
          {query.data.length === limit && <button className="my-4 underline" onClick={() => setLimit(limit + 50)}>Ver anteriores</button>}
        </div>
      )}
    </main>
  );
}
