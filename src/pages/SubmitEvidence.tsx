import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, ImageIcon, Film } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCampaigns, apiGetParticipations, apiUpdateParticipation, apiUploadEvidence } from '@/lib/mockApi';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const MAX_PHOTOS = 1;
const MAX_VIDEOS = 1;
const MAX_IG = 1;

const MAX_VIDEO_DURATION_SECONDS = 10;

const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject("Error cargando el video");
    };
    video.src = URL.createObjectURL(file);
  });
};

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
  const [igScreenshot, setIgScreenshot] = useState<File | null>(null);
  
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [igPreview, setIgPreview] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const igInputRef = useRef<HTMLInputElement>(null);

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
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_PHOTOS} fotos alcanzado.`); return; }
    const toAdd = selected.slice(0, remaining);
    if (selected.length > remaining) toast.warning(`Se añadió solo 1 foto.`);
    setPhotos(prev => [...prev, ...toAdd]);
    setPhotoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_VIDEOS - videos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_VIDEOS} videos alcanzado.`); return; }
    
    const toProcess = selected.slice(0, remaining);
    const validFiles: File[] = [];

    for (const file of toProcess) {
      try {
        const duration = await getVideoDuration(file);
        // Margen extra pequeño por redondeos de algunas cámaras
        if (duration > MAX_VIDEO_DURATION_SECONDS + 0.5) {
          toast.error(`El video "${file.name}" supera los 10 segundos (dura aprox. ${Math.round(duration)}s).`);
        } else {
          validFiles.push(file);
        }
      } catch (err) {
        toast.error(`No se pudo verificar la duración del video "${file.name}".`);
      }
    }

    if (selected.length > remaining) toast.warning(`Solo se puede subir ${MAX_VIDEOS} video.`);
    
    if (validFiles.length > 0) {
      setVideos(prev => [...prev, ...validFiles]);
      setVideoPreviews(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);
    }
    e.target.value = '';
  };

  const handleIgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIgScreenshot(file);
      setIgPreview(URL.createObjectURL(file));
    }
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

  const removeIg = () => {
    setIgScreenshot(null);
    setIgPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0 || videos.length === 0 || comment.trim() === '') {
      toast.error('Adiciona una foto, un video y un comentario para participar.');
      return;
    }
    if (instagram && !igScreenshot) {
      toast.error('Por favor, añade la captura de pantalla de Instagram o desmarca la opción.');
      return;
    }
    if (!participationId || !user) return;

    setIsUploading(true);
    toast.loading('Subiendo archivos...', { id: 'upload-evidence' });

    // Subida óptima: concurrente con Promise.all
    const [photoUrls, videoUrls, igUrlResult] = await Promise.all([
      Promise.all(photos.map(file => apiUploadEvidence(file, user.id))),
      Promise.all(videos.map(file => apiUploadEvidence(file, user.id))),
      igScreenshot ? apiUploadEvidence(igScreenshot, user.id) : Promise.resolve(undefined)
    ]);

    const uploadedPhotoUrls = photoUrls.filter((url): url is string => url !== null);
    const uploadedVideoUrls = videoUrls.filter((url): url is string => url !== null);
    const igUrl = igUrlResult || undefined;

    if (uploadedPhotoUrls.length === 0 && uploadedVideoUrls.length === 0 && !igUrl) {
      toast.error('Error al subir los archivos. Por favor intenta nuevamente.', { id: 'upload-evidence' });
      setIsUploading(false);
      return;
    }

    // Combine photos and videos into 'media' photo parameter array if backend merges it, or just use the first available picture as the primary photo.
    const allMediaUrls = [...uploadedPhotoUrls, ...uploadedVideoUrls];

    await apiUpdateParticipation(participationId, {
      participationStatus: 'Concluído',
      comment,
      instagram,
      photo: allMediaUrls, // Passing the array so mockApi handles it seamlessly
      instagramPhoto: igUrl,
    });

    toast.success(`¡Archivos subidos exitosamente!`, { id: 'upload-evidence' });
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
              ← Volver
            </Link>

            <h1 className="font-bold italic text-2xl text-foreground mb-2 uppercase">Registrar Participación</h1>
            <p className="text-muted-foreground text-sm mb-6">{campaign.sport} — {campaign.city}</p>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Photos section */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-ui text-xs text-muted-foreground uppercase font-bold flex items-center gap-1">
                    FOTOS <span className="text-destructive">(OBLIGATORIO)</span> <span className="text-primary ml-1">{photos.length}/{MAX_PHOTOS}</span>
                  </label>
                  {photos.length < MAX_PHOTOS && (
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                      <ImageIcon size={12} /> Para añadir
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground mb-3">Sube una foto mostrando tu mejor actitud mientras practicas tu deporte favorito.</p>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

                {photoPreviews.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 mb-2">
                    {photoPreviews.map((src, i) => (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative h-48 rounded-xl overflow-hidden group">
                        <img src={src} className="w-full h-full object-cover" alt={`photo-${i}`} />
                        <button type="button" onClick={() => removePhoto(i)}
                          className="absolute top-2 right-2 bg-background/80 text-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <label onClick={() => photoInputRef.current?.click()}
                    className="w-full h-28 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/40 text-muted-foreground hover:bg-muted/80 transition-all border border-dashed border-border/50">
                    <ImageIcon size={24} />
                    <span className="text-xs">Hasta 1 foto</span>
                  </label>
                )}
              </div>

              {/* Videos section */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-ui text-xs text-muted-foreground uppercase font-bold flex items-center gap-1">
                    VIDEOS <span className="text-destructive">(OBLIGATORIO)</span> <span className="text-primary ml-1">{videos.length}/{MAX_VIDEOS}</span>
                  </label>
                  {videos.length < MAX_VIDEOS && (
                    <button type="button" onClick={() => videoInputRef.current?.click()}
                      className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                      <Film size={12} /> Para añadir
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground mb-3">Sube un video mostrando como vives tu deporte favorito <strong className="text-accent">(máximo 10 segundos)</strong>.</p>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />

                {videoPreviews.length > 0 ? (
                  <div className="space-y-2">
                    {videos.map((v, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 bg-card rounded-xl px-3 py-3 card-shadow border border-border/50">
                        <Film size={20} className="text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground font-bold truncate flex-1">{v.name}</span>
                        <button type="button" onClick={() => removeVideo(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <label onClick={() => videoInputRef.current?.click()}
                    className="w-full h-20 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/40 text-muted-foreground hover:bg-muted/80 transition-all border border-dashed border-border/50">
                    <Film size={24} />
                    <span className="text-xs">Hasta 1 video (Máx 10s)</span>
                  </label>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-2">
                  COMENTARIO <span className="text-destructive">(OBLIGATORIO)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all resize-none h-24"
                  placeholder="Ejemplo: ¡El mejor entrenamiento de la semana!"
                />
              </div>

              {/* Timestamp */}
              <div className="bg-card rounded-xl p-3 card-shadow border border-border/50">
                <span className="text-ui text-xs text-muted-foreground font-bold uppercase">MARCA DE TIEMPO</span>
                <p className="text-foreground text-sm font-bold mt-1">{timestamp}</p>
              </div>

              {/* Instagram Screenshot Section */}
              {String(campaign.instagramOptional) === 'true' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setInstagram(!instagram)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${instagram ? 'bg-primary' : 'bg-muted border border-border'}`}
                    >
                      {instagram && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                    </div>
                    <span className="text-foreground text-sm font-bold">
                      Lo publiqué en Instagram con el <span className="text-accent">hashtag {campaign.instagramHashtags || '#3bukchallenge'}</span>
                    </span>
                  </label>

                  {instagram && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1">
                        CAPTURA DE PANTALLA DE INSTAGRAM (OPCIONAL)
                      </label>
                      <input ref={igInputRef} type="file" accept="image/*" className="hidden" onChange={handleIgChange} />
                      
                      {igPreview ? (
                        <div className="relative h-48 rounded-xl overflow-hidden group border border-border/50">
                          <img src={igPreview} className="w-full h-full object-cover" alt="Instagram screenshot" />
                          <button type="button" onClick={removeIg}
                            className="absolute top-2 right-2 bg-background/80 text-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label onClick={() => igInputRef.current?.click()}
                          className="w-full py-6 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer text-accent hover:bg-accent/10 transition-all border border-dashed border-accent">
                          <div className="flex items-center gap-2">
                            <Upload size={18} />
                            <span className="text-sm font-bold">Adjunta una captura de pantalla de Instagram.</span>
                          </div>
                        </label>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              <motion.button
                type="submit"
                disabled={isUploading || photos.length === 0 || videos.length === 0 || comment.trim() === '' || (instagram && !igScreenshot)}
                whileHover={!isUploading ? { scale: 1.03 } : {}}
                whileTap={!isUploading ? { scale: 0.97 } : {}}
                transition={spring}
                className={`w-full text-primary-foreground text-ui py-4 rounded-xl btn-shadow text-base transition-all ${
                  isUploading || photos.length === 0 || videos.length === 0 || comment.trim() === '' || (instagram && !igScreenshot)
                    ? 'bg-primary/50 cursor-not-allowed'
                    : 'bg-primary hover:btn-shadow-hover'
                }`}
              >
                {isUploading ? 'SUBIENDO...' : 'ENVÍA TU PARTICIPACIÓN'}
              </motion.button>
              
              <div className="flex justify-center mt-4">
                <Link to={`/campanha/${id}`} className="text-muted-foreground text-sm font-bold hover:text-foreground">
                  CANCELAR
                </Link>
              </div>
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
              ¡Participación enviada!
            </h2>
            <p className="text-muted-foreground mb-2">
              Ahora está en manos del administrador. ¡Buena suerte!
            </p>
            <div className="inline-block bg-warning/20 text-warning text-sm font-bold px-4 py-2 rounded-full mt-4 mb-8">
              🟡 En evaluación
            </div>
            <div>
              <Link to="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="bg-primary text-primary-foreground text-ui px-8 py-3 rounded-xl btn-shadow"
                >
                  VOLVER AL INICIO
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
