import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { apiGetDownloadStatus, type DownloadStatus } from '@/lib/libraryApi';
import { apiCreateCheckout, apiGetMyWallet, apiSyncPayments, brl, formatCents, walletReasonLabel, type MyWallet } from '@/lib/walletApi';

/**
 * Meu saldo (paso 27; antes "Meus créditos"). Saldo en reales, fotos gratis del año, Premium y
 * recargas por Mercado Pago. El Premium se paga siempre con dinero nuevo, nunca con el saldo.
 */
const UserWalletPage = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<MyWallet | null>(null);
  const [photos, setPhotos] = useState<DownloadStatus | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([apiGetMyWallet(), apiGetDownloadStatus().catch(() => undefined)])
      .then(([w, s]) => {
        if (!active) return;
        setWallet(w);
        setPhotos(s);
        setError(false);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user, reloadKey]);

  // Respaldo del webhook: verifica pagos pendientes (Premium y recargas) al abrir la página.
  useEffect(() => {
    if (!user) return;
    apiSyncPayments()
      .then((r) => {
        if (r.applied) {
          toast.success('Pagamento confirmado! Seu saldo já foi atualizado.');
          setReloadKey((k) => k + 1);
        }
      })
      .catch(() => {});
  }, [user]);

  // Retorno de Mercado Pago (?premium=success|pending|failure)
  useEffect(() => {
    const result = searchParams.get('premium');
    if (!result) return;
    if (result === 'success') toast.success('Pagamento recebido! Atualizamos seu saldo em instantes.');
    else if (result === 'pending') toast.info('Pagamento pendente. Atualizamos assim que for confirmado.');
    else if (result === 'failure') toast.error('O pagamento não foi concluído. Tente novamente.');
    setSearchParams({}, { replace: true });
    if (result !== 'failure') {
      const recheck = () =>
        apiSyncPayments()
          .catch(() => ({ applied: false }))
          .then(() => setReloadKey((k) => k + 1));
      const t1 = setTimeout(recheck, 3000);
      const t2 = setTimeout(recheck, 10000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [searchParams, setSearchParams]);

  const checkout = async (key: string, input: Parameters<typeof apiCreateCheckout>[0]) => {
    if (busy) return;
    setBusy(key);
    try {
      window.location.assign(await apiCreateCheckout(input));
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível iniciar o pagamento. Tente novamente.');
      setBusy(null);
    }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
  const premium = wallet?.premium;

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
      <Link to="/perfil" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Perfil
      </Link>
      <h1 className="font-bold italic text-2xl text-foreground">MEU SALDO</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : error || !wallet ? (
        <div className="bg-card rounded-2xl card-shadow p-6 text-center text-muted-foreground text-sm">Não foi possível carregar seu saldo. Tente novamente mais tarde.</div>
      ) : (
        <>
          <div className="bg-card rounded-2xl card-shadow p-5 space-y-2">
            <p className="text-ui text-xs text-muted-foreground">SALDO</p>
            <p className="text-4xl font-bold text-primary">{brl(wallet.balance_cents)}</p>
            <p className="text-sm text-muted-foreground">Cada foto custa {brl(wallet.photo_price_cents)} quando acabam suas fotos grátis. O saldo não vence.</p>
          </div>

          {photos && (
            <div className="bg-card rounded-2xl card-shadow p-5 space-y-1">
              <p className="text-ui text-xs text-muted-foreground">FOTOS GRÁTIS NESTE ANO</p>
              <p className="text-2xl font-bold text-foreground">
                {photos.freeRemaining} <span className="text-base font-normal text-muted-foreground">de {photos.freeTotal}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {!photos.freeEligible
                  ? `No plano Freemium, a foto grátis libera com ${photos.foundMin} Bukys coletados correndo (você tem ${photos.foundTotal}).`
                  : photos.nextFreeAt
                    ? `Renovam em ${fmtDate(photos.nextFreeAt)}.`
                    : ''}
              </p>
            </div>
          )}

          <div className="bg-card rounded-2xl card-shadow p-5 space-y-3">
            <div>
              <p className="text-ui text-xs text-muted-foreground">RECARREGAR SALDO</p>
              <p className="text-sm text-muted-foreground mt-1">Pagamento por cartão ou Pix. Para pedir devolução, fale com a 3buk.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {wallet.topup_options.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => checkout(`topup-${c}`, { product: 'wallet_topup', amountCents: c, returnTo: 'web' })}
                  disabled={busy !== null}
                  className="rounded-full border border-primary px-5 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
                >
                  {busy === `topup-${c}` ? 'Abrindo…' : brl(c)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl card-shadow p-5 space-y-3">
            <div>
              <p className="text-ui text-xs text-muted-foreground">PLANO</p>
              {premium?.active ? (
                <p className="font-bold text-accent mt-1">
                  PREMIUM{premium.until ? <span className="font-normal text-muted-foreground"> · vence em {fmtDate(premium.until)}</span> : null}
                </p>
              ) : (
                <p className="font-bold text-foreground mt-1">
                  FREEMIUM
                  {premium?.until ? <span className="font-normal text-muted-foreground text-sm"> · Premium venceu em {fmtDate(premium.until)}</span> : null}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {brl(wallet.premium_price_cents)} por 12 meses, pagamento único (cartão ou Pix). Inclui {brl(5000)} de saldo e 3 fotos grátis por ano.
                {premium?.active ? ' A renovação soma 12 meses ao final do período atual.' : ''} O Premium não pode ser pago com saldo.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" />
              <span className="text-sm text-foreground">
                Li e aceito os{' '}
                <a href="/termos-premium" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Termos de Compra do Premium
                </a>
                .
              </span>
            </label>
            <button
              type="button"
              onClick={() => checkout('premium', { product: 'premium_annual', returnTo: 'web' })}
              disabled={busy !== null || !acceptedTerms}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy === 'premium' ? 'Abrindo…' : premium?.active ? `Renovar · ${brl(wallet.premium_price_cents)}/ano` : `Ser Premium · ${brl(wallet.premium_price_cents)}/ano`}
            </button>
          </div>

          <div className="bg-card rounded-2xl card-shadow overflow-hidden">
            <h2 className="font-bold text-foreground p-5 pb-3">Histórico</h2>
            {wallet.movements.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted-foreground">Você ainda não tem movimentos de saldo.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {wallet.movements.map((r) => (
                  <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{walletReasonLabel(r.reason)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(r.created_at)}
                        {r.note ? ` · ${r.note}` : ''}
                      </p>
                    </div>
                    <span className={`font-bold shrink-0 ${r.delta_cents > 0 ? 'text-primary' : 'text-destructive'}`}>{formatCents(r.delta_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const UserCredits = () => (SHOW_FACE_SEARCH ? <UserWalletPage /> : <Navigate to="/perfil" replace />);

export default UserCredits;
