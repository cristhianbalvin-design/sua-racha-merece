import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Search, User as UserIcon } from 'lucide-react';
import { SHOW_FACE_SEARCH } from '@/config/features';
import {
  apiAdminAdjustCredits,
  apiGetLedger,
  apiGetPhotoCreditCostSetting,
  apiGetUserBalance,
  apiSearchAthletes,
  apiSetPhotoCreditCost,
  type AthleteSummary,
  type LedgerRow,
} from '@/lib/creditsApi';
import {
  adminLedgerReasonLabel,
  creditErrorMessage,
  formatDelta,
  ledgerActorLabel,
  parseAdjustAmount,
  parseCostInput,
} from '@/lib/credits';
import { formatDateTime } from '@/lib/photoStatus';
import { useConfirm } from '@/hooks/useConfirm';

const LEDGER_PAGE = 20;
const fieldClass = 'w-full bg-input text-foreground rounded-lg px-3 py-2.5 input-shadow focus:ring-2 focus:ring-ring outline-none text-sm';

const isPremiumActive = (u: AthleteSummary) => !!u.premium_until && new Date(u.premium_until).getTime() > Date.now();

const AdminCreditsPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AthleteSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [athlete, setAthlete] = useState<AthleteSummary | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [adjustError, setAdjustError] = useState('');

  const [cost, setCost] = useState<number | null>(null);
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState('');
  const [costError, setCostError] = useState('');
  const [savingCost, setSavingCost] = useState(false);

  const searchSeq = useRef(0);

  useEffect(() => {
    apiGetPhotoCreditCostSetting().then(setCost).catch(console.error);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      searchSeq.current++;
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(() => {
      apiSearchAthletes(q)
        .then((r) => id === searchSeq.current && setResults(r))
        .catch((err) => {
          console.error(err);
          if (id === searchSeq.current) toast.error('Erro ao buscar atletas.');
        })
        .finally(() => id === searchSeq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadAthlete = useCallback(async (u: AthleteSummary) => {
    setAthlete(u);
    setResults([]);
    setQuery('');
    setBalance(null);
    setLedger([]);
    setLedgerLoading(true);
    try {
      const [b, l] = await Promise.all([apiGetUserBalance(u.id), apiGetLedger(u.id, 0, LEDGER_PAGE - 1)]);
      setBalance(b);
      setLedger(l.rows);
      setLedgerTotal(l.total);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar os créditos do atleta.');
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadMoreLedger = async () => {
    if (!athlete) return;
    setLedgerLoading(true);
    try {
      const l = await apiGetLedger(athlete.id, ledger.length, ledger.length + LEDGER_PAGE - 1);
      setLedger((prev) => [...prev, ...l.rows.filter((r) => !prev.some((x) => x.id === r.id))]);
      setLedgerTotal(l.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athlete || adjusting) return;
    const parsed = parseAdjustAmount(amount);
    if (parsed.ok === false) {
      setAdjustError(parsed.error);
      return;
    }
    if (!note.trim()) {
      setAdjustError('A nota é obrigatória.');
      return;
    }
    const verb = parsed.value > 0 ? `conceder ${parsed.value}` : `descontar ${Math.abs(parsed.value)}`;
    if (!(await confirm({ description: `Confirmar: ${verb} crédito(s) para ${athlete.name || athlete.email}?`, confirmLabel: 'Aplicar' }))) return;
    setAdjusting(true);
    setAdjustError('');
    try {
      const res = await apiAdminAdjustCredits(athlete.id, parsed.value, note.trim());
      toast.success(`Ajuste aplicado. Novo saldo: ${res.balance} créditos.`);
      setAmount('');
      setNote('');
      await loadAthlete(athlete);
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      setAdjustError(creditErrorMessage(msg));
    } finally {
      setAdjusting(false);
    }
  };

  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCostInput(costInput);
    if (parsed.ok === false) {
      setCostError(parsed.error);
      return;
    }
    setSavingCost(true);
    setCostError('');
    try {
      await apiSetPhotoCreditCost(parsed.value);
      setCost(parsed.value);
      setEditingCost(false);
      toast.success('Custo por foto atualizado.');
    } catch (err) {
      console.error(err);
      setCostError((err as { message?: string })?.message || 'Não foi possível salvar.');
    } finally {
      setSavingCost(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-bold italic text-2xl text-foreground">CRÉDITOS DO ATLETA</h1>
        <p className="text-muted-foreground text-sm">Consulte saldos, conceda ou desconte créditos e defina o custo por foto.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Busca */}
          <div className="bg-card rounded-2xl card-shadow p-5 space-y-3">
            <label htmlFor="cred-search" className="text-ui text-xs text-muted-foreground block">BUSCAR ATLETA</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                id="cred-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome ou e-mail (mín. 2 letras)"
                className={`${fieldClass} pl-9`}
              />
              {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            {results.length > 0 && (
              <ul className="border border-border rounded-lg divide-y divide-border max-h-72 overflow-y-auto">
                {results.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => loadAthlete(u)} className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors">
                      <p className="text-sm font-bold text-foreground">{u.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum atleta encontrado.</p>
            )}
          </div>

          {athlete && (
            <>
              <div className="bg-card rounded-2xl card-shadow p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserIcon size={18} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{athlete.name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{athlete.email}</p>
                    <p className="text-xs mt-1">
                      {isPremiumActive(athlete) ? (
                        <span className="font-bold text-accent">Premium até {new Date(athlete.premium_until!).toLocaleDateString('pt-BR')}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Plano {athlete.plan || 'Freemium'}
                          {athlete.premium_until ? ` · Premium vencido em ${new Date(athlete.premium_until).toLocaleDateString('pt-BR')}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-ui text-[11px] text-muted-foreground">SALDO</p>
                  <p className="text-3xl font-bold text-primary">{balance ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">créditos</p>
                </div>
              </div>

              <form onSubmit={handleAdjust} className="bg-card rounded-2xl card-shadow p-5 space-y-4">
                <h2 className="font-bold text-foreground">Ajustar créditos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                  <div>
                    <label htmlFor="cred-amount" className="text-ui text-xs text-muted-foreground block mb-1.5">QUANTIDADE</label>
                    <input id="cred-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex.: 30 ou -10" className={fieldClass} disabled={adjusting} />
                  </div>
                  <div>
                    <label htmlFor="cred-note" className="text-ui text-xs text-muted-foreground block mb-1.5">NOTA (OBRIGATÓRIA)</label>
                    <input id="cred-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ex.: Bônus de lançamento" className={fieldClass} disabled={adjusting} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Positivo concede, negativo desconta. O saldo nunca fica negativo.</p>
                {adjustError && <p className="text-destructive text-sm" role="alert">{adjustError}</p>}
                <button type="submit" disabled={adjusting || !amount.trim() || !note.trim()} className="bg-primary text-primary-foreground text-ui text-xs px-5 py-2.5 rounded-xl btn-shadow font-bold disabled:opacity-50 flex items-center gap-2">
                  {adjusting && <Loader2 size={14} className="animate-spin" />}
                  APLICAR AJUSTE
                </button>
              </form>

              <div className="bg-card rounded-2xl card-shadow overflow-hidden">
                <div className="p-5 pb-3">
                  <h2 className="font-bold text-foreground">Histórico de movimentos</h2>
                  <p className="text-xs text-muted-foreground mt-1">Registro apenas de inclusão: movimentos não podem ser editados nem apagados.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border">
                        <th className="text-left px-4 py-2.5 text-ui text-xs text-muted-foreground">DATA</th>
                        <th className="text-right px-4 py-2.5 text-ui text-xs text-muted-foreground">MOVIMENTO</th>
                        <th className="text-right px-4 py-2.5 text-ui text-xs text-muted-foreground">SALDO</th>
                        <th className="text-left px-4 py-2.5 text-ui text-xs text-muted-foreground">MOTIVO</th>
                        <th className="text-left px-4 py-2.5 text-ui text-xs text-muted-foreground">POR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledger.length === 0 && !ledgerLoading && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum movimento.</td></tr>
                      )}
                      {ledger.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${r.delta > 0 ? 'text-primary' : 'text-destructive'}`}>{formatDelta(r.delta)}</td>
                          <td className="px-4 py-2.5 text-right text-foreground">{r.balance_after}</td>
                          <td className="px-4 py-2.5 text-foreground">{adminLedgerReasonLabel(r.reason, r.note)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{ledgerActorLabel(r.reason, r.created_by)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>Mostrando {ledger.length} de {ledgerTotal}</span>
                  {ledger.length < ledgerTotal && (
                    <button type="button" onClick={loadMoreLedger} disabled={ledgerLoading} className="font-bold text-primary hover:underline disabled:opacity-50">
                      {ledgerLoading ? 'Carregando…' : 'Carregar mais'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Custo por foto */}
        <div className="bg-card rounded-2xl card-shadow p-5 space-y-3">
          <h2 className="font-bold text-foreground">Custo por foto</h2>
          {!editingCost ? (
            <>
              <p className="text-2xl font-bold text-foreground">{cost ?? '—'} <span className="text-sm font-normal text-muted-foreground">créditos = 1 foto</span></p>
              <button type="button" onClick={() => { setCostInput(cost ? String(cost) : ''); setCostError(''); setEditingCost(true); }} className="text-xs font-bold text-primary hover:underline">
                Editar custo
              </button>
            </>
          ) : (
            <form onSubmit={handleSaveCost} className="space-y-2">
              <input inputMode="numeric" value={costInput} onChange={(e) => setCostInput(e.target.value)} className={fieldClass} aria-label="Créditos por foto" autoFocus disabled={savingCost} />
              {costError && <p className="text-destructive text-xs">{costError}</p>}
              <p className="text-xs text-muted-foreground">Vale para os próximos downloads.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingCost(false)} disabled={savingCost} className="flex-1 bg-muted text-foreground text-xs font-bold py-2 rounded-lg">Cancelar</button>
                <button type="submit" disabled={savingCost} className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2 rounded-lg disabled:opacity-50">Salvar</button>
              </div>
            </form>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
};

const AdminCredits = () => (SHOW_FACE_SEARCH ? <AdminCreditsPage /> : <Navigate to="/admin/dashboard" replace />);

export default AdminCredits;
