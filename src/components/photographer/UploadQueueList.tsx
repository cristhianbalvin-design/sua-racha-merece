import { useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Clock, X, RotateCcw, Image as ImageIcon, SkipForward, Ban } from 'lucide-react';
import { formatBytes } from '@/lib/upload/fileClassification';
import { rowBucket, type QueueFilter, type QueueRowData, type RowView } from '@/lib/upload/queueView';

const statusText = (v: RowView): { text: string; tone: string; icon: JSX.Element } => {
  switch (v.kind) {
    case 'unsupported':
      return { text: 'Formato não suportado. Use JPEG, PNG ou WEBP.', tone: 'text-destructive', icon: <Ban size={14} /> };
    case 'too_large':
      return { text: 'Acima de 20 MB. Reduza o tamanho e envie de novo.', tone: 'text-destructive', icon: <Ban size={14} /> };
    case 'skipped':
      return { text: 'Já enviada antes · pulada', tone: 'text-muted-foreground', icon: <SkipForward size={14} /> };
    case 'ready':
      return { text: 'Pronta para enviar', tone: 'text-muted-foreground', icon: <Clock size={14} /> };
    case 'job':
      switch (v.status) {
        case 'queued':
          return { text: 'Na fila', tone: 'text-muted-foreground', icon: <Clock size={14} /> };
        case 'uploading':
          return { text: 'Enviando…', tone: 'text-secondary', icon: <Loader2 size={14} className="animate-spin" /> };
        case 'retrying':
          return { text: `Tentando de novo (${v.retries}/3)… ${v.error ?? ''}`, tone: 'text-accent', icon: <Loader2 size={14} className="animate-spin" /> };
        case 'success':
          return { text: 'Enviada · aguardando aprovação', tone: 'text-primary', icon: <CheckCircle2 size={14} /> };
        case 'error':
          return { text: `Falhou: ${v.error ?? 'erro desconhecido'}`, tone: 'text-destructive', icon: <AlertCircle size={14} /> };
        case 'cancelled':
          return { text: 'Cancelada', tone: 'text-muted-foreground', icon: <Ban size={14} /> };
      }
  }
  return { text: '', tone: '', icon: <Clock size={14} /> };
};

interface Props {
  title: string;
  rows: QueueRowData[];
  busy: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onRetryAll: () => void;
  retryableCount: number;
}

const PAGE = 200;

const UploadQueueList = ({ title, rows, busy, onRemove, onRetry, onRetryAll, retryableCount }: Props) => {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(() => {
    const c = { all: rows.length, queue: 0, sent: 0, error: 0 };
    for (const r of rows) {
      const b = rowBucket(r.view);
      if (b !== 'other') c[b]++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((r) => rowBucket(r.view) === filter)), [rows, filter]);
  const visible = filtered.slice(0, limit);

  const chips: Array<{ key: QueueFilter; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'queue', label: 'Na fila' },
    { key: 'sent', label: 'Enviadas' },
    { key: 'error', label: 'Com erro' },
  ];

  if (rows.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl card-shadow overflow-hidden">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-foreground text-sm">{title}</h3>
          {retryableCount > 0 && (
            <button
              type="button"
              onClick={onRetryAll}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:opacity-50"
            >
              <RotateCcw size={13} /> Tentar novamente {retryableCount === 1 ? 'a 1 com erro' : `as ${retryableCount} com erro`}
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filtrar fila">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={filter === c.key}
              onClick={() => { setFilter(c.key); setLimit(PAGE); }}
              className={`whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                filter === c.key ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.label} · {counts[c.key]}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-border max-h-[480px] overflow-y-auto">
        {visible.map((r) => {
          const s = statusText(r.view);
          const removable = !busy && (r.view.kind !== 'job' || r.view.status === 'error' || r.view.status === 'cancelled' || r.view.status === 'queued');
          const canRetry = r.view.kind === 'job' && r.view.status === 'error' && r.view.retryable;
          return (
            <li key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <ImageIcon size={16} className="text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{r.name}</p>
                <p className={`text-xs flex items-center gap-1 ${s.tone}`}>
                  {s.icon}
                  <span className="truncate">{s.text}</span>
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{formatBytes(r.size)}</span>
              {canRetry && (
                <button type="button" onClick={() => onRetry(r.id)} disabled={busy} className="text-xs font-bold text-primary hover:underline shrink-0 disabled:opacity-50">
                  Tentar novamente
                </button>
              )}
              {removable && (
                <button
                  type="button"
                  onClick={() => onRemove(r.id)}
                  title={r.view.kind === 'unsupported' || r.view.kind === 'too_large' ? 'Ignorar' : 'Remover'}
                  aria-label={`Remover ${r.name}`}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Mostrando {visible.length} de {filtered.length} arquivos</span>
        {filtered.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="font-bold text-primary hover:underline">
            Mostrar mais
          </button>
        )}
      </div>
    </div>
  );
};

export default UploadQueueList;
