import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { btnPrimary, card } from "./ui";
export default function AdminAvisos() {
  const [busy, setBusy] = useState(false);
  const outbox = useQuery({ queryKey: ["admin-outbox"], queryFn: async () => { const { data, error } = await supabase.from("notification_outbox").select("id,kind,channel,status,attempts,last_error,created_at,to_email").order("created_at", { ascending: false }).limit(50); if (error) throw error; return data; } });
  async function test() { setBusy(true); try { const { data, error } = await supabase.functions.invoke("send-notifications", { body: { test: true } }); if (error) throw error; toast.success(`E-mail de teste enviado${data?.id ? `: ${data.id}` : ""}.`); } catch (e) { toast.error(`Erro: ${(e as Error).message}`); } finally { setBusy(false); } }
  return <section className={`${card} p-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Avisos</h2><button disabled={busy} className={btnPrimary} onClick={() => void test()}>Enviar e-mail de teste</button></div><button className="my-3 text-sm underline" onClick={() => void outbox.refetch()}>Atualizar</button>{outbox.error ? <p>N?o foi poss?vel carregar a fila.</p> : outbox.isLoading ? <p>Carregando?</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Data</th><th>Tipo</th><th>Canal</th><th>Estado</th><th>Tentativas</th><th>Erro</th></tr></thead><tbody>{outbox.data?.map(r => <tr className="border-t" key={r.id}><td>{new Date(r.created_at).toLocaleString("pt-BR")}</td><td>{r.kind}</td><td>{r.channel}</td><td>{r.status}</td><td>{r.attempts}</td><td>{r.last_error}</td></tr>)}</tbody></table></div>}</section>;
}
