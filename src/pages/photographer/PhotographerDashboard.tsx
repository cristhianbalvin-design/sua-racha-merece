import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Upload } from 'lucide-react';
import { usePhotographer } from '@/hooks/usePhotographer';
import { apiGetMyPhotographerStats, apiGetMyPhotos, type PhotographerPhoto } from '@/lib/photographerApi';
import { apiGetSportsWithId } from '@/lib/mockApi';
import { PHOTO_STATUSES, STATUS_LABEL_PLURAL, STATUS_NOTE, STATUS_TEXT_CLASS, normalizeStats, type StatusCounts } from '@/lib/photoStatus';
import PhotoCard from '@/components/photographer/PhotoCard';

const PhotographerDashboard = () => {
  const { profile } = usePhotographer();
  const [stats, setStats] = useState<StatusCounts>(normalizeStats([]));
  const [recent, setRecent] = useState<PhotographerPhoto[]>([]);
  const [sports, setSports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    Promise.all([apiGetMyPhotographerStats(), apiGetMyPhotos(profile.id, { from: 0, to: 5 })])
      .then(([s, r]) => {
        if (!active) return;
        setStats(s);
        setRecent(r.photos);
        setError(false);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError(true);
      })
      .finally(() => active && setLoading(false));
    apiGetSportsWithId()
      .then((list) => active && setSports(Object.fromEntries(list.map((s) => [s.id, s.name]))))
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [profile]);

  const firstName = profile?.name?.split(/\s+/)[0] || 'fotógrafo';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold italic text-2xl text-foreground">Olá, {firstName}</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe o status das suas fotos de eventos.</p>
      </div>

      {error && <p className="text-destructive text-sm">Não foi possível carregar seus números. Recarregue a página.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PHOTO_STATUSES.map((s) => (
          <div key={s} className="bg-card rounded-2xl card-shadow p-4">
            <p className="text-ui text-[11px] text-muted-foreground">{STATUS_LABEL_PLURAL[s].toUpperCase()}</p>
            <p className={`text-3xl font-bold mt-1 ${STATUS_TEXT_CLASS[s]}`}>{loading ? '—' : stats[s]}</p>
            <p className="text-xs text-muted-foreground mt-1">{STATUS_NOTE[s]}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl card-shadow p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h2 className="font-bold text-foreground">Enviar novas fotos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha evento, cidade e data, e envie o lote. As fotos entram como pendentes e aparecem na busca facial depois de aprovadas pela equipe 3BUK.
          </p>
        </div>
        <Link to="/fotografo/enviar" className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground text-ui text-xs px-5 py-3 rounded-xl btn-shadow font-bold">
          <Upload size={16} /> ENVIAR FOTOS
        </Link>
      </div>

      {!loading && stats.rejected > 0 && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-bold text-foreground">
                {stats.rejected === 1 ? '1 foto foi recusada' : `${stats.rejected} fotos foram recusadas`}
              </p>
              <p className="text-sm text-muted-foreground">Veja o motivo de cada recusa em Minhas fotos e envie novas versões.</p>
            </div>
          </div>
          <Link to="/fotografo/fotos?status=rejected" className="text-sm font-bold text-destructive hover:underline shrink-0">
            Ver motivos
          </Link>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Últimas fotos enviadas</h2>
          <Link to="/fotografo/fotos" className="text-sm text-primary hover:underline">Ver todas</Link>
        </div>
        {!loading && recent.length === 0 ? (
          <div className="bg-card rounded-2xl card-shadow p-8 text-center text-muted-foreground text-sm">Você ainda não enviou fotos.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {recent.map((p) => (
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
        )}
      </div>
    </div>
  );
};

export default PhotographerDashboard;
