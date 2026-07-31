import { useState, useEffect } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { Navigate } from 'react-router-dom';
import { apiGetRegionsWithId, apiGetSportsWithId, apiGetUniqueCities, apiGetPhotographers, Photographer } from '@/lib/mockApi';


interface UploadJob {
  file: File;
  status: 'pending' | 'uploading' | 'retrying' | 'success' | 'error';
  errorMsg?: string;
  retryCount?: number;
}

const AdminEventPhotos = () => {
  if (!SHOW_FACE_SEARCH) {
    return <Navigate to="/admin/dashboard" />;
  }

  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // New states for optional fields
  const [regions, setRegions] = useState<{id: string, name: string}[]>([]);
  const [sports, setSports] = useState<{id: string, name: string}[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);

  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedPhotographer, setSelectedPhotographer] = useState('');
  const [selectedDate, setSelectedDate] = useState('');


  useEffect(() => {
    // Fetch lists
    apiGetRegionsWithId().then(setRegions).catch(console.error);
    apiGetSportsWithId().then(setSports).catch(console.error);
    apiGetUniqueCities().then(setCities).catch(console.error);
    apiGetPhotographers().then(setPhotographers).catch(console.error);
  }, []);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newJobs: UploadJob[] = Array.from(e.target.files).map(file => ({
        file,
        status: 'pending'
      }));
      setJobs(prev => [...prev, ...newJobs]);
    }
  };

  const removeJob = (index: number) => {
    if (isUploading) return;
    setJobs(prev => prev.filter((_, i) => i !== index));
  };

  const startUpload = async () => {
    const pendingJobs = jobs.map((job, index) => ({ job, index })).filter(j => j.job.status === 'pending' || j.job.status === 'error');
    
    if (pendingJobs.length === 0) {
      toast.info('Não há fotos pendentes para enviar');
      return;
    }

    setIsUploading(true);

    const CONCURRENCY_LIMIT = 3;
    const MAX_RETRIES = 3;

    const uploadSinglePhoto = async (job: UploadJob, index: number) => {
      let attempt = 0;
      let lastError: Error | null = null;
      
      while (attempt < MAX_RETRIES) {
        try {
          if (attempt === 0) {
            setJobs(prev => { const n = [...prev]; n[index].status = 'uploading'; return n; });
          } else {
            setJobs(prev => { const n = [...prev]; n[index].status = 'retrying'; n[index].retryCount = attempt; return n; });
          }

          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) throw new Error("Sessão não encontrada");

          const formData = new FormData();
          formData.append('file', job.file);
          formData.append('region_id', selectedRegion);
          formData.append('sport_id', selectedSport);
          formData.append('city', selectedCity);
          formData.append('photographer_id', selectedPhotographer);
          formData.append('event_date', selectedDate);

          const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-event-photo`;
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || result.message || "Erro desconhecido ao processar foto");
          }

          setJobs(prev => { const n = [...prev]; n[index].status = 'success'; return n; });
          return; // Success, exit retry loop

        } catch (err: any) {
          lastError = err;
          attempt++;
          if (attempt < MAX_RETRIES) {
            // Wait 1.5 seconds before retrying to allow transient errors to clear
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }

      // If we exit loop without returning, it means we failed all retries
      setJobs(prev => {
        const n = [...prev];
        n[index].status = 'error';
        n[index].errorMsg = lastError?.message || 'Erro após reintentos';
        return n;
      });
    };

    // Run uploads with concurrency limit by chunking
    for (let i = 0; i < pendingJobs.length; i += CONCURRENCY_LIMIT) {
      const chunk = pendingJobs.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(chunk.map(item => uploadSinglePhoto(item.job, item.index)));
    }

    setIsUploading(false);
    toast.success('Processamento concluído');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fotos de Eventos</h1>
          <p className="text-muted-foreground">Upload de fotos em lote para reconhecimento facial.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detalhes do Evento</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Data do Evento <span className="text-red-500">*</span></label>
            <input 
              type="date"
              className="w-full bg-background border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-primary"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isUploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Região <span className="text-red-500">*</span></label>
            <select 
              className="w-full bg-background border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-primary"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              disabled={isUploading}
            >
              <option value="">-- Nenhuma --</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Esporte <span className="text-red-500">*</span></label>
            <select 
              className="w-full bg-background border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-primary"
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              disabled={isUploading}
            >
              <option value="">-- Nenhum --</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Cidade <span className="text-red-500">*</span></label>
            <input 
              type="text"
              list="cities-list"
              className="w-full bg-background border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-primary"
              placeholder="Ex: São Paulo"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={isUploading}
            />
            <datalist id="cities-list">
              {cities.map((city, i) => (
                <option key={i} value={city} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Fotógrafo <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <select 
                className="w-full bg-background border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-primary"
                value={selectedPhotographer}
                onChange={(e) => setSelectedPhotographer(e.target.value)}
                disabled={isUploading}
              >
                <option value="">-- Nenhum --</option>
                {photographers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <label className="block text-sm font-medium text-foreground mb-2">Selecionar Fotos</label>
          <div className="flex items-center gap-4">
            <label className={`cursor-pointer inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors font-medium ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload size={18} />
              Escolher arquivos...
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
            <span className="text-sm text-muted-foreground">
              {jobs.length} arquivo(s) selecionado(s)
            </span>
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="border border-border rounded-md overflow-hidden bg-background">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">Arquivo</th>
                    <th className="px-4 py-3 font-medium">Tamanho</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job, index) => (
                    <tr key={index} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 flex items-center gap-3">
                        <ImageIcon size={16} className="text-muted-foreground flex-shrink-0" />
                        <span className="truncate max-w-[200px] md:max-w-xs">{job.file.name}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(job.file.size / 1024 / 1024).toFixed(2)} MB
                      </td>
                      <td className="px-4 py-3">
                        {job.status === 'pending' && <span className="text-muted-foreground text-xs font-medium bg-muted px-2 py-1 rounded-full">Pendente</span>}
                        {job.status === 'uploading' && <span className="text-blue-500 text-xs font-medium bg-blue-500/10 px-2 py-1 rounded-full flex items-center gap-1 w-max"><Loader2 size={12} className="animate-spin" /> Enviando</span>}
                        {job.status === 'retrying' && <span className="text-orange-500 text-xs font-medium bg-orange-500/10 px-2 py-1 rounded-full flex items-center gap-1 w-max"><Loader2 size={12} className="animate-spin" /> Reenviando ({job.retryCount}/3)</span>}
                        {job.status === 'success' && <span className="text-green-500 text-xs font-medium bg-green-500/10 px-2 py-1 rounded-full flex items-center gap-1 w-max"><CheckCircle size={12} /> Sucesso</span>}
                        {job.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-500 text-xs font-medium bg-red-500/10 px-2 py-1 rounded-full w-max">
                            <AlertCircle size={12} /> Falha: {job.errorMsg}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => removeJob(index)}
                          disabled={isUploading || job.status === 'uploading' || job.status === 'retrying'}
                          className="text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
              <button
                onClick={startUpload}
                disabled={isUploading || jobs.every(j => j.status === 'success') || !selectedRegion || !selectedSport || !selectedCity || !selectedPhotographer || !selectedDate}
                className="bg-primary text-primary-foreground font-bold px-6 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isUploading ? 'Processando...' : 'Iniciar Upload'}
              </button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default AdminEventPhotos;
