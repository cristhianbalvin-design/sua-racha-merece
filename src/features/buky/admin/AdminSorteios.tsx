import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, Dice5, Download, Gift, KeyRound, Plus, Save, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getCity, type City } from "../lib/api";
import { useStates } from "../lib/hooks";
import {
  addCodes,
  cancelPeriod,
  createPeriod,
  deleteCoupon,
  drawPeriod,
  generateCodes,
  listCodes,
  listCoupons,
  listPeriods,
  listResults,
  listSponsors,
  saveCoupon,
  setDelivery,
  updatePeriod,
  type Coupon,
  type Period,
  type RaffleResult,
} from "./adminApi";
import { AdminCityPicker, Badge, btnDanger, btnGhost, btnPrimary, card, downloadCsv, dt, Field, fromLocalInput, inputCls, toLocalInput } from "./ui";

const STATUS: Record<Period["status"], { label: string; tone: "muted" | "green" | "yellow" | "red" | "blue" }> = {
  scheduled: { label: "programado", tone: "blue" },
  open: { label: "aberto", tone: "green" },
  closed: { label: "encerrado · aguardando sorteio", tone: "yellow" },
  drawn: { label: "sorteado", tone: "muted" },
  cancelled: { label: "cancelado", tone: "red" },
};

const SCOPE = { city: "Cidade", state: "Estado", national: "Nacional" };

function nextMonday(): Date {
  const d = new Date();
  d.setUTCHours(3, 0, 0, 0); // 00:00 em São Paulo
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d;
}

export default function AdminSorteios() {
  const [periodId, setPeriodId] = useState<string | null>(null);
  const { data: periods = [], isLoading } = useQuery({ queryKey: ["admin-buky", "periods"], queryFn: listPeriods });
  const period = periods.find((p) => p.id === periodId);
  if (period) return <PeriodDetail period={period} onBack={() => setPeriodId(null)} />;
  return <PeriodList periods={periods} loading={isLoading} onOpen={setPeriodId} />;
}

