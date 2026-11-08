import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Crown, Image as ImageIcon, Wallet } from "lucide-react";
import { toast } from "sonner";
import { pt } from "../i18n";
import { ErrorBox, fmtDate, Spinner } from "../components/ui";
import { apiGetDownloadStatus } from "@/lib/libraryApi";
import { apiCreateCheckout, apiGetMyWallet, apiSyncPayments, brl, formatCents, walletReasonLabel } from "@/lib/walletApi";

const W = pt.saldo;

/**
 * Meu saldo en la app (paso 27): saldo en R$, fotos grátis del año, recargas (R$20/30/50) y Premium
 * (R$50, siempre con dinero nuevo). Los pagos abren Mercado Pago y vuelven a /app/perfil/saldo.
 */
export default function Saldo() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet });
  const photos = useQuery({ queryKey: ["photo-status"], queryFn: apiGetDownloadStatus });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["wallet"] });
    void qc.invalidateQueries({ queryKey: ["photo-status"] });
  };

  // Respaldo del webhook y retorno de Mercado Pago (?pagamento=success|pending|failure)
  useEffect(() => {
    void apiSyncPayments()
      .then((r) => r.applied && (toast.success(W.confirmado), refresh()))
      .catch(() => {});
    const r = params.get("pagamento");
    if (!r) return;
    if (r === "success") toast.success(W.recebido);
    else if (r === "pending") toast(W.pendente);
    else toast.error(W.falhou);
    setParams({}, { replace: true });
    if (r === "failure") return;
    const again = () => apiSyncPayments().catch(() => null).then(refresh);
    const t1 = setTimeout(again, 3000);
    const t2 = setTimeout(again, 10000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async (key: string, input: Parameters<typeof apiCreateCheckout>[0]) => {
    if (busy) return;
    setBusy(key);
    try {
      window.location.assign(await apiCreateCheckout({ ...input, returnTo: "app" }));
    } catch {
      toast.error(W.erroPagamento);
      setBusy(null);
    }
  };

  if (wallet.isLoading) return <Spinner label={pt.comum.carregando} />;
  if (wallet.isError || !wallet.data) return <ErrorBox message={pt.comum.erro} onRetry={() => wallet.refetch()} />;
  const w = wallet.data;
  const s = photos.data;
  const premium = w.premium;

  return (
    <div className="px-6 pb-6 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
      <Link to="/app/perfil" aria-label={pt.comum.voltar} className="-ml-1 inline-flex items-center gap-1 py-2 text-sm text-[var(--buky-muted)]">
        <ChevronLeft size={18} /> {pt.perfil.rotulo}
      </Link>
      <h1 className="font-buky mt-1 text-[clamp(30px,9vw,38px)] leading-none">{W.titulo}</h1>

      <section className="mt-5 rounded-[22px] border border-[var(--buky-line)] bg-[#111] p-5">
        <p className="buky-label flex items-center gap-2 text-[var(--buky-neon)]">
          <Wallet size={14} /> {W.saldo}
        </p>
        <p className="font-buky-xcond mt-2 text-[clamp(48px,15vw,60px)] leading-none">{brl(w.balance_cents)}</p>
        <p className="mt-2 text-[13px] text-[var(--buky-muted)]">{W.saldoTexto(brl(w.photo_price_cents))}</p>
        <p className="buky-label mt-5 text-[var(--buky-muted)]">{W.recarregar}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {w.topup_options.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy !== null}
              onClick={() => void pay(`t${c}`, { product: "wallet_topup", amountCents: c })}
              className="h-12 rounded-full border border-[var(--buky-neon)] text-[15px] font-semibold text-[var(--buky-neon)] disabled:opacity-40"
            >
              {busy === `t${c}` ? "…" : brl(c)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[var(--buky-faint)]">{W.devolucao}</p>
      </section>

      {s && (
        <section className="mt-4 rounded-[22px] border border-[var(--buky-line)] bg-[#111] p-5">
          <p className="buky-label flex items-center gap-2 text-[var(--buky-neon)]">
            <ImageIcon size={14} /> {W.fotosGratis}
          </p>
          <p className="mt-2 text-[15px]">
            <b className="font-buky text-[28px] text-[var(--buky-neon)]">{s.freeRemaining}</b> <span className="text-[var(--buky-muted)]">{W.deTotal(s.freeTotal)}</span>
          </p>
          <p className="mt-1 text-[13px] text-[var(--buky-muted)]">
            {!s.freeEligible ? W.precisaBukys(s.foundMin, s.foundTotal) : s.nextFreeAt ? W.renovam(fmtDate(s.nextFreeAt, { day: "2-digit", month: "2-digit", year: "numeric" })) : ""}
          </p>
        </section>
      )}

      <section className={`mt-4 rounded-[22px] border p-5 ${premium?.active ? "border-[var(--buky-neon)] bg-[#0f130e]" : "border-[var(--buky-line)] bg-[#111]"}`}>
        <p className="buky-label flex items-center gap-2 text-[var(--buky-neon)]">
          <Crown size={14} /> {premium?.active ? W.premiumAtivo : W.sejaPremium}
        </p>
        {premium?.active && premium.until && <p className="mt-1 text-[15px] font-semibold">{W.vence(fmtDate(premium.until, { day: "2-digit", month: "2-digit", year: "numeric" }))}</p>}
        <ul className="mt-2 space-y-1 text-[14px] text-[#d9d9d9]">
          {W.beneficios.map((b) => (
            <li key={b}>· {b}</li>
          ))}
        </ul>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-[13px]">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-5 w-5 accent-[var(--buky-neon)]" />
          <span>
            {W.aceito}{" "}
            <a href="/termos-premium" target="_blank" rel="noreferrer" className="text-[var(--buky-neon)] underline">
              {W.termos}
            </a>
          </span>
        </label>
        <button type="button" className="buky-btn mt-3" disabled={busy !== null || !terms} onClick={() => void pay("premium", { product: "premium_annual" })}>
          {busy === "premium" ? pt.comum.carregando : premium?.active ? W.renovar(brl(w.premium_price_cents)) : W.assinar(brl(w.premium_price_cents))}
        </button>
        <p className="mt-2 text-[12px] text-[var(--buky-faint)]">{W.semSaldo}</p>
      </section>

      <section className="mt-6">
        <h2 className="buky-label text-[var(--buky-muted)]">{W.movimentos}</h2>
        {w.movements.length === 0 ? (
          <p className="py-4 text-sm text-[var(--buky-faint)]">{W.semMovimentos}</p>
        ) : (
          <ul className="mt-1">
            {w.movements.map((m) => (
              <li key={m.id} className="buky-row flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{walletReasonLabel(m.reason)}</span>
                  <span className="block truncate text-[12px] text-[var(--buky-faint)]">
                    {fmtDate(m.created_at)}
                    {m.note ? ` · ${m.note}` : ""}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold ${m.delta_cents > 0 ? "text-[var(--buky-neon)]" : "text-[var(--buky-danger)]"}`}>{formatCents(m.delta_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
