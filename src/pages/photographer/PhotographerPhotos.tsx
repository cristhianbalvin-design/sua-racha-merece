import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { usePhotographer } from '@/hooks/usePhotographer';
import { apiGetMyPhotographerStats, apiGetMyPhotos, type PhotographerPhoto } from '@/lib/photographerApi';
import { apiGetSportsWithId } from '@/lib/mockApi';
import { PHOTO_STATUSES, STATUS_LABEL_PLURAL, isPhotoStatus, normalizeStats, type PhotoStatus, type StatusCounts } from '@/lib/photoStatus';
import PhotoCard from '@/components/photographer/PhotoCard';

const PAGE_SIZE = 24;
type Filter = PhotoStatus | 'all';

const PhotographerPhotos = () => {
  const { profile } = usePhotographer();
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const filter: Filter = isPhotoStatus(rawStatus) ? rawStatus : 'all';

  const [stats, setStats] = useState<StatusCounts>(normalizeStats([]));
  const [photos, setPhotos] = useState<PhotographerPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [sports, setSports] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGetMyPhotographerStats().then(setStats).catch(console.error);
    apiGetSportsWithId()
      .then((list) => setSports(Object.fromEntries(list.map((s) => [s.id, s.name]))))
      .catch(console.error);
  }, []);

  const loadPage = useCallback(
    async (offset: number) => {
      if (!profile) return;
      const res = await apiGetMyPhotos(profile.id, { status: filter, from: offset, to: offset + PAGE_SIZE - 1 });
      setTotal(res.total);
      setPhotos((prev) => (offset === 0 ? res.photos : [...prev, ...res.photos.filter((p) => !prev.some((x) => x.id === p.id))]));
    },
    [profile, filter],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    loadPage(0)
      .catch((err) => {
        console.error(err);
        if (active) setError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [loadPage]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadPage(photos.length);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'Todas', count: stats.all },
    ...PHOTO_STATUSES.map((s) => ({ key: s as Filter, label: STATUS_LABEL_PLURAL[s], count: stats[s] })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-bold italic text-2xl text-foreground">Minhas fotos</h1>
          <p className="text-muted-foreground text-sm mt-1">Todas as fotos que você enviou e o status de cada uma.</p>
        </div>
        <Link to="/fotografo/enviar" className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-ui text-xs px-5 py-3 rounded-xl btn-shadow font-bold self-start">
          <Upload size={16} /> ENVIAR FOTOS
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por status">
        {chips.map((c) => {
          const active = c.key === filter;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams(c.key === 'all' ? {} : { status: c.key }, { replace: true })}
              className={`whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                active ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.label} · {c.count}
            </button>
          );
        })}
      </div>

      {error && <p className="text-destructive text-sm">Não foi possível carregar suas fotos. Tente novamente.</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
      ) : photos.length === 0 ? (
        <div className="bg-card rounded-2xl card-shadow p-8 text-center text-muted-foreground text-sm">Nenhuma foto neste filtro.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p) => (
              <PhotoCard
                key={p.id}
                imageUrl={p.image_url}
                status={p.status}
                title={(p.sport_id && sports[p.sport_id]) || 'Evento'}
                city={p.city}
                eventDate={p.event_date}
                rejectionReason={p.rejection_reason}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground">Mostrando {photos.length} de {total} fotos</p>
            {photos.length < total && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-muted text-foreground text-ui text-xs px-6 py-3 rounded-xl font-bold disabled:opacity-60"
              >
                {loadingMore ? 'CARREGANDO...' : 'CARREGAR MAIS'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PhotographerPhotos;
