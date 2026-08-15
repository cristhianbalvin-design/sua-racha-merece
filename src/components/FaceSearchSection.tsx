import { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Upload, Loader2, AlertCircle, ImageIcon, Sparkles, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PhotoCampaignModal from '@/components/PhotoCampaignModal';
import { useIsMobile } from '@/hooks/use-mobile';

interface Match {
  id: string;
  image_url: string;
  similarity: number;
  campaign_id?: string;
  event_label?: string;
  photographer_id?: string | null;
  photographer_name?: string | null;
  photographer_photo_url?: string | null;
}

interface SearchFilterRow {
  region_id?: string;
  region_name?: string;
  sport_id?: string;
  sport_name?: string;
  event_date?: string;
  photographer_id?: string;
  photographer_name?: string;
}

const loadingStages = [
  {
    title: 'Preparando sua busca',
    description: 'Organizando os dados do evento com segurança',
    delay: 0,
  },
  {
    title: 'Analisando sua selfie',
    description: 'Identificando os traços com cuidado',
    delay: 2600,
  },
  {
    title: 'Comparando com as fotos',
    description: 'Isso pode levar alguns segundos',
    delay: 6500,
  },
  {
    title: 'Só mais um instante',
    description: 'Estamos finalizando tudo para você',
    delay: 11000,
  },
] as const;

export const FaceSearchSection = () => {
  const navigate = useNavigate();
  const isMobileBreakpoint = useIsMobile();
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isMobile = isMobileBreakpoint || isMobileDevice;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  const [matches, setMatches] = useState<Match[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingStage, setLoadingStage] = useState(0);
  const [campaignPhoto, setCampaignPhoto] = useState<{ id: string; imageUrl: string } | null>(null);
  const [isDownloadIntent, setIsDownloadIntent] = useState(false);

  // Filters state
  const [regions, setRegions] = useState<{id: string, name: string}[]>([]);
  const [sports, setSports] = useState<{id: string, name: string}[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [photographers, setPhotographers] = useState<{id: string, name: string}[]>([]);

  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPhotographer, setSelectedPhotographer] = useState('');

  const matchesByPhotographer = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      name: string;
      photoUrl: string | null;
      matches: Match[];
    }>();

    matches.forEach((match) => {
      const photographerId = match.photographer_id || match.photographer_name || 'unknown';
      const currentGroup = groups.get(photographerId);

      if (currentGroup) {
        currentGroup.matches.push(match);
        if (!currentGroup.photoUrl && match.photographer_photo_url) {
          currentGroup.photoUrl = match.photographer_photo_url;
        }
        return;
      }

      groups.set(photographerId, {
        id: photographerId,
        name: match.photographer_name || 'Fotógrafo não identificado',
        photoUrl: match.photographer_photo_url || null,
        matches: [match],
      });
    });

    return Array.from(groups.values());
  }, [matches]);

  const executeDownload = async (matchId: string, imageUrl: string) => {
    const toastId = toast.loading('Baixando foto...', { id: 'download' });
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Falha ao baixar imagem');
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = localUrl;
      link.download = `foto_${matchId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(localUrl);
      
      toast.success('Download iniciado!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao baixar a foto. Tente novamente.', { id: toastId });
    }
  };

  const handleDownload = async (matchId: string, imageUrl: string) => {
    try {
      toast.loading('Verificando permissão...', { id: 'download' });
      const { data, error } = await supabase.rpc('check_and_register_download', { p_event_photo_id: matchId });
      if (error) throw error;

      if (data.allowed) {
        executeDownload(matchId, imageUrl);
      } else {
        toast.dismiss('download');
        setIsDownloadIntent(true);
        setCampaignPhoto({ id: matchId, imageUrl });
      }
    } catch {
      toast.error('Erro ao verificar permissão.', { id: 'download' });
    }
  };

  useEffect(() => {
    const fetchFilters = async () => {
      const { data, error } = await supabase.rpc('get_search_filters');
      if (data) {
        const uniqueRegions = new Map();
        const uniqueSports = new Map();
        const uniqueDates = new Set<string>();
        const uniquePhotographers = new Map();

        data.forEach((row: SearchFilterRow) => {
          if (row.region_id && row.region_name) uniqueRegions.set(row.region_id, row.region_name);
          if (row.sport_id && row.sport_name) uniqueSports.set(row.sport_id, row.sport_name);
          if (row.event_date) uniqueDates.add(row.event_date);
          if (row.photographer_id && row.photographer_name) uniquePhotographers.set(row.photographer_id, row.photographer_name);
        });

        setRegions(Array.from(uniqueRegions, ([id, name]) => ({ id, name })));
        setSports(Array.from(uniqueSports, ([id, name]) => ({ id, name })));
        setDates(Array.from(uniqueDates).sort());
        setPhotographers(Array.from(uniquePhotographers, ([id, name]) => ({ id, name })));
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (status !== 'loading') {
      setLoadingStage(0);
      return;
    }

    const timers = loadingStages.slice(1).map((stage, index) => (
      window.setTimeout(() => setLoadingStage(index + 1), stage.delay)
    ));

    return () => timers.forEach(window.clearTimeout);
  }, [status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMatches([]);
    }
    e.target.value = '';
  };

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleSearch = async () => {
    if (!file || !selectedRegion || !selectedSport || !selectedDate) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Você precisa estar logado");

      const formData = new FormData();
      formData.append('file', file);
      formData.append('filter_region_id', selectedRegion);
      formData.append('filter_sport_id', selectedSport);
      formData.append('filter_event_date', selectedDate);
      if (selectedPhotographer) formData.append('filter_photographer_id', selectedPhotographer);

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-face`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Erro ao buscar fotos");
      }

      if (result.matches && result.matches.length > 0) {
        setMatches(result.matches);
        setStatus('success');
      } else {
        setStatus('empty');
      }

    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao buscar fotos');
      setStatus('error');
    }
  };

  const isSearchDisabled = !file || status === 'loading' || !selectedRegion || !selectedSport || !selectedDate;

  return (
    <div className="mt-12 bg-card border border-border rounded-2xl p-6 md:p-8 card-shadow">
      <div className="text-center mb-8">
        <h2 className="font-bold italic text-2xl text-foreground mb-2">Busca por Reconhecimento Facial</h2>
        <p className="text-muted-foreground">Preencha os dados do evento e envie uma selfie para encontrarmos suas fotos.</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">Região *</label>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            >
              <option value="">Selecione...</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Esporte *</label>
            <select
              value={selectedSport}
              onChange={e => setSelectedSport(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            >
              <option value="">Selecione...</option>
              {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Data do Evento *</label>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            >
              <option value="">Selecione...</option>
              {dates.map(d => {
                const [y, m, day] = d.split('-');
                return <option key={d} value={d}>{`${day}/${m}/${y}`}</option>
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Fotógrafo</label>
            <select
              value={selectedPhotographer}
              onChange={e => setSelectedPhotographer(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            >
              <option value="">Todos (Opcional)</option>
              {photographers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Upload Area */}
        <div className="relative border-2 border-dashed border-primary/30 rounded-xl p-8 text-center hover:bg-primary/5 transition-colors">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={cameraInputRef}
            capture="user"
            onChange={handleFileChange}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={galleryInputRef}
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-primary">
                {previewUrl && <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />}
              </div>
              <p className="font-medium text-foreground mb-6">{file.name}</p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-lg font-bold hover:opacity-90 transition-opacity"
                  >
                    <Camera size={18} />
                    <span>Nova selfie</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-2 px-4 rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                  <ImageIcon size={18} />
                  <span>Trocar foto</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Camera size={32} className="text-primary" />
              </div>
              <p className="font-medium text-foreground mb-2">Envie uma foto do seu rosto</p>
              <p className="text-sm mb-6">JPEG, PNG até 5MB</p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-lg font-bold hover:opacity-90 transition-opacity"
                  >
                    <Camera size={18} />
                    <span>Tirar selfie</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-2 px-4 rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                  <ImageIcon size={18} />
                  <span>Galeria</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleSearch}
          disabled={isSearchDisabled}
          aria-busy={status === 'loading'}
          aria-live="polite"
          className={`relative w-full min-h-[68px] overflow-hidden rounded-xl px-5 text-primary-foreground transition-all duration-500 ${
            status === 'loading'
              ? 'cursor-wait bg-gradient-to-r from-primary via-emerald-500 to-primary bg-[length:200%_100%] shadow-[0_12px_36px_-12px_hsl(var(--primary)/0.8)]'
              : isSearchDisabled
                ? 'cursor-not-allowed bg-primary/45 shadow-none'
                : 'bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
          }`}
        >
          {status === 'loading' ? (
            <div className="relative z-10 flex items-center justify-center gap-3 py-2">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Loader2 className="animate-spin" size={21} strokeWidth={2.2} />
                <Sparkles className="absolute -right-1 -top-1 animate-pulse text-white" size={12} />
              </span>
              <span className="min-w-0 text-left leading-tight">
                <span className="block text-sm font-bold tracking-wide">
                  {loadingStages[loadingStage].title}
                </span>
                <span className="mt-1 block text-[11px] font-normal text-primary-foreground/80">
                  {loadingStages[loadingStage].description}
                </span>
              </span>
            </div>
          ) : (
            <span className="flex items-center justify-center gap-2 py-3 font-bold">
              <Upload size={20} />
              <span>Buscar Minhas Fotos</span>
            </span>
          )}
          {status === 'loading' && (
            <span className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/10" aria-hidden="true">
              <span className="block h-full w-1/3 animate-calm-progress rounded-full bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            </span>
          )}
        </button>

        {/* Feedback States */}
        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3 text-red-500">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}

        {status === 'empty' && (
          <div className="bg-secondary/50 rounded-lg p-6 text-center border border-border flex flex-col items-center">
            <p className="font-medium text-foreground">Nenhuma foto encontrada</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Não encontramos fotos correspondentes na combinação selecionada.</p>
            <div className="bg-card p-4 rounded-xl border border-primary/20 shadow-sm w-full">
              <p className="font-bold text-sm mb-3">Ainda quer participar e ganhar patrocínio esportivo?</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-primary text-primary-foreground text-xs font-bold py-2 px-4 rounded-lg hover:bg-secondary transition-colors"
              >
                VER CAMPANHAS DISPONÍVEIS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Grid */}
      {status === 'success' && matches.length > 0 && (
        <div className="mt-12 pt-8 border-t border-border">
          <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
            <ImageIcon className="text-primary" />
            <span>Encontramos {matches.length} {matches.length === 1 ? 'foto' : 'fotos'} suas!</span>
          </h3>
          <div className="space-y-6">
            {matchesByPhotographer.map((photographer) => (
              <section
                key={photographer.id}
                className="overflow-hidden rounded-2xl border border-border bg-background/30 shadow-sm"
              >
                <header className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10">
                    {photographer.photoUrl ? (
                      <img
                        src={photographer.photoUrl}
                        alt={`Foto de perfil de ${photographer.name}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <UserRound size={19} className="text-primary" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{photographer.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Fotógrafo do evento · {photographer.matches.length} {photographer.matches.length === 1 ? 'foto encontrada' : 'fotos encontradas'}
                    </p>
                  </div>
                </header>

                <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {photographer.matches.map((match) => (
                    <div key={match.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-black/90 group-hover:opacity-90">
                        <img
                          src={match.image_url}
                          alt="Sua foto"
                          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="pointer-events-none absolute inset-0 flex -rotate-12 scale-150 select-none flex-wrap content-start justify-center gap-4 p-4 opacity-50">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <span key={i} className="text-sm font-bold tracking-widest text-white drop-shadow-md text-center">Participe da campanha. Libere sua foto - 3BUK</span>
                          ))}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="p-4">
                        <p className="truncate text-sm font-bold text-foreground" title={match.event_label}>
                          {match.event_label}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Match: {Math.round(match.similarity * 100)}%
                        </p>
                        <button
                          onClick={() => handleDownload(match.id, match.image_url)}
                          className="mt-3 block w-full rounded-lg bg-secondary py-2 text-center text-xs font-bold text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          Baixar Foto
                        </button>
                        <button
                          onClick={() => setCampaignPhoto({ id: match.id, imageUrl: match.image_url })}
                          className="mt-2 block w-full rounded-lg bg-primary py-2 text-center text-xs font-bold text-primary-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                        >
                          Usar na minha campanha
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <PhotoCampaignModal 
        photo={campaignPhoto} 
        isForDownload={isDownloadIntent}
        onSuccess={() => {
          if (campaignPhoto && isDownloadIntent) {
            executeDownload(campaignPhoto.id, campaignPhoto.imageUrl);
          }
        }}
        onClose={() => {
          setCampaignPhoto(null);
          setIsDownloadIntent(false);
        }} 
      />
    </div>
  );
};
