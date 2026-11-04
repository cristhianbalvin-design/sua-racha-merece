import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, Gift, Search } from "lucide-react";
import { toast } from "sonner";
import { pt } from "../i18n";
import { giftBukys, invalidateSession, listSessions, searchAthletes, sessionPasses, type AdminSession, type AthleteHit } from "./adminApi";
import { Badge, btnDanger, btnGhost, btnPrimary, card, downloadCsv, dt, Field, inputCls } from "./ui";

const REASON: Record<string, string> = {
  vehicle: "veículo (velocidade alta sustentada)",
  mock_location: "localização simulada",
  no_readings: "sem sinal de GPS",
};

export default function AdminTreinos() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState(7);
  const [open, setOpen] = useState<string | null>(null);
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["admin-buky", "sessions", status, days],
    queryFn: () => listSessions({ status, since }),
  });

  const invalidate = async (s: AdminSession) => {
    const reason = prompt(`Motivo para anular o treino de ${s.user_name ?? "atleta"} (${s.bukys_awarded} Bukys):`);
    if (!reason || reason.trim().length < 3) return;
    try {
      const r = await invalidateSession(s.id, reason.trim());
      toast.success(r.changed ? `Treino anulado. ${r.bukys_removed} Bukys descontados${r.bukys_not_recovered ? ` (${r.bukys_not_recovered} já tinham ido ao sorteio)` : ""}.` : "Nada a mudar.");
      await qc.invalidateQueries({ queryKey: ["admin-buky"] });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <GiftBox />

      <div>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="Estado">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos</option>
              <option value="valid">Validados</option>
              <option value="invalid">Não validados</option>
              <option value="running">Em andamento</option>
              <option value="abandoned">Abandonados</option>
            </select>
          </Field>
          <Field label="Período">
            <select className={inputCls} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>Últimas 24 h</option>
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </Field>
          <button
            type="button"
            className={`${btnGhost} ml-auto`}
            onClick={() =>
              downloadCsv("treinos-buky.csv", [
                ["Início", "Atleta", "E-mail", "Rota", "Cidade", "Estado", "Motivo", "Distância (m)", "Duração (s)", "Vel. máx (km/h)", "Vel. média (km/h)", "Passagens válidas", "Rejeitadas", "Bukys"],
                ...sessions.map((s) => [s.started_at, s.user_name, s.user_email, s.route_name, s.city_name, s.status, s.invalid_reason, s.distance_m, s.duration_s, s.max_speed_kmh, s.avg_speed_kmh, s.passes_valid, s.passes_rejected, s.bukys_awarded]),
              ])
            }
          >
            <Download size={14} /> CSV
          </button>
        </div>
        <div className={`${card} overflow-x-auto`}>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum treino no período.</p>
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Atleta</th>
                  <th className="px-4 py-3">Rota</th>
                  <th className="px-4 py-3">Distância · vel. máx</th>
                  <th className="px-4 py-3">Passagens</th>
                  <th className="px-4 py-3">Bukys</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="cursor-pointer hover:bg-muted/30" onClick={() => setOpen(open === s.id ? null : s.id)}>
                      <td className="px-4 py-3">
                        <p className="font-bold">{s.user_name ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">{dt(s.started_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {s.route_name}
                        <p className="text-[11px] text-muted-foreground">{s.city_name}{s.route_kind === "athlete" ? " · rota própria" : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        {s.distance_m != null ? `${(s.distance_m / 1000).toFixed(2)} km` : "—"} · {s.max_speed_kmh ?? "—"} km/h
                      </td>
                      <td className="px-4 py-3">{s.passes_valid} <span className="text-muted-foreground">/ {s.passes_rejected} rej.</span></td>
                      <td className="px-4 py-3 font-bold text-primary">{s.bukys_awarded}</td>
                      <td className="px-4 py-3">
                        {s.status === "valid" ? <Badge tone="green">validado</Badge> : s.status === "invalid" ? <Badge tone="red">não validado</Badge> : <Badge>{s.status}</Badge>}
                        {s.invalid_reason && <p className="mt-1 text-[11px] text-muted-foreground">{REASON[s.invalid_reason] ?? s.invalid_reason}</p>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.status === "valid" && (
                          <button
                            type="button"
                            className={btnDanger}
                            onClick={(e) => {
                              e.stopPropagation();
                              void invalidate(s);
                            }}
                          >
                            <Ban size={14} /> ANULAR
                          </button>
                        )}
                      </td>
                    </tr>
                    {open === s.id && (
                      <tr>
                        <td colSpan={7} className="bg-muted/20 px-4 py-3">
                          <Passes sessionId={s.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Passes({ sessionId }: { sessionId: string }) {
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-buky", "passes", sessionId], queryFn: () => sessionPasses(sessionId) });
  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando passagens…</p>;
  if (!data.length) return <p className="text-xs text-muted-foreground">Sem passagens registradas.</p>;
  return (
    <ul className="grid gap-1 text-xs md:grid-cols-2">
      {data.map((p, i) => {
        const pt0 = Array.isArray(p.buky_points) ? p.buky_points[0] : p.buky_points;
        return (
          <li key={i} className="flex justify-between gap-3">
            <span>
              {pt0?.label ?? "ponto"} · {dt(p.passed_at)} · {p.speed_kmh ?? "—"} km/h · ±{p.accuracy_m ?? "—"} m
            </span>
            <span className={p.awarded ? "text-primary" : "text-muted-foreground"}>
              {p.awarded ? "+1" : pt.resumo.rejeicoes[p.reject_reason ?? ""] ?? p.reject_reason ?? "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function GiftBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AthleteHit[]>([]);
  const [who, setWho] = useState<AthleteHit | null>(null);
  const [amount, setAmount] = useState(5);
  const [note, setNote] = useState("");
  const search = async () => setHits(await searchAthletes(q).catch(() => []));
  const give = async () => {
    if (!who) return;
    if (note.trim().length < 3) return toast.error("Explique o motivo do presente.");
    try {
      const r = await giftBukys(who.id, amount, note.trim());
      toast.success(`${amount} Bukys para ${who.name ?? who.email}. Novo saldo: ${r.balance}.`);
      setWho(null);
      setNote("");
      setHits([]);
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };
  return (
    <div className={`${card} p-4`}>
      <h3 className="mb-3 flex items-center gap-2 font-bold italic"><Gift size={16} className="text-primary" /> PRESENTEAR BUKYS</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Field label="Atleta (nome, e-mail ou Instagram)">
            <div className="flex gap-2">
              <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
              <button type="button" className={btnGhost} onClick={search} aria-label="Buscar"><Search size={14} /></button>
            </div>
          </Field>
        </div>
        {who && (
          <>
            <Field label="Quantidade">
              <input type="number" min={1} max={1000} className={inputCls + " w-24"} value={amount} onChange={(e) => setAmount(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} />
            </Field>
            <div className="min-w-[240px] flex-1">
              <Field label="Motivo (fica registrado)">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Prêmio de boas-vindas" />
              </Field>
            </div>
            <button type="button" className={btnPrimary} onClick={give}><Gift size={14} /> PRESENTEAR</button>
          </>
        )}
      </div>
      {hits.length > 0 && !who && (
        <ul className="mt-3 divide-y divide-border rounded-lg bg-muted/30 text-sm">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" className="flex w-full justify-between px-3 py-2 text-left hover:bg-muted" onClick={() => setWho(h)}>
                <span>
                  <b>{h.name ?? "—"}</b> <span className="text-muted-foreground">{h.email}{h.instagram ? ` · @${h.instagram}` : ""}{h.city ? ` · ${h.city}` : ""}</span>
                </span>
                <span className="text-primary">{h.balance} Bukys</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {who && <p className="mt-2 text-xs text-muted-foreground">Para: <b className="text-foreground">{who.name ?? who.email}</b> (saldo {who.balance}) · <button type="button" className="underline" onClick={() => setWho(null)}>trocar</button></p>}
    </div>
  );
}
