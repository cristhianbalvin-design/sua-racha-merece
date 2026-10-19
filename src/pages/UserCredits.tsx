import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { apiGetLedger, apiGetMyCreditBalance, apiGetMyPlan, apiGetPhotoCreditCost, apiIsPremium, type LedgerRow } from '@/lib/creditsApi';
import { formatDelta, ledgerReasonLabel, photosEquivalent } from '@/lib/credits';

const PAGE = 20;

const UserCreditsPage = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [premium, setPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([
      apiGetMyCreditBalance(),
      apiGetPhotoCreditCost().catch(() => null),
      apiIsPremium().catch(() => false),
      apiGetMyPlan(user.id).catch(() => null),
      apiGetLedger(user.id, 0, PAGE - 1),
    ])
      .then(([b, c, p, plan, l]) => {
        if (!active) return;
        setBalance(b);
        setCost(c);
        setPremium(p);
        setPremiumUntil(plan?.premium_until ?? null);
        setLedger(l.rows);
        setTotal(l.total);
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
  }, [user]);

  const loadMore = async () => {
    if (!user) return;
    setLoadingMore(true);
    try {
      const l = await apiGetLedger(user.id, ledger.length, ledger.length + PAGE - 1);
      setLedger((prev) => [...prev, ...l.rows.filter((r) => !prev.some((x) => x.id === r.id))]);
      setTotal(l.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
      <Link to="/perfil" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Perfil
      </Link>
      <h1 className="font-bold italic text-2xl text-foreground">MEUS CRÉDITOS</h1>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
      ) : error ? (
        <div className="bg-card rounded-2xl card-shadow p-6 text-center text-muted-foreground text-sm">Não foi possível carregar seus créditos. Tente novamente mais tarde.</div>
      ) : (
        <>
          <div className="bg-card rounded-2xl card-shadow p-5 space-y-2">
            <p className="text-ui text-xs text-muted-foreground">SALDO</p>
            <p className="text-4xl font-bold text-primary">
              {balance ?? 0} <span className="text-base font-normal text-muted-foreground">créditos</span>
            </p>
            {cost && (
              <p className="text-sm text-muted-foreground">
                Equivale a {photosEquivalent(balance ?? 0, cost)} {photosEquivalent(balance ?? 0, cost) === 1 ? 'foto' : 'fotos'} ({cost} créditos = 1 foto)
              </p>
            )}
          </div>

          <div className="bg-card rounded-2xl card-shadow p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-ui text-xs text-muted-foreground">PLANO</p>
              {premium ? (
                <p className="font-bold text-accent mt-1">
                  PREMIUM{premiumUntil ? <span className="font-normal text-muted-foreground"> · vence em {fmtDate(premiumUntil)}</span> : null}
                </p>
              ) : (
                <p className="font-bold text-foreground mt-1">
                  FREEMIUM
                  {premiumUntil ? <span className="font-normal text-muted-foreground text-sm"> · Premium venceu em {fmtDate(premiumUntil)}</span> : null}
                </p>
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl card-shadow overflow-hidden">
            <h2 className="font-bold text-foreground p-5 pb-3">Histórico</h2>
            {ledger.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted-foreground">Você ainda não tem movimentos de créditos.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {ledger.map((r) => (
                  <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{ledgerReasonLabel(r.reason)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(r.created_at)} · Saldo {r.balance_after}</p>
                    </div>
                    <span className={`font-bold shrink-0 ${r.delta > 0 ? 'text-primary' : 'text-destructive'}`}>{formatDelta(r.delta)}</span>
                  </li>
                ))}
              </ul>
            )}
            {ledger.length < total && (
              <div className="p-4 border-t border-border text-center">
                <button type="button" onClick={loadMore} disabled={loadingMore} className="text-sm font-bold text-primary hover:underline disabled:opacity-50">
                  {loadingMore ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const UserCredits = () => (SHOW_FACE_SEARCH ? <UserCreditsPage /> : <Navigate to="/perfil" replace />);

export default UserCredits;
