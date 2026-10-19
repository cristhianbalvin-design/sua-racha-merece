import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { apiGetMyDownloads, apiRegisterDownload, type LibraryItem } from '@/lib/libraryApi';
import { downloadPhotoFile } from '@/lib/downloadPhoto';
import { formatDateTime, formatIsoDate } from '@/lib/photoStatus';

const PAGE = 24;

const UserLibraryPage = () => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await apiGetMyDownloads(0, PAGE);
      setItems(page.items);
      setTotal(page.total);
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await apiGetMyDownloads(items.length, PAGE);
      setItems((prev) => [...prev, ...page.items.filter((n) => !prev.some((p) => p.eventPhotoId === n.eventPhotoId))]);
      setTotal(page.total);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar mais fotos.');
    } finally {
      setLoadingMore(false);
    }
  };

  const downloadAgain = async (item: LibraryItem) => {
    if (busyId) return;
    setBusyId(item.eventPhotoId);
    const toastId = toast.loading('Baixando foto...');
    try {
      const permission = await apiRegisterDownload(item.eventPhotoId);
      if (!permission.allowed) {
        toast.error('Esta foto não está mais disponível para download.', { id: toastId });
        return;
      }
      await downloadPhotoFile(item.imageUrl, item.eventPhotoId);
      toast.success('Download iniciado!', { id: toastId });
      // Atualiza contador/ordem sem perder o scroll
      void apiGetMyDownloads(0, Math.max(items.length, PAGE)).then((p) => {
        setItems(p.items);
        setTotal(p.total);
      }).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error('Erro ao baixar a foto. Tente novamente.', { id: toastId });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto space-y-6">
      <Link to="/perfil" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Perfil
      </Link>
      <div>
        <h1 className="font-bold italic text-2xl text-foreground">MINHA BIBLIOTECA</h1>
        <p className="text-sm text-muted-foreground mt-1">Fotos que você já baixou. Baixar de novo não gasta créditos.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
      ) : error ? (
        <div className="bg-card rounded-2xl card-shadow p-6 text-center text-muted-foreground text-sm space-y-3">
          <p>Não foi possível carregar sua biblioteca.</p>
          <button type="button" onClick={() => void load()} className="text-primary font-bold hover:underline">Tentar novamente</button>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-2xl card-shadow p-8 text-center space-y-3">
          <p className="text-foreground font-bold">Sua biblioteca está vazia</p>
          <p className="text-sm text-muted-foreground">As fotos que você baixar na busca facial aparecem aqui.</p>
          <Link to="/fotografias-3buk" className="inline-block text-primary font-bold text-sm hover:underline">Buscar minhas fotos →</Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} {total === 1 ? 'foto' : 'fotos'}</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((item) => (
              <li key={item.eventPhotoId} className="bg-card rounded-2xl card-shadow overflow-hidden flex flex-col">
                <img src={item.imageUrl} alt={`Foto de ${item.sportName ?? 'evento'} em ${item.city ?? 'local não informado'}`} loading="lazy" className="w-full aspect-[4/5] object-cover bg-muted" />
                <div className="p-3 space-y-1 flex-1 flex flex-col">
                  <p className="text-sm font-bold text-foreground truncate">{item.sportName ?? 'Evento'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[item.city, item.regionName].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Evento {formatIsoDate(item.eventDate)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Baixada {item.downloadCount}× · última em {formatDateTime(item.lastDownloadedAt)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void downloadAgain(item)}
                    disabled={busyId !== null}
                    className="mt-auto pt-2 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold py-2 rounded-xl disabled:opacity-50"
                  >
                    {busyId === item.eventPhotoId ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Baixar de novo
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {items.length < total && (
            <div className="text-center">
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="text-sm font-bold text-primary hover:underline disabled:opacity-50">
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const UserLibrary = () => (SHOW_FACE_SEARCH ? <UserLibraryPage /> : <Navigate to="/" replace />);

export default UserLibrary;
