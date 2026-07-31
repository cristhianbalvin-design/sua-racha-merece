import { useState, useEffect } from 'react';
import { Camera, Upload, Loader2, AlertCircle, ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Match {
  id: string;
  image_url: string;
  similarity: number;
  campaign_id?: string;
  event_label?: string;
  photographer_name?: string | null;
}

export const FaceSearchSection = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  const [matches, setMatches] = useState<Match[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters state
  const [regions, setRegions] = useState<{id: string, name: string}[]>([]);
  const [sports, setSports] = useState<{id: string, name: string}[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [photographers, setPhotographers] = useState<{id: string, name: string}[]>([]);

  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPhotographer, setSelectedPhotographer] = useState('');

  const handleDownload = async (matchId: string, imageUrl: string) => {
    try {
      toast.loading('Verificando permissão...', { id: 'download' });
      const { data, error } = await supabase.rpc('check_and_register_download', { p_event_photo_id: matchId });
      if (error) throw error;

      if (data.allowed) {
        toast.success('Download iniciado!', { id: 'download' });
        const link = document.createElement('a');
        link.href = imageUrl;
        link.target = '_blank';
        link.download = `foto_${matchId}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast('Limite atingido', {
           id: 'download',
           description: 'Você já usou suas 3 descargas grátis. Participe de uma campanha ativa para continuar baixando sem limites.',
           action: {
             label: 'Ver Campanhas',
             onClick: () => navigate('/dashboard')
           },
           duration: 6000,
        });
      }
    } catch (err: any) {
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

        data.forEach((row: any) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMatches([]);
    }
  };

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

    } catch (err: any) {
      setErrorMsg(err.message);
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
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-primary">
                <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-primary mt-2">Clique para trocar a foto</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Camera size={32} className="text-primary" />
              </div>
              <p className="font-medium text-foreground mb-1">Tire uma selfie ou escolha uma foto</p>
              <p className="text-sm">JPEG, PNG até 5MB</p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleSearch}
          disabled={isSearchDisabled}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex justify-center items-center gap-2"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Analisando seu rosto...</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span>Buscar Minhas Fotos</span>
            </>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <div key={match.id} className="group relative rounded-xl overflow-hidden border border-border bg-card">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden group-hover:opacity-90">
                  <img
                    src={match.image_url}
                    alt="Sua foto"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 pointer-events-none opacity-20 flex flex-wrap content-start justify-center gap-4 p-4 -rotate-12 scale-150 select-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <span key={i} className="text-white font-black text-2xl tracking-widest drop-shadow-md">3BUK</span>
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-4">
                  <p className="font-bold text-sm text-foreground truncate" title={match.event_label}>
                    {match.event_label}
                  </p>
                  {match.photographer_name && (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={`Foto: ${match.photographer_name}`}>
                      Foto: {match.photographer_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Match: {Math.round(match.similarity * 100)}%
                  </p>
                  <button
                    onClick={() => handleDownload(match.id, match.image_url)}
                    className="mt-3 block w-full text-center bg-secondary text-secondary-foreground text-xs font-bold py-2 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Baixar Foto
                  </button>
                  <button
                    onClick={() => navigate('/participacoes', { state: { autoPhotoUrl: match.image_url } })}
                    className="mt-2 block w-full text-center bg-primary text-primary-foreground text-xs font-bold py-2 rounded-lg hover:bg-secondary hover:text-secondary-foreground transition-colors"
                  >
                    Usar na minha campanha
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
