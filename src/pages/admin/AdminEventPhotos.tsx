import { useState, useEffect } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { Navigate } from 'react-router-dom';

interface Campaign {
  id: string;
  title: string;
}

interface UploadJob {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMsg?: string;
}

const AdminEventPhotos = () => {
  if (!SHOW_FACE_SEARCH) {
    return <Navigate to="/admin/dashboard" />;
  }

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, title')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setCampaigns(data);
      }
    };
    fetchCampaigns();
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
    if (!selectedCampaign) {
      toast.error('Selecione uma campanha primeiro');
      return;
    }

    const pendingJobs = jobs.map((job, index) => ({ job, index })).filter(j => j.job.status === 'pending' || j.job.status === 'error');
    
    if (pendingJobs.length === 0) {
      toast.info('Não há fotos pendentes para enviar');
      return;
    }

    setIsUploading(true);

    for (const { job, index } of pendingJobs) {
      // Mark as uploading
      setJobs(prev => {
        const newJobs = [...prev];
        newJobs[index].status = 'uploading';
        return newJobs;
      });

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Sessão não encontrada");

        const formData = new FormData();
        formData.append('file', job.file);
        formData.append('campaign_id', selectedCampaign);

        // Fetch direct to functions URL since supabase.functions.invoke sometimes messes up FormData content-type boundary
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

        // Mark as success
        setJobs(prev => {
          const newJobs = [...prev];
          newJobs[index].status = 'success';
          return newJobs;
        });

      } catch (err: any) {
        // Mark as error
        setJobs(prev => {
          const newJobs = [...prev];
          newJobs[index].status = 'error';
          newJobs[index].errorMsg = err.message;
          return newJobs;
        });
      }
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
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Campanha / Evento</label>
          <select 
            className="w-full max-w-md bg-background border border-input rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            disabled={isUploading}
          >
            <option value="">-- Selecione uma campanha --</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <div>
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
                          disabled={isUploading || job.status === 'uploading'}
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
                disabled={isUploading || jobs.every(j => j.status === 'success')}
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
