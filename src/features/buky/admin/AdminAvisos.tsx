import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { btnPrimary, card } from "./ui";

type NoticeType = {
  kind: string;
  label: string;
  description: string;
  audience: string;
  legacy: boolean;
  implemented: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
};
type Counts = { kind: string; status: string; total: number };
type ChannelFlag = "in_app_enabled" | "email_enabled" | "push_enabled";
const PAGE_SIZE = 50;

export default function AdminAvisos() {
  const [tab, setTab] = useState("catalogo");
  const [kind, setKind] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [changingKind, setChangingKind] = useState<string | null>(null);
  const qc = useQueryClient();

  const catalog = useQuery({
    queryKey: ["notification-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_types").select("*").order("label");
      if (error) throw error;
      return data as NoticeType[];
    },
  });
  const counts = useQuery({
    queryKey: ["notification-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_notification_counts");
      if (error) throw error;
      return data as Counts[];
    },
  });
  const outbox = useQuery({
    queryKey: ["admin-outbox", kind, channel, status, page],
    queryFn: async () => {
      let request = supabase.from("notification_outbox")
        .select("id,kind,channel,status,attempts,last_error,created_at")
        .order("created_at", { ascending: false });
      if (kind) request = request.eq("kind", kind);
      if (channel) request = request.eq("channel", channel);
      if (status) request = request.eq("status", status);
      const { data, error } = await request.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return data;
    },
  });

  async function toggle(item: NoticeType, field: ChannelFlag) {
    if (changingKind) return;
    if (item[field] && !window.confirm(`Desativar este canal para ${item.label}?`)) return;
    const next = { ...item, [field]: !item[field] };
    if (item.kind === "buky_raffle_won" &&
        !next.in_app_enabled && !next.email_enabled && !next.push_enabled &&
        !window.confirm("Todos os canais de prêmio ganho serão desativados. Confirmar?")) return;
    setChangingKind(item.kind);
    try {
      const { error } = await supabase.rpc("admin_set_notification_type", {
        p_kind: item.kind,
        p_in_app: next.in_app_enabled,
        p_email: next.email_enabled,
        p_push: next.push_enabled,
      });
      if (error) throw error;
      toast.success("Aviso atualizado.");
      await qc.invalidateQueries({ queryKey: ["notification-types"] });
    } catch (error) {
      toast.error(`Erro: ${(error as Error).message}`);
    } finally {
      setChangingKind(null);
    }
  }

  async function test(push: boolean) {
    setBusy(true);
    try {
      const result = push
        ? await supabase.rpc("admin_test_push")
        : await supabase.functions.invoke("send-notifications", { body: { test: true } });
      if (result.error) throw result.error;
      toast.success(push ? "Push de teste colocado na fila." : "E-mail de teste enviado.");
    } catch (error) {
      toast.error(`Erro: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const count = (noticeKind: string, deliveryStatus: string) =>
    counts.data?.find((row) => row.kind === noticeKind && row.status === deliveryStatus)?.total ?? 0;

  return <section className={`${card} p-4`}>
    <h2 className="font-bold">Avisos</h2>
    <nav className="my-4 flex flex-wrap gap-4">
      {[["catalogo", "Avisos ativos"], ["envios", "Envios recentes"], ["teste", "Teste"]].map(([id, label]) =>
        <button key={id} className={tab === id ? "font-bold underline" : "underline"} onClick={() => setTab(id)}>{label}</button>)}
    </nav>

    {tab === "catalogo" && (catalog.error || counts.error
      ? <p>Não foi possível carregar o catálogo.</p>
      : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>
            <th>Tipo</th><th>Destinatário</th><th>App</th><th>E-mail</th><th>Push</th>
            <th>7 dias: enviados / falhos / omitidos</th>
          </tr></thead>
          <tbody>{catalog.data?.map((item) =>
            <tr className="border-t" key={item.kind}>
              <td className="py-2">
                <b>{item.label}</b> {item.legacy && <span>Legado</span>}
                {!item.implemented && <span>Não implementado</span>}
                <p>{item.description}</p>
              </td>
              <td>{({ athlete: "Atleta", admin: "Admin", sponsor: "Patrocinador" } as Record<string, string>)[item.audience]}</td>
              {(["in_app_enabled", "email_enabled", "push_enabled"] as const).map((field) =>
                <td key={field}><input
                  aria-label={`${field} ${item.label}`}
                  type="checkbox"
                  disabled={changingKind !== null}
                  checked={item[field]}
                  onChange={() => void toggle(item, field)}
                /></td>)}
              <td>{count(item.kind, "sent")} / {count(item.kind, "failed")} / {count(item.kind, "skipped")}</td>
            </tr>)}</tbody>
        </table></div>)}

    {tab === "envios" && <>
      <div className="my-3 flex flex-wrap gap-3">
        <select aria-label="Tipo" value={kind} onChange={(event) => { setKind(event.target.value); setPage(0); }}>
          <option value="">Todos os tipos</option>
          {catalog.data?.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
        </select>
        <select aria-label="Canal" value={channel} onChange={(event) => { setChannel(event.target.value); setPage(0); }}>
          <option value="">Todos os canais</option><option value="email">E-mail</option><option value="push">Push</option>
        </select>
        <select aria-label="Estado" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
          <option value="">Todos os estados</option>
          {["pending", "sent", "failed", "skipped"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      {outbox.error ? <p>Não foi possível carregar a fila.</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr><th>Data</th><th>Tipo</th><th>Canal</th><th>Estado</th><th>Tentativas</th><th>Erro</th></tr></thead>
          <tbody>{outbox.data?.map((row) => <tr className="border-t" key={row.id}>
            <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
            <td>{row.kind}</td><td>{row.channel}</td><td>{row.status}</td>
            <td>{row.attempts}</td><td>{row.last_error}</td>
          </tr>)}</tbody>
        </table></div>}
      <div className="mt-4 flex gap-4">
        <button disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page + 1}</span>
        <button disabled={(outbox.data?.length ?? 0) < PAGE_SIZE} onClick={() => setPage(page + 1)}>Próxima</button>
      </div>
    </>}

    {tab === "teste" && <div className="flex gap-3">
      <button disabled={busy} className={btnPrimary} onClick={() => void test(false)}>Enviar e-mail de teste</button>
      <button disabled={busy} className={btnPrimary} onClick={() => void test(true)}>Enviar push de teste para meu usuário</button>
    </div>}
  </section>;
}
