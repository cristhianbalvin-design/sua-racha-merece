import { useState } from 'react';
import { Camera, Upload, Loader2, AlertCircle, ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMatches([]);
    }
  };

  const handleSearch = async () => {
    if (!file) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Você precisa estar logado");

      const formData = new FormData();
      formData.append('file', file);

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

  return (
    <div className="mt-12 bg-card border border-border rounded-2xl p-6 md:p-8 card-shadow">
      <div className="text-center mb-8">
        <h2 className="font-bold italic text-2xl text-foreground mb-2">Busca por Reconhecimento Facial</h2>
        <p className="text-muted-foreground">Envie uma selfie para encontrarmos suas fotos nos eventos da 3BUK.</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
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
          disabled={!file || status === 'loading'}
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
          <div className="bg-secondary/50 rounded-lg p-6 text-center border border-border">
            <p className="font-medium text-foreground">Nenhuma foto encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Não encontramos fotos correspondentes ao seu rosto nos nossos eventos recentes.</p>
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
                <div className="aspect-[4/3] bg-muted relative">
                  <img 
                    src={match.image_url} 
                    alt="Sua foto" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
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
                  <a 
                    href={match.image_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="mt-3 block w-full text-center bg-secondary text-secondary-foreground text-xs font-bold py-2 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Baixar Foto
                  </a>
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
