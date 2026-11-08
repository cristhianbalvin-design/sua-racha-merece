import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Search, User as UserIcon } from 'lucide-react';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { apiSearchAthletes, type AthleteSummary } from '@/lib/creditsApi';
import {
  apiAdminGetWallet,
  apiAdminWalletAdjust,
  apiGetPhotoPriceCents,
  apiSetPhotoPriceCents,
  brl,
  formatCents,
  walletReasonLabel,
  type WalletMovement,
} from '@/lib/walletApi';
import { formatDateTime } from '@/lib/photoStatus';
import { useConfirm } from '@/hooks/useConfirm';

const fieldClass = 'w-full bg-input text-foreground rounded-lg px-3 py-2.5 input-shadow focus:ring-2 focus:ring-ring outline-none text-sm';
const isPremiumActive = (u: AthleteSummary) => !!u.premium_until && new Date(u.premium_until).getTime() > Date.now();

/** "1.234,56" / "-10" / "10,5" → centavos. null si no es un monto válido. */
export const parseReais = (raw: string): number | null => {
  const s = raw.trim().replace(/\s|R\$/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isFinite(cents) && cents !== 0 ? cents : null;
};

/**
 * Admin · Saldo (paso 27; antes "Créditos"). Busca un atleta, ve su saldo en R$ y sus movimientos,
 * registra devoluciones pedidas por el atleta o ajustes (siempre con motivo) y fija el precio de la foto.
 * Si la devolución se hace en Mercado Pago, el webhook ya descuenta del saldo lo no usado.
 */
const AdminWalletPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AthleteSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [athlete, setAthlete] = useState<AthleteSummary | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [movements, setMovements] = useState<WalletMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<'refund' | 'adjust'>('refund');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [confirm, confirmDialog] = useConfirm();
  const searchSeq = useRef(0);

  useEffect(() => {
    apiGetPhotoPriceCents()
      .then((c) => {
        setPrice(c);
        setPriceInput((c / 100).toFixed(2).replace('.', ','));
      })
      .catch(() => setPrice(null));
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
        .catch(() => id === searchSeq.current && toast.error('Erro ao buscar atletas.'))
        .finally(() => id === searchSeq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadAthlete = useCallback(async (u: AthleteSummary) => {
    setAthlete(u);
    setResults([]);
    setQuery('');
    setLoading(true);
    try {
      const w = await apiAdminGetWallet(u.id);
      setBalance(w.balance_cents);
      setMovements(w.movements);
    } catch {
      toast.error('Erro ao carregar o saldo do atleta.');
    } finally {
      setLoading(false);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athlete || busy) return;
    const cents = parseReais(amount);
    if (cents === null || (kind === 'refund' && cents < 0)) {
      setFormError(kind === 'refund' ? 'Informe o valor devolvido, por exemplo 20,00.' : 'Informe um valor, por exemplo 10,00 ou -10,00.');
      return;
    }
    if (!note.trim()) {
      setFormError('O motivo é obrigatório.');
      return;
    }
    const delta = kind === 'refund' ? -Math.abs(cents) : cents;
    const who = athlete.name || athlete.email;
    const label = kind === 'refund' ? `registrar devolução de ${brl(Math.abs(delta))} (sai do saldo)` : `${delta > 0 ? 'somar' : 'descontar'} ${brl(Math.abs(delta))}`;
    if (!(await confirm({ description: `Confirmar: ${label} para ${who}?`, confirmLabel: 'Aplicar' }))) return;
    setBusy(true);
    setFormError('');
    try {
      const b = await apiAdminWalletAdjust(athlete.id, delta, note.trim(), kind === 'refund');
      toast.success(`Pronto. Novo saldo: ${brl(b)}.`);
      setAmount('');
      setNote('');
      await loadAthlete(athlete);
    } catch (err) {
      const m = (err as { message?: string })?.message ?? '';
      setFormError(m.includes('insufficient_balance') ? 'O saldo do atleta não é suficiente para esse valor.' : 'Não foi possível aplicar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const savePrice = async () => {
    const cents = parseReais(priceInput);
    if (cents === null || cents < 0) return toast.error('Preço inválido.');
    try {
      await apiSetPhotoPriceCents(cents);
      setPrice(cents);
      toast.success(`Preço da foto: ${brl(cents)}.`);
    } catch {
      toast.error('Não foi possível salvar o preço.');
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div>
        <h1 className="font-bold italic text-2xl text-foreground">SALDO</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Saldo em reais dos atletas (Premium inclui R$ 50; recargas de R$ 20, 30 e 50). Devoluções pedidas pelo atleta se registram aqui; se a
          devolução for feita no Mercado Pago, o saldo não usado sai automaticamente.
        </p>
      </div>

      <div className="bg-card rounded-2xl card-shadow p-5 space-y-2">
        <p className="text-ui text-xs text-muted-foreground">PREÇO DA FOTO (quando acabam as fotos grátis)</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">R$</span>
          <input className={`${fieldClass} max-w-[140px]`} value={priceInput} onChange={(e) => setPriceInput(e.target.value)} inputMode="decimal" aria-label="Preço da foto" />
          <button type="button" onClick={savePrice} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            Salvar
          </button>
          {price !== null && <span className="text-xs text-muted-foreground">Atual: {brl(price)}</span>}
        </div>
      </div>

      <div className="bg-card rounded-2xl card-shadow p-5 space-y-3">
        <label className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={`${fieldClass} pl-9`} placeholder="Buscar atleta por nome ou e-mail" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {searching && <Loader2 className="animate-spin text-primary" size={16} />}
        {results.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {results.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => void loadAthlete(u)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted">
                  <UserIcon size={16} className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <b>{u.name || '—'}</b> <span className="text-muted-foreground">{u.email}</span>
                  </span>
                  {isPremiumActive(u) && <span className="text-[10px] font-bold text-accent">PREMIUM</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {athlete && (
        <div className="bg-card rounded-2xl card-shadow p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-bold text-foreground">{athlete.name || athlete.email}</p>
              <p className="text-xs text-muted-foreground">
                {athlete.email} · {isPremiumActive(athlete) ? `Premium até ${new Date(athlete.premium_until!).toLocaleDateString('pt-BR')}` : 'Freemium'}
              </p>
            </div>
            <p className="text-2xl font-bold text-primary">{balance === null ? '…' : brl(balance)}</p>
          </div>

          <form onSubmit={submit} className="grid gap-3 md:grid-cols-[160px_160px_1fr_auto] md:items-end">
            <label className="text-xs text-muted-foreground">
              Tipo
              <select className={fieldClass} value={kind} onChange={(e) => setKind(e.target.value as 'refund' | 'adjust')}>
                <option value="refund">Devolução (sai do saldo)</option>
                <option value="adjust">Ajuste (+ ou −)</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Valor (R$)
              <input className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={kind === 'refund' ? '20,00' : '10,00 ou -10,00'} inputMode="decimal" />
            </label>
            <label className="text-xs text-muted-foreground">
              Motivo
              <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: devolução pedida por e-mail em 10/11" />
            </label>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {busy ? 'Aplicando…' : 'Aplicar'}
            </button>
          </form>
          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div>
            <h2 className="font-bold text-foreground mb-2">Movimentos</h2>
            {loading ? (
              <Loader2 className="animate-spin text-primary" />
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentos de saldo.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {movements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm">{walletReasonLabel(m.reason)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(m.created_at)}
                        {m.note ? ` · ${m.note}` : ''}
                        {m.balance_after_cents !== undefined ? ` · saldo ${brl(m.balance_after_cents)}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 font-bold ${m.delta_cents > 0 ? 'text-primary' : 'text-destructive'}`}>{formatCents(m.delta_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminCredits = () => (SHOW_FACE_SEARCH ? <AdminWalletPage /> : <Navigate to="/admin" replace />);

export default AdminCredits;
