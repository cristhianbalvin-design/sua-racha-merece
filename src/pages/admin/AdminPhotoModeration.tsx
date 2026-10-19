import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Loader2, Maximize2, X } from 'lucide-react';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { apiGetPhotographers, apiGetRegionsWithId, apiGetSportsWithId, type Photographer } from '@/lib/mockApi';
import {
  apiCountPendingPhotos,
  apiListModerationPhotos,
  apiModeratePhotos,
  moderationErrorMessage,
  type ModerationAction,
  type ModerationPhoto,
} from '@/lib/moderationApi';
import { PHOTO_STATUSES, STATUS_LABEL_PLURAL, formatDateTime, formatIsoDate, isPhotoStatus, type PhotoStatus } from '@/lib/photoStatus';
import { useConfirm } from '@/hooks/useConfirm';
import AdminPhotoTabs from '@/components/admin/AdminPhotoTabs';
import PhotoStatusBadge from '@/components/photographer/PhotoStatusBadge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAGE_SIZE = 24;

const fieldClass = 'bg-input text-foreground rounded-lg px-3 py-2 input-shadow focus:ring-2 focus:ring-ring outline-none text-sm';

const AdminPhotoModerationPage = () => {
  const [confirm, confirmDialog] = useConfirm();
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const status: PhotoStatus = isPhotoStatus(rawStatus) ? rawStatus : 'pending';
  const photographerId = params.get('fotografo') || '';
  const eventDate = params.get('data') || '';
  const page = Math.max(0, Number(params.get('pagina') || '0') || 0);

  const [photos, setPhotos] = useState<ModerationPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState<ModerationAction | null>(null);
  const [preview, setPreview] = useState<ModerationPhoto | null>(null);
  const [pendingCount, setPendingCount] = useState<number | undefined>(undefined);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [sports, setSports] = useState<Record<string, string>>({});
  const [regions, setRegions] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGetPhotographers().then(setPhotographers).catch(console.error);
    apiGetSportsWithId().then((l) => setSports(Object.fromEntries(l.map((s) => [s.id, s.name])))).catch(console.error);
    apiGetRegionsWithId().then((l) => setRegions(Object.fromEntries(l.map((r) => [r.id, r.name])))).catch(console.error);
  }, []);

  const photographerName = useMemo(() => Object.fromEntries(photographers.map((p) => [p.id, p.name])), [photographers]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [res, pend] = await Promise.all([
        apiListModerationPhotos({ status, photographerId: photographerId || undefined, eventDate: eventDate || undefined }, page, PAGE_SIZE),
        apiCountPendingPhotos(),
      ]);
      setPhotos(res.photos);
      setTotal(res.total);
      setPendingCount(pend);
      setSelected(new Set());
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [status, photographerId, eventDate, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('pagina');
    setParams(next, { replace: true });
  };

  const goToPage = (p: number) => {
    const next = new URLSearchParams(params);
    if (p > 0) next.set('pagina', String(p));
    else next.delete('pagina');
    setParams(next);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allSelected = photos.length > 0 && photos.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id)));

  const canPublish = status === 'pending' || status === 'approved';
  const canReject = status !== 'rejected';

  const runAction = async (action: ModerationAction) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === 'reject' && !reason.trim()) {
      toast.error('Informe o motivo da recusa.');
      return;
    }
    if (action === 'reject' && status === 'published') {
      if (!(await confirm({ description: `Retirar ${ids.length} foto(s) publicada(s) da busca facial?`, confirmLabel: 'Retirar e recusar', destructive: true }))) return;
    }
    setActing(action);
    try {
      const changed = await apiModeratePhotos(ids, action, action === 'reject' ? reason.trim() : undefined);
      const verb = action === 'reject' ? 'recusada(s)' : 'publicada(s)';
      if (changed === ids.length) toast.success(`${changed} foto(s) ${verb}.`);
      else
        toast.warning(
          `${changed} de ${ids.length} foto(s) ${verb}. As demais já estavam em outro estado e não foram alteradas.`,
        );
      if (action === 'reject') setReason('');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(moderationErrorMessage(msg));
    } finally {
      setActing(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const describe = (p: ModerationPhoto) =>
    [(p.sport_id && sports[p.sport_id]) || null, p.city, formatIsoDate(p.event_date)].filter((v) => v && v !== '—').join(' · ');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Fotos de Eventos</h1>
        <p className="text-muted-foreground">Revise as fotos enviadas pelos fotógrafos antes de entrarem na busca facial.</p>
      </div>

      <AdminPhotoTabs pendingCount={pendingCount} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="mod-status" className="block text-xs font-bold text-muted-foreground mb-1">Status</label>
          <select id="mod-status" className={fieldClass} value={status} onChange={(e) => setFilter('status', e.target.value === 'pending' ? '' : e.target.value)}>
            {PHOTO_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL_PLURAL[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mod-ph" className="block text-xs font-bold text-muted-foreground mb-1">Fotógrafo</label>
          <select id="mod-ph" className={fieldClass} value={photographerId} onChange={(e) => setFilter('fotografo', e.target.value)}>
            <option value="">Todos</option>
            {photographers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mod-date" className="block text-xs font-bold text-muted-foreground mb-1">Data do evento</label>
          <input id="mod-date" type="date" className={fieldClass} value={eventDate} onChange={(e) => setFilter('data', e.target.value)} />
        </div>
        {(photographerId || eventDate) && (
          <button type="button" onClick={() => setParams(status === 'pending' ? {} : { status }, { replace: true })} className="text-xs font-bold text-primary hover:underline pb-2">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!photos.length} />
              Selecionar tudo ({photos.length})
            </label>
            <span className="text-xs text-muted-foreground">{total} foto(s) neste filtro</span>
          </div>

          {error && <p className="text-destructive text-sm">Não foi possível carregar as fotos.</p>}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
          ) : photos.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm">Nenhuma foto neste filtro.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((p) => {
                const isSel = selected.has(p.id);
                return (
                  <div key={p.id} className={`bg-card rounded-lg overflow-hidden border-2 transition-colors ${isSel ? 'border-secondary' : 'border-border'}`}>
                    <div className="relative aspect-[4/3] bg-muted">
                      <button type="button" onClick={() => toggle(p.id)} className="absolute inset-0 w-full h-full" aria-label={isSel ? 'Desmarcar foto' : 'Selecionar foto'}>
                        <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      </button>
                      <span className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center pointer-events-none ${isSel ? 'bg-secondary text-secondary-foreground' : 'bg-background/80 border border-border'}`}>
                        {isSel && <Check size={14} />}
                      </span>
                      <button type="button" onClick={() => setPreview(p)} className="absolute top-2 right-2 w-7 h-7 rounded-md bg-background/80 flex items-center justify-center text-foreground hover:bg-background" aria-label="Ampliar foto">
                        <Maximize2 size={14} />
                      </button>
                    </div>
                    <div className="p-2.5 space-y-0.5">
                      <p className="text-xs font-bold text-foreground truncate">{(p.photographer_id && photographerName[p.photographer_id]) || 'Sem fotógrafo'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{describe(p) || '—'}</p>
                      <p className="text-[11px] text-muted-foreground">Enviada {formatDateTime(p.created_at)}</p>
                      {p.status === 'rejected' && p.rejection_reason && <p className="text-[11px] text-destructive truncate">Motivo: {p.rejection_reason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" disabled={page === 0 || loading} onClick={() => goToPage(page - 1)} className="p-2 rounded-md bg-muted disabled:opacity-40" aria-label="Página anterior">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => goToPage(page + 1)} className="p-2 rounded-md bg-muted disabled:opacity-40" aria-label="Próxima página">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-4 xl:sticky xl:top-4">
          <div>
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Ações em lote</h2>
            <p className="text-foreground font-bold mt-1">{selected.size} foto(s) selecionada(s)</p>
          </div>

          {canPublish && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => runAction('approve_publish')}
                disabled={!selected.size || acting !== null}
                className="w-full bg-primary text-primary-foreground font-bold px-4 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting === 'approve_publish' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Aprovar e publicar
              </button>
              <p className="text-xs text-muted-foreground">Fotos publicadas entram na busca facial dos atletas.</p>
            </div>
          )}

          {canReject && (
            <div className="space-y-2 border-t border-border pt-4">
              <label htmlFor="mod-reason" className="block text-xs font-bold text-muted-foreground">Motivo da recusa (obrigatório)</label>
              <textarea
                id="mod-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ex.: foto desfocada, sem rosto visível…"
                className="w-full bg-input text-foreground rounded-lg px-3 py-2 input-shadow focus:ring-2 focus:ring-ring outline-none text-sm"
              />
              <p className="text-xs text-muted-foreground">O fotógrafo vê este motivo em Minhas fotos.</p>
              <button
                type="button"
                onClick={() => runAction('reject')}
                disabled={!selected.size || !reason.trim() || acting !== null}
                className="w-full bg-destructive/10 text-destructive font-bold px-4 py-2.5 rounded-md hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {acting === 'reject' ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                {status === 'published' ? 'Retirar e recusar' : 'Recusar'} {selected.size || ''} foto(s)
              </button>
            </div>
          )}

          {!canPublish && !canReject && <p className="text-xs text-muted-foreground">Fotos recusadas não podem ser moderadas novamente por aqui.</p>}
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>{(preview.photographer_id && photographerName[preview.photographer_id]) || 'Sem fotógrafo'}</DialogTitle>
                <DialogDescription>
                  {describe(preview)}
                  {preview.region_id && regions[preview.region_id] ? ` · ${regions[preview.region_id]}` : ''} · Enviada {formatDateTime(preview.created_at)}
                </DialogDescription>
              </DialogHeader>
              <img src={preview.image_url} alt="" className="w-full max-h-[70vh] object-contain bg-muted rounded-md" />
              <div className="flex items-center justify-between gap-3">
                <PhotoStatusBadge status={preview.status} />
                <button
                  type="button"
                  onClick={() => { toggle(preview.id); setPreview(null); }}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  {selected.has(preview.id) ? 'Desmarcar' : 'Selecionar'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
};

/** Guard do flag antes de qualquer hook (evita o padrão de return antes dos hooks). */
const AdminPhotoModeration = () => (SHOW_FACE_SEARCH ? <AdminPhotoModerationPage /> : <Navigate to="/admin/dashboard" replace />);

export default AdminPhotoModeration;
