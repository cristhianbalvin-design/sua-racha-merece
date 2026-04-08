import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, ImageIcon, Film } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCampaigns, apiGetParticipations, apiUpdateParticipation, apiUploadEvidence } from '@/lib/mockApi';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const MAX_PHOTOS = 5;
const MAX_VIDEOS = 2;

const SubmitEvidence = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [participationId, setParticipationId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [instagram, setInstagram] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Multi-file state
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGetCampaigns().then(camps => {
      setCampaign(camps.find(c => c.id === id) || null);
    });
  }, [id]);

  useEffect(() => {
    if (user && id) {
      apiGetParticipations().then(parts => {
        const existing = parts.find(p => p.campaignId === id && p.userId === user.id);
        if (existing) setParticipationId(existing.id);
      });
    }
  }, [user, id]);

  const now = new Date();
  const timestamp = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  if (!campaign) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_PHOTOS} fotos atingido.`); return; }
    const toAdd = selected.slice(0, remaining);
    if (selected.length > remaining) toast.warning(`Apenas ${remaining} foto(s) adicionada(s). Limite é ${MAX_PHOTOS}.`);
    setPhotos(prev => [...prev, ...toAdd]);
    setPhotoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_VIDEOS - videos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_VIDEOS} vídeos atingido.`); return; }
    const toAdd = selected.slice(0, remaining);
    if (selected.length > remaining) toast.warning(`Apenas ${remaining} vídeo(s) adicionado(s). Limite é ${MAX_VIDEOS}.`);
    setVideos(prev => [...prev, ...toAdd]);
    setVideoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const removeVideo = (i: number) => {
    setVideos(prev => prev.filter((_, idx) => idx !== i));
    setVideoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0 && videos.length === 0) {
      toast.error('Adicione ao menos uma foto ou vídeo.');
      return;
    }
    if (!participationId || !user) return;

    setIsUploading(true);
    toast.loading('Enviando arquivos...', { id: 'upload-evidence' });

    // Upload all files and collect URLs
    const allFiles = [...photos, ...videos];
    const uploadedUrls: string[] = [];
    for (const file of allFiles) {
      const url = await apiUploadEvidence(file, user.id);
      if (url) uploadedUrls.push(url);
    }

    if (uploadedUrls.length === 0) {
      toast.error('Erro ao enviar arquivos. Tente novamente.', { id: 'upload-evidence' });
      setIsUploading(false);
      return;
    }

    // Use first uploaded URL as the participation "photo" (primary evidence)
    await apiUpdateParticipation(participationId, {
      participationStatus: 'Concluído',
      comment,
      instagram,
      photo: uploadedUrls[0],
    });

    toast.success(`${uploadedUrls.length} arquivo(s) enviado(s) com sucesso!`, { id: 'upload-evidence' });
    setSubmitted(true);
    setIsUploading(false);
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Link to={`/campanha/${id}`} className="text-muted-foreground text-sm mb-4 block hover:text-foreground transition-colors">
              ← Voltar
            </Link>

            <h1 className="font-bold italic text-2xl text-foreground mb-2">ENVIAR PARTICIPAÇÃO</h1>
            <p className="text-muted-foreground text-sm mb-6">{campaign.sport} — {campaign.city}</p>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Photos section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-ui text-xs text-muted-foreground">
                    FOTOS <span className="text-primary font-bold">{photos.length}/{MAX_PHOTOS}</span>
                  </label>
                  {photos.length < MAX_PHOTOS && (
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                      <ImageIcon size={12} /> Adicionar foto
                    </button>
                  )}
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />

                {photoPreviews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {photoPreviews.map((src, i) => (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-square rounded-xl overflow-hidden group">
                        <img src={src} className="w-full h-full object-cover" alt={`photo-${i}`} />
                        <button type="button" onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 bg-background/80 text-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <button type="button" onClick={() => photoInputRef.current?.click()}
                        className="aspect-square rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors border-2 border-dashed border-border">
                        <Upload size={20} />
                      </button>
                    )}
                  </div>
                ) : (
                  <label onClick={() => photoInputRef.current?.click()}
                    className="w-full h-28 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted text-muted-foreground hover:bg-muted/80 transition-all border-2 border-dashed border-border">
                    <ImageIcon size={28} />
                    <span className="text-sm font-bold">Adicionar fotos</span>
                    <span className="text-xs">Até {MAX_PHOTOS} fotos</span>
                  </label>
                )}
              </div>

              {/* Videos section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-ui text-xs text-muted-foreground">
                    VÍDEOS <span className="text-primary font-bold">{videos.length}/{MAX_VIDEOS}</span>
                  </label>
                  {videos.length < MAX_VIDEOS && (
                    <button type="button" onClick={() => videoInputRef.current?.click()}
                      className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                      <Film size={12} /> Adicionar vídeo
                    </button>
                  )}
                </div>
                <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVideoChange} />

                {videoPreviews.length > 0 ? (
                  <div className="space-y-2">
                    {videos.map((v, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 bg-card rounded-xl px-3 py-2 card-shadow">
                        <Film size={20} className="text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground font-bold truncate flex-1">{v.name}</span>
                        <button type="button" onClick={() => removeVideo(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X size={16} />
                        </button>
                      </motion.div>
                    ))}
                    {videos.length < MAX_VIDEOS && (
                      <button type="button" onClick={() => videoInputRef.current?.click()}
                        className="w-full h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center gap-2 text-sm hover:bg-muted/80 transition-colors border-2 border-dashed border-border">
                        <Upload size={16} /> Adicionar outro vídeo
                      </button>
                    )}
                  </div>
                ) : (
                  <label onClick={() => videoInputRef.current?.click()}
                    className="w-full h-20 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted text-muted-foreground hover:bg-muted/80 transition-all border-2 border-dashed border-border">
                    <Film size={24} />
                    <span className="text-sm font-bold">Adicionar vídeos</span>
                    <span className="text-xs">Até {MAX_VIDEOS} vídeos</span>
                  </label>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="text-ui text-xs text-muted-foreground block mb-2">
                  COMENTÁRIO CURTO (OPCIONAL)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all resize-none h-24"
                  placeholder="Ex: Melhor treino da semana!"
                />
              </div>

              {/* Timestamp */}
              <div className="bg-card rounded-xl p-3 card-shadow">
                <span className="text-ui text-xs text-muted-foreground">TIMESTAMP</span>
                <p className="text-foreground text-sm font-bold mt-1">{timestamp}</p>
              </div>

              {/* Instagram checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setInstagram(!instagram)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${instagram ? 'bg-primary' : 'bg-muted'}`}
                >
                  {instagram && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                </div>
                <span className="text-foreground text-sm">
                  Publiquei no Instagram com <span className="text-accent font-bold">#3bukchallenge</span> ✓
                </span>
              </label>

              <motion.button
                type="submit"
                disabled={isUploading || (photos.length === 0 && videos.length === 0)}
                whileHover={!isUploading ? { scale: 1.03 } : {}}
                whileTap={!isUploading ? { scale: 0.97 } : {}}
                transition={spring}
                className={`w-full text-primary-foreground text-ui py-4 rounded-xl btn-shadow text-base transition-all ${
                  isUploading || (photos.length === 0 && videos.length === 0)
                    ? 'bg-primary/50 cursor-not-allowed'
                    : 'bg-primary hover:btn-shadow-hover'
                }`}
              >
                {isUploading ? 'ENVIANDO...' : 'ENVIAR PARTICIPAÇÃO'}
              </motion.button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="text-center py-16"
          >
            <span className="text-6xl block mb-4">🔥</span>
            <h2 className="font-bold italic text-2xl text-foreground mb-3">
              Participação enviada!
            </h2>
            <p className="text-muted-foreground mb-2">
              Agora é com o admin. Boa sorte!
            </p>
            <div className="inline-block bg-warning/20 text-warning text-sm font-bold px-4 py-2 rounded-full mt-4 mb-8">
              🟡 Em avaliação
            </div>
            <div>
              <Link to="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="bg-primary text-primary-foreground text-ui px-8 py-3 rounded-xl btn-shadow"
                >
                  VOLTAR AO INÍCIO
                </motion.button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubmitEvidence;