function PeriodList({ periods, loading, onOpen }: { periods: Period[]; loading: boolean; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const start = nextMonday();
  const [f, setF] = useState({
    name: `Sorteio semanal ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}`,
    starts: toLocalInput(start.toISOString()),
    ends: toLocalInput(new Date(start.getTime() + 7 * 864e5).toISOString()),
    drawDelayMin: 60,
    cadence: "weekly" as Period["cadence"],
  });

  const create = async () => {
    try {
      const ends = fromLocalInput(f.ends);
      const id = await createPeriod({
        name: f.name.trim(),
        starts_at: fromLocalInput(f.starts),
        ends_at: ends,
        draw_at: new Date(new Date(ends).getTime() + f.drawDelayMin * 60_000).toISOString(),
        cadence: f.cadence,
      });
      toast.success("Período criado. Agora cadastre os cupons antes da abertura.");
      setCreating(false);
      await qc.invalidateQueries({ queryKey: ["admin-buky", "periods"] });
      onOpen(id);
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="max-w-2xl space-y-1 text-sm text-muted-foreground">
          <p>
            <b className="text-foreground">O que se sorteia são os cupons de cada período</b> (prêmios dos patrocinadores). O período só define
            quando abre, encerra e sorteia: depois de criá-lo, cadastre os cupons antes da abertura.
          </p>
          <p>
            O atleta envia todo o saldo ao período aberto; cada Buky é uma participação em todos os cupons da sua zona. O sorteio roda sozinho
            após o horário de sorteio, com ganhadores diferentes no mesmo período.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setCreating((v) => !v)}>
          <Plus size={14} /> NOVO PERÍODO
        </button>
      </div>

      {creating && (
        <div className={`${card} mb-4 grid gap-3 p-4 md:grid-cols-5`}>
          <Field label="Nome">
            <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Abre (horário de Brasília)">
            <input type="datetime-local" className={inputCls} value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} />
          </Field>
          <Field label="Encerra">
            <input type="datetime-local" className={inputCls} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} />
          </Field>
          <Field label="Sorteio (min após encerrar)">
            <input type="number" min={0} className={inputCls} value={f.drawDelayMin} onChange={(e) => setF({ ...f, drawDelayMin: Math.max(0, Number(e.target.value)) })} />
          </Field>
          <Field label="Repetição" hint="Ao encerrar, cria o próximo período sozinho">
            <select className={inputCls} value={f.cadence} onChange={(e) => setF({ ...f, cadence: e.target.value as Period["cadence"] })}>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="none">Não repetir</option>
            </select>
          </Field>
          <div className="md:col-span-5">
            <button type="button" className={btnPrimary} onClick={create}>
              <Save size={14} /> CRIAR PERÍODO
            </button>
          </div>
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : periods.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum período ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Prêmios (cupons)</th>
                <th className="px-4 py-3">Abre → encerra</th>
                <th className="px-4 py-3">Sorteio</th>
                <th className="px-4 py-3">Participação</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {periods.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onOpen(p.id)}>
                  <td className="px-4 py-3 font-bold">
                    {p.name}
                    <span className="block text-[11px] font-normal text-muted-foreground">{{ weekly: "semanal", monthly: "mensal", none: "único" }[p.cadence]}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.prizes.length === 0 ? (
                      p.status === "drawn" || p.status === "cancelled" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-yellow-400">
                          <AlertTriangle size={14} /> Sem prêmios · cadastrar cupons
                        </span>
                      )
                    ) : (
                      <span className="flex items-start gap-1.5">
                        <Gift size={14} className="mt-0.5 shrink-0 text-primary" />
                        <span>
                          {p.prizes.slice(0, 2).map((z) => `${z.title}${z.winners > 1 ? ` (×${z.winners})` : ""}`).join(" · ")}
                          {p.prizes.length > 2 && <span className="text-muted-foreground"> · +{p.prizes.length - 2}</span>}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{dt(p.starts_at)} → {dt(p.ends_at)}</td>
                  <td className="px-4 py-3">{dt(p.draw_at)}</td>
                  <td className="px-4 py-3">{p.athletes} atletas · {p.bukys} Bukys</td>
                  <td className="px-4 py-3"><Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PeriodDetail({ period, onBack }: { period: Period; onBack: () => void }) {
  const qc = useQueryClient();
  const editable = period.status === "scheduled";
  const { data: coupons = [] } = useQuery({ queryKey: ["admin-buky", "coupons", period.id], queryFn: () => listCoupons(period.id) });
  const { data: results = [] } = useQuery({ queryKey: ["admin-buky", "results", period.id], queryFn: () => listResults(period.id), enabled: period.status === "drawn" });
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-buky"] });
  const canDraw = (period.status === "open" || period.status === "closed") && new Date(period.ends_at) <= new Date();

  const draw = async () => {
    if (!confirm(`Sortear agora "${period.name}"? O resultado é definitivo.`)) return;
    setBusy(true);
    try {
      const r = await drawPeriod(period.id);
      toast.success(r.duplicate ? "Este período já estava sorteado." : `Sorteio feito: ${r.results} prêmios.`);
      await refresh();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const reason = prompt("Motivo do cancelamento (os Bukys enviados voltam para os atletas):");
    if (!reason || reason.trim().length < 3) return;
    try {
      const r = await cancelPeriod(period.id, reason);
      toast.success(r.changed ? `Período cancelado. ${r.bukys_refunded} Bukys devolvidos.` : "Já estava cancelado.");
      await refresh();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> PERÍODOS
      </button>
      <div className={`${card} mb-4 flex flex-wrap items-center gap-4 p-4`}>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold italic">{period.name}</h2>
          <p className="text-xs text-muted-foreground">
            {dt(period.starts_at)} → {dt(period.ends_at)} · sorteio {dt(period.draw_at)} · {period.athletes} atletas · {period.bukys} Bukys
          </p>
        </div>
        <Badge tone={STATUS[period.status].tone}>{STATUS[period.status].label}</Badge>
        {editable && <PeriodDates period={period} onSaved={refresh} />}
        {canDraw && (
          <button type="button" className={btnPrimary} onClick={draw} disabled={busy}>
            <Dice5 size={14} /> SORTEAR AGORA
          </button>
        )}
        {period.status !== "drawn" && period.status !== "cancelled" && (
          <button type="button" className={btnDanger} onClick={cancel}>
            <XCircle size={14} /> CANCELAR
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold italic">PRÊMIOS EM SORTEIO · CUPONS ({coupons.length})</h3>
        {editable && (
          <button type="button" className={btnPrimary} onClick={() => setEditing({ kind: "physical", scope: "city", winners_count: 1, draw_order: (coupons.length + 1) * 10, repeat_next: false })}>
            <Plus size={14} /> NOVO CUPOM
          </button>
        )}
      </div>
      {!editable && period.status !== "drawn" && (
        <p className="mb-3 text-xs text-muted-foreground">Com o período aberto só é possível corrigir textos e imagem dos cupons.</p>
      )}
      {coupons.length === 0 && period.status !== "drawn" && period.status !== "cancelled" && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-300" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Este período ainda não tem prêmios. {editable ? "Clique em NOVO CUPOM e cadastre ao menos um antes da abertura." : "Com o período já aberto não dá para adicionar cupons: cancele e crie outro, ou cadastre-os no próximo."}
          </span>
        </div>
      )}
      {coupons.some((c) => (c.codes_total ?? 0) < c.winners_count) && period.status !== "drawn" && period.status !== "cancelled" && (
        <p className="mb-3 flex items-center gap-2 text-xs text-yellow-300">
          <AlertTriangle size={14} /> Há cupons com menos códigos de resgate que ganhadores. Quem ganhar sem código recebe o prêmio sem código e a entrega fica manual.
        </p>
      )}
      {editing && <CouponForm periodId={period.id} initial={editing} editable={editable} onDone={() => { setEditing(null); void refresh(); }} />}

      <div className={`${card} mb-6 overflow-hidden`}>
        {coupons.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cupom. Sem cupons, o sorteio não terá prêmios.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Cupom</th>
                <th className="px-4 py-3">Tipo e alcance</th>
                <th className="px-4 py-3">Ganhadores</th>
                <th className="px-4 py-3">Códigos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-muted-foreground">{c.draw_order}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold">{c.title} {c.benefit && <span className="text-primary">· {c.benefit}</span>}</p>
                    <p className="text-[11px] text-muted-foreground">{c.sponsor_name}{c.repeat_next ? " · repete no próximo período" : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.kind === "physical" ? "Físico" : "Digital"} · {SCOPE[c.scope]}
                    {c.scope === "city" && c.city_name ? ` (${c.city_name})` : ""}
                  </td>
                  <td className="px-4 py-3">{c.winners_count}</td>
                  <td className="px-4 py-3">{c.codes_total ? `${c.codes_free} livres de ${c.codes_total}` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {period.status !== "drawn" && period.status !== "cancelled" && (
                        <>
                          <CodesButton coupon={c} onDone={refresh} />
                          <button type="button" className={btnGhost} onClick={() => setEditing(c)}>EDITAR</button>
                        </>
                      )}
                      {editable && (
                        <button
                          type="button"
                          className={btnDanger}
                          aria-label="Excluir cupom"
                          onClick={async () => {
                            if (!confirm(`Excluir o cupom "${c.title}"?`)) return;
                            await deleteCoupon(c.id).catch((e) => toast.error(String(e.message)));
                            void refresh();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {period.status === "drawn" && <Results period={period} results={results} onChange={refresh} />}
    </div>
  );
}

function PeriodDates({ period, onSaved }: { period: Period; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ starts: toLocalInput(period.starts_at), ends: toLocalInput(period.ends_at), draw: toLocalInput(period.draw_at) });
  if (!open) return <button type="button" className={btnGhost} onClick={() => setOpen(true)}>EDITAR DATAS</button>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <input type="datetime-local" className={inputCls + " w-auto"} value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} aria-label="Abre" />
      <input type="datetime-local" className={inputCls + " w-auto"} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} aria-label="Encerra" />
      <input type="datetime-local" className={inputCls + " w-auto"} value={f.draw} onChange={(e) => setF({ ...f, draw: e.target.value })} aria-label="Sorteio" />
      <button
        type="button"
        className={btnPrimary}
        onClick={async () => {
          try {
            await updatePeriod(period.id, { starts_at: fromLocalInput(f.starts), ends_at: fromLocalInput(f.ends), draw_at: fromLocalInput(f.draw) });
            setOpen(false);
            onSaved();
          } catch (e) {
            toast.error(`Erro: ${(e as Error).message}`);
          }
        }}
      >
        <Save size={14} />
      </button>
    </div>
  );
}

function CouponForm({ periodId, initial, editable, onDone }: { periodId: string; initial: Partial<Coupon>; editable: boolean; onDone: () => void }) {
  const { data: sponsors = [] } = useQuery({ queryKey: ["admin-buky", "sponsors"], queryFn: listSponsors });
  const { data: states = [] } = useStates();
  const [c, setC] = useState<Partial<Coupon>>(initial);
  const [city, setCity] = useState<City | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (initial.city_code) void getCity(initial.city_code).then(setCity);
  }, [initial.city_code]);
  const set = (patch: Partial<Coupon>) => setC((x) => ({ ...x, ...patch }));
  const rulesLocked = !editable;

  const save = async () => {
    if (!c.sponsor_id) return toast.error("Escolha o patrocinador.");
    if (!c.title || c.title.trim().length < 3) return toast.error("Informe o título do cupom.");
    if (c.scope === "city" && !city) return toast.error("Escolha a cidade do cupom.");
    if (c.scope === "state" && !c.state_code) return toast.error("Escolha o estado do cupom.");
    setSaving(true);
    try {
      await saveCoupon({
        id: c.id,
        period_id: periodId,
        sponsor_id: c.sponsor_id,
        title: c.title.trim(),
        description: c.description ?? null,
        benefit: c.benefit ?? null,
        image_url: c.image_url ?? null,
        kind: c.kind ?? "physical",
        scope: c.kind === "physical" ? "city" : c.scope ?? "national",
        city_code: city?.code ?? null,
        state_code: c.scope === "state" ? c.state_code ?? null : city?.state_code ?? null,
        winners_count: c.winners_count ?? 1,
        draw_order: c.draw_order ?? 100,
        redeem_instructions: c.redeem_instructions ?? null,
        valid_until: c.valid_until || null,
        repeat_next: Boolean(c.repeat_next),
      });
      toast.success("Cupom salvo.");
      onDone();
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg.includes("period_not_editable") ? "O período já abriu: só textos e imagem podem mudar." : `Erro: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${card} mb-4 grid gap-3 p-4 md:grid-cols-4`}>
      <Field label="Patrocinador">
        <select className={inputCls} value={c.sponsor_id ?? ""} onChange={(e) => set({ sponsor_id: e.target.value })} disabled={rulesLocked}>
          <option value="">—</option>
          {sponsors.filter((s) => s.active || s.id === c.sponsor_id).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Título">
        <input className={inputCls} value={c.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Avaliação gratuita" />
      </Field>
      <Field label="Benefício (aparece grande)">
        <input className={inputCls} value={c.benefit ?? ""} onChange={(e) => set({ benefit: e.target.value })} placeholder="50%" />
      </Field>
      <Field label="Tipo">
        <select className={inputCls} value={c.kind} disabled={rulesLocked} onChange={(e) => set({ kind: e.target.value as Coupon["kind"], scope: e.target.value === "physical" ? "city" : c.scope })}>
          <option value="physical">Físico (só atletas de uma cidade)</option>
          <option value="digital">Digital</option>
        </select>
      </Field>
      {c.kind === "digital" && (
        <Field label="Alcance">
          <select className={inputCls} value={c.scope} disabled={rulesLocked} onChange={(e) => set({ scope: e.target.value as Coupon["scope"] })}>
            <option value="national">Nacional</option>
            <option value="state">Estado</option>
            <option value="city">Cidade</option>
          </select>
        </Field>
      )}
      {(c.kind === "physical" || c.scope === "city") && (
        <Field label="Cidade">
          {rulesLocked ? <input className={inputCls} disabled value={city?.name ?? ""} /> : <AdminCityPicker value={city} onChange={setCity} />}
        </Field>
      )}
      {c.kind === "digital" && c.scope === "state" && (
        <Field label="Estado">
          <select className={inputCls} value={c.state_code ?? ""} disabled={rulesLocked} onChange={(e) => set({ state_code: Number(e.target.value) || null })}>
            <option value="">—</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>{s.uf} · {s.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Ganhadores">
        <input type="number" min={1} max={50} className={inputCls} disabled={rulesLocked} value={c.winners_count ?? 1} onChange={(e) => set({ winners_count: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
      </Field>
      <Field label="Ordem no sorteio" hint="Menor sorteia primeiro">
        <input type="number" className={inputCls} disabled={rulesLocked} value={c.draw_order ?? 100} onChange={(e) => set({ draw_order: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Válido até">
        <input type="date" className={inputCls} value={c.valid_until ?? ""} onChange={(e) => set({ valid_until: e.target.value || null })} />
      </Field>
      <Field label="Imagem (URL)">
        <input className={inputCls} value={c.image_url ?? ""} onChange={(e) => set({ image_url: e.target.value })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Como resgatar (o ganhador vê na Bolsa)">
          <textarea className={inputCls} rows={2} value={c.redeem_instructions ?? ""} onChange={(e) => set({ redeem_instructions: e.target.value })} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Descrição">
          <textarea className={inputCls} rows={2} value={c.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-4">
        <input type="checkbox" checked={Boolean(c.repeat_next)} disabled={rulesLocked} onChange={(e) => set({ repeat_next: e.target.checked })} /> Repetir este cupom no próximo período automático
      </label>
      <div className="flex gap-2 md:col-span-4">
        <button type="button" className={btnPrimary} onClick={save} disabled={saving}><Save size={14} /> SALVAR CUPOM</button>
        <button type="button" className={btnGhost} onClick={onDone}>CANCELAR</button>
      </div>
    </div>
  );
}

function CodesButton({ coupon, onDone }: { coupon: Coupon; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [n, setN] = useState(Math.max(1, coupon.winners_count - (coupon.codes_total ?? 0)));
  const [prefix, setPrefix] = useState((coupon.sponsor_name ?? "3BUK").slice(0, 4));
  const { data: codes = [], refetch } = useQuery({ queryKey: ["admin-buky", "codes", coupon.id], queryFn: () => listCodes(coupon.id), enabled: open });

  const save = async (value: string) => {
    try {
      const added = await addCodes(coupon.id, value);
      toast.success(`${added} códigos adicionados.`);
      setText("");
      await refetch();
      onDone();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  if (!open)
    return (
      <button type="button" className={btnGhost} onClick={() => setOpen(true)} title="Códigos de resgate">
        <KeyRound size={14} />
      </button>
    );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div className={`${card} max-h-[90vh] w-full max-w-lg overflow-auto p-4`} onClick={(e) => e.stopPropagation()}>
        <h4 className="font-bold italic">CÓDIGOS DE RESGATE · {coupon.title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada ganhador recebe um código único, que o patrocinador valida na loja ou no site. Use os códigos que o patrocinador já tem, ou gere
          aqui e envie a lista para ele. {codes.length} cadastrados · {codes.filter((c) => !c.assigned).length} livres · {coupon.winners_count} ganhador(es).
        </p>

        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="text-xs font-bold">GERAR CÓDIGOS ÚNICOS</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label="Prefixo">
              <input className={inputCls.replace("w-full", "") + " w-28 uppercase"} value={prefix} maxLength={6} onChange={(e) => setPrefix(e.target.value)} />
            </Field>
            <Field label="Quantidade">
              <input type="number" min={1} max={500} className={inputCls.replace("w-full", "") + " w-24"} value={n} onChange={(e) => setN(Math.min(500, Math.max(1, Number(e.target.value))))} />
            </Field>
            <button type="button" className={btnPrimary} onClick={() => void save(generateCodes(n, prefix).join("\n"))}>
              <KeyRound size={14} /> GERAR
            </button>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-bold">OU COLAR OS CÓDIGOS DO PATROCINADOR</p>
          <textarea className={`${inputCls} mt-2 font-mono`} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Um por linha\nNIT-0001\nNIT-0002"} />
          <button type="button" className={`${btnPrimary} mt-2`} disabled={!text.trim()} onClick={() => void save(text)}>
            <Save size={14} /> ADICIONAR
          </button>
        </div>

        {codes.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">CADASTRADOS</p>
              <button
                type="button"
                className={btnGhost}
                onClick={() => downloadCsv(`codigos-${coupon.title.replace(/\W+/g, "-")}.csv`, [["Código", "Atribuído"], ...codes.map((c) => [c.code, c.assigned ? "sim" : "não"])])}
              >
                <Download size={14} /> CSV
              </button>
            </div>
            <ul className="mt-2 grid max-h-40 grid-cols-2 gap-1 overflow-auto font-mono text-xs">
              {codes.map((c) => (
                <li key={c.code} className={c.assigned ? "text-muted-foreground line-through" : ""}>{c.code}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" className={`${btnGhost} mt-4`} onClick={() => setOpen(false)}>FECHAR</button>
      </div>
    </div>
  );
}

function Results({ period, results, onChange }: { period: Period; results: RaffleResult[]; onChange: () => void }) {
  const [audit, setAudit] = useState<RaffleResult | null>(null);
  const exportCsv = () =>
    downloadCsv(`sorteio-${period.name.replace(/\W+/g, "-")}.csv`, [
      ["Cupom", "Patrocinador", "Posição", "Ganhador", "E-mail", "Instagram", "Telefone", "Ticket", "Código", "Número sorteado", "Total de participações", "Candidatos", "SHA-256", "Entrega"],
      ...results.map((r) => [r.coupon_title, r.sponsor_name, r.rank, r.user_name, r.user_email, r.user_instagram, r.user_phone, r.winning_ticket, r.redeem_code, r.winning_number, r.total_weight, r.candidates.length, r.candidates_sha256, r.delivery_status]),
    ]);
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold italic">RESULTADO</h3>
        <button type="button" className={btnGhost} onClick={exportCsv}><Download size={14} /> CSV</button>
      </div>
      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Cupom</th>
              <th className="px-4 py-3">Ganhador</th>
              <th className="px-4 py-3">Ticket · código</th>
              <th className="px-4 py-3">Entrega</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {results.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <p className="font-bold">{r.coupon_title}{r.rank > 1 ? ` · ${r.rank}º` : ""}</p>
                  <p className="text-[11px] text-muted-foreground">{r.sponsor_name}</p>
                </td>
                <td className="px-4 py-3">
                  {r.user_id ? (
                    <>
                      <p className="font-bold">{r.user_name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{[r.user_instagram && `@${r.user_instagram}`, r.user_email, r.user_phone].filter(Boolean).join(" · ")}</p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">sem participantes elegíveis</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.winning_ticket ?? "—"}{r.redeem_code ? ` · ${r.redeem_code}` : ""}</td>
                <td className="px-4 py-3">
                  {r.user_id && (
                    <select
                      className={inputCls + " w-36"}
                      value={r.delivery_status}
                      onChange={async (e) => {
                        await setDelivery(r.id, e.target.value as RaffleResult["delivery_status"], r.delivery_note).catch((err) => toast.error(String(err.message)));
                        onChange();
                      }}
                    >
                      <option value="pending">pendente</option>
                      <option value="notified">avisado</option>
                      <option value="delivered">entregue</option>
                      <option value="unclaimed">não resgatado</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className={btnGhost} onClick={() => setAudit(r)} title="Auditoria"><ShieldCheck size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {audit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAudit(null)}>
          <div className={`${card} max-h-[80vh] w-full max-w-lg overflow-auto p-4 text-sm`} onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold italic">AUDITORIA · {audit.coupon_title}</h4>
            <dl className="mt-3 space-y-1 text-xs">
              <div><dt className="inline text-muted-foreground">Sorteado em: </dt><dd className="inline">{dt(audit.drawn_at)}</dd></div>
              <div><dt className="inline text-muted-foreground">Participações elegíveis: </dt><dd className="inline">{audit.total_weight} ({audit.candidates.length} atletas)</dd></div>
              <div><dt className="inline text-muted-foreground">Número sorteado: </dt><dd className="inline">{audit.winning_number ?? "—"} (entre 0 e {Math.max(0, audit.total_weight - 1)})</dd></div>
              <div><dt className="inline text-muted-foreground">SHA-256 da lista: </dt><dd className="inline break-all font-mono">{audit.candidates_sha256}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Método: número aleatório criptográfico; a lista é percorrida na ordem abaixo somando as participações, e ganha quem fizer a soma passar do número sorteado.
              Quem já ganhou outro cupom do período fica fora da lista.
            </p>
            <ol className="mt-3 space-y-0.5 font-mono text-[11px]">
              {audit.candidates.map((c) => (
                <li key={c.user_id} className={c.user_id === audit.user_id ? "text-primary" : ""}>
                  {c.user_id.slice(0, 8)} · {c.weight}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
