import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, Check, ImageIcon, Film, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiGetParticipations, apiGetCampaigns, apiUpdateParticipation, apiUploadEvidence } from '@/lib/mockApi';
import { Participation, Campaign } from '@/data/mockData';
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };
const MAX_PHOTOS = 1;
const MAX_VIDEOS = 1;

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

const sportIconFallback: Record<string, string> = {
  'Corrida': '🏃', 'Crossfit': '🏋️', 'Ciclismo': '🚴',
  'Natação': '🏊', 'Futebol': '⚽', 'Basquete': '🏀',
  'Vôlei': '🏐', 'Tênis': '🎾', 'Boxe': '🥊', 'Nadar': '🏊',
};

// DB stores lowercase, display as uppercase
const normalizeStatus = (s: string) => {
  const map: Record<string, string> = {
    'Em curso': 'EM CURSO',
    'Concluído': 'CONCLUÍDO',
    'Não concluído': 'NÃO CONCLUÍDO',
    'Qualificado': 'QUALIFICADO',
    'Ganhador': 'GANHADOR',
  };
  return map[s] || s.toUpperCase();
};

const formatDate = (iso: string) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return iso; }
};

const statusColor: Record<string, string> = {
  'EM CURSO': 'bg-secondary/20 text-secondary',
  'CONCLUÍDO': 'bg-success/20 text-success',
  'NÃO CONCLUÍDO': 'bg-destructive/20 text-destructive',
  'QUALIFICADO': 'bg-accent/20 text-accent',
  'GANHADOR': 'bg-warning/20 text-warning',
};

const UserParticipations = () => {
  const { user } = useAuth();
  const [showEvidenceModal, setShowEvidenceModal] = useState<string | null>(null);
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

  // Instagram screenshot
  const [igScreenshot, setIgScreenshot] = useState<File | null>(null);
  const [igScreenshotPreview, setIgScreenshotPreview] = useState<string | null>(null);
  const igScreenshotRef = useRef<HTMLInputElement>(null);

  const [participations, setParticipations] = useState<(Participation & { campaign?: Campaign })[]>([]);

  useEffect(() => {
    const fetchParts = async () => {
      if (user) {
        const allParts = await apiGetParticipations();
        const allCamps = await apiGetCampaigns();
        const userParts = allParts
          .filter(p => p.userId === user.id)
          .map(p => ({ ...p, campaign: allCamps.find(c => c.id === p.campaignId) }));
        setParticipations(userParts);
      }
    };
    fetchParts();
  }, [user, showEvidenceModal]); // Refresh when modal closes

  const userParticipations = participations;

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

  const removePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const removeVideo = (i: number) => {
    setVideos(prev => prev.filter((_, idx) => idx !== i));
    setVideoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEvidenceModal || !user) return;
    if (photos.length === 0 || videos.length === 0 || comment.trim() === '') {
      toast.error('Adiciona una foto, un video y un comentario para participar.');
      return;
    }
    if (instagram && !igScreenshot) {
      toast.error('Por favor, añade la captura de pantalla de Instagram o desmarca la opción.');
      return;
    }
    setIsUploading(true);
    toast.loading('Subiendo evidencia...', { id: 'upload-evidence' });

    const [mediaUrls, igUrlResult] = await Promise.all([
      Promise.all([...photos, ...videos].map(file => apiUploadEvidence(file, user.id))),
      (instagram && igScreenshot) ? apiUploadEvidence(igScreenshot, user.id) : Promise.resolve(undefined)
    ]);

    const uploadedUrls = mediaUrls.filter((url): url is string => url !== null);
    const igUrl = igUrlResult || undefined;

    if (uploadedUrls.length === 0 && !igUrl && (photos.length > 0 || videos.length > 0 || (instagram && igScreenshot))) {
      toast.error('Error al subir los archivos. Intenta nuevamente.', { id: 'upload-evidence' });
      setIsUploading(false);
      return;
    }

    await apiUpdateParticipation(showEvidenceModal, {
      participationStatus: 'Concluído',
      comment,
      instagram,
      photo: uploadedUrls,
      instagramPhoto: igUrl,
      timestamp: new Date().toISOString()
    });

    toast.success(`¡Archivos subidos exitosamente!`, { id: 'upload-evidence' });
    setIsUploading(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setShowEvidenceModal(null);
      setComment('');
      setInstagram(false);
      setPhotos([]);
      setVideos([]);
      setPhotoPreviews([]);
      setIgScreenshot(null);
      setIgScreenshotPreview(null);
    }, 2500);
  };

  const now = new Date();
  const timestamp = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <h1 className="font-bold italic text-xl text-foreground mb-6">MINHAS PARTICIPAÇÕES</h1>

      {userParticipations.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 px-4 bg-card/30 rounded-3xl border border-dashed border-border/50 max-w-lg mx-auto mt-8"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl block">🔥</span>
          </div>
          <h3 className="font-bold italic text-xl text-foreground mb-3">NENHUMA PARTICIPAÇÃO AINDA</h3>
          <p className="text-muted-foreground mb-8">O verdadeiro mérito vem da ação. Participe da sua primeira campanha e comece a construir sua racha!</p>
          <Link to="/campanhas">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-primary text-primary-foreground text-ui px-8 py-3 rounded-full btn-shadow hover:btn-shadow-hover transition-all"
            >
              EXPLORAR CAMPANHAS
            </motion.button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {userParticipations.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.06 }}
              className="bg-card rounded-2xl p-4 card-shadow"
            >
              <div className="flex items-center gap-4">
                {p.photo ? (() => {
                  const firstUrl = Array.isArray(p.photo) ? p.photo[0] : p.photo;
                  return (
                    <img
                      src={firstUrl}
                      alt="Participação"
                      className="w-16 h-16 rounded-xl object-cover img-outline flex-shrink-0"
                    />
                  );
                })() : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-2xl">
                    {sportIconFallback[p.campaign?.sport || ''] || '🏆'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm truncate">
                    {p.campaign?.description}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {p.campaign?.sport} — {p.campaign?.city}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">📅 {formatDate(p.timestamp)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor[normalizeStatus(p.participationStatus)] || 'bg-muted text-muted-foreground'}`}>
                    {normalizeStatus(p.participationStatus)}
                  </span>
                  {normalizeStatus(p.participationStatus) === 'EM CURSO' && (
                    <motion.button
                      onClick={() => setShowEvidenceModal(p.id)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="bg-primary text-primary-foreground text-ui text-xs px-3 py-1.5 rounded-xl btn-shadow flex items-center gap-1.5"
                    >
                      <Upload size={12} />
                      REGISTRAR PARTICIPACIÓN
                    </motion.button>
                  )}
                </div>
              </div>
              {p.comment && (
                <p className="text-sm text-muted-foreground italic mt-3 pl-20">"{p.comment}"</p>
              )}
              {p.instagram && (
                <p className="text-xs text-accent mt-1 pl-20">📸 Publicou no Instagram</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Evidence submission modal */}
      <AnimatePresence>
        {showEvidenceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 py-8"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card rounded-2xl p-6 card-shadow max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              {!submitted ? (
                <form onSubmit={handleSubmitEvidence}>
                  <h3 className="font-bold italic text-lg text-foreground mb-4 uppercase">Registrar Participación</h3>

                  {/* Photo upload */}
                  <div className="mb-4 mt-2">
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-ui text-xs text-muted-foreground uppercase font-bold flex items-center gap-1">FOTOS <span className="text-destructive">(OBLIGATORIO)</span> <span className="text-primary ml-1">{photos.length}/{MAX_PHOTOS}</span></label>
                      {photos.length < MAX_PHOTOS && (
                        <button type="button" onClick={() => photoInputRef.current?.click()} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"><ImageIcon size={11} /> Para añadir</button>
                      )}
                    </div>
                    <p className="text-sm text-foreground mb-3 leading-snug">Sube una foto mostrando tu mejor actitud mientras practicas tu deporte favorito.</p>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

                    {photoPreviews.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1.5 mb-1">
                        {photoPreviews.map((src, i) => (
                          <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="relative h-48 rounded-xl overflow-hidden group border border-border/50">
                            <img src={src} className="w-full h-full object-cover" alt={`photo-${i}`} />
                            <button type="button" onClick={() => removePhoto(i)}
                              className="absolute top-2 right-2 bg-background/80 text-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={16} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div onClick={() => photoInputRef.current?.click()}
                        className="w-full py-8 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/40 text-muted-foreground hover:bg-muted/80 transition-all border border-dashed border-border/50">
                        <ImageIcon size={24} />
                        <span className="text-xs">Hasta 1 foto</span>
                      </div>
                    )}
                  </div>

                  {/* Video upload */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-ui text-xs text-muted-foreground uppercase font-bold flex items-center gap-1">VIDEOS <span className="text-destructive">(OBLIGATORIO)</span> <span className="text-primary ml-1">{videos.length}/{MAX_VIDEOS}</span></label>
                      {videos.length < MAX_VIDEOS && (
                        <button type="button" onClick={() => videoInputRef.current?.click()} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"><Film size={11} /> Para añadir</button>
                      )}
                    </div>
                    <p className="text-sm text-foreground mb-3 leading-snug">Sube un video mostrando como vives tu deporte favorito <strong className="text-accent">(máximo 10 segundos)</strong>.</p>
                    <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />

                    {videos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {videos.map((v, i) => (
                          <div key={i} className="relative rounded-xl overflow-hidden aspect-square border border-border/50 group bg-muted">
                            <video src={videoPreviews[i]} className="w-full h-full object-cover" controls playsInline preload="metadata" />
                            <button type="button" onClick={() => removeVideo(i)} className="absolute top-2 right-2 bg-background/80 text-destructive rounded-full p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div onClick={() => videoInputRef.current?.click()}
                        className="w-full py-6 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer bg-muted/40 text-muted-foreground hover:bg-muted/80 transition-all border border-dashed border-border/50">
                        <Film size={20} />
                        <span className="text-xs">Hasta 1 video (Máx 10s)</span>
                      </div>
                    )}
                  </div>

                  {/* Comment */}
                  <div className="mb-4">
                    <label className="text-ui text-xs text-muted-foreground font-bold block mb-2 uppercase">COMENTARIO <span className="text-destructive">(OBLIGATORIO)</span></label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all resize-none h-20"
                      placeholder="Ejemplo: ¡El mejor entrenamiento de la semana!"
                    />
                  </div>

                  {/* Timestamp */}
                  <div className="bg-card card-shadow border border-border/50 rounded-xl p-3 mb-4">
                    <span className="text-ui text-xs text-muted-foreground font-bold uppercase">MARCA DE TIEMPO</span>
                    <p className="text-foreground text-sm font-bold mt-1">{timestamp}</p>
                  </div>

                  {/* Instagram */}
                  {String(userParticipations.find(p => p.id === showEvidenceModal)?.campaign?.instagramOptional) === 'true' && (
                    <div className="mb-6">
                      <label className="flex items-center gap-3 cursor-pointer" onClick={() => setInstagram(!instagram)}>
                        <div
                          className={`min-w-[1.25rem] w-5 h-5 rounded-full flex items-center justify-center transition-colors ${instagram ? 'bg-primary' : 'bg-muted border border-border'}`}
                        >
                          {instagram && <Check size={14} className="text-primary-foreground font-bold" />}
                        </div>
                        <span className="text-foreground text-sm font-bold leading-tight">
                          Lo publiqué en Instagram con el <span className="text-accent">hashtag {userParticipations.find(p => p.id === showEvidenceModal)?.campaign?.instagramHashtags || '#3bukchallenge'}</span>
                        </span>
                      </label>

                      {/* Screenshot upload - only when instagram is checked */}
                      <AnimatePresence>
                        {instagram && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 overflow-hidden"
                          >
                            <label className="text-ui text-xs text-muted-foreground font-bold block mb-2 mt-2 uppercase">CAPTURA DE PANTALLA DE INSTAGRAM (OPCIONAL)</label>
                            <input ref={igScreenshotRef} type="file" accept="image/*" className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setIgScreenshot(f);
                                  setIgScreenshotPreview(URL.createObjectURL(f));
                                }
                              }}
                            />
                            {igScreenshotPreview ? (
                              <div className="relative rounded-xl overflow-hidden h-40 border border-border/50">
                                <img src={igScreenshotPreview} className="w-full h-full object-cover" alt="Instagram screenshot" />
                                <button type="button" onClick={() => { setIgScreenshot(null); setIgScreenshotPreview(null); }}
                                  className="absolute top-2 right-2 bg-background/80 text-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div onClick={() => igScreenshotRef.current?.click()}
                                className="w-full py-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-accent hover:bg-accent/10 transition-all border border-dashed border-accent">
                                <Upload size={18} />
                                <span className="text-sm font-bold">Adjunta una captura de pantalla de Instagram.</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <motion.button
                      type="button"
                      onClick={() => {
                        setShowEvidenceModal(null);
                        setPhotos([]);
                        setVideos([]);
                        setPhotoPreviews([]);
                        setVideoPreviews([]);
                        setIgScreenshot(null);
                        setIgScreenshotPreview(null);
                        setComment('');
                        setInstagram(false);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={spring}
                      className="flex-[0.4] bg-muted/60 hover:bg-muted text-foreground text-ui text-xs py-3 rounded-xl font-bold"
                    >
                      CANCELAR
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={isUploading || photos.length === 0 || videos.length === 0 || comment.trim() === '' || (instagram && !igScreenshot)}
                      whileHover={!isUploading ? { scale: 1.02 } : {}}
                      whileTap={!isUploading ? { scale: 0.98 } : {}}
                      transition={spring}
                      className={`flex-[0.6] text-primary-foreground text-ui text-xs py-3 rounded-xl font-bold btn-shadow ${
                        isUploading || photos.length === 0 || videos.length === 0 || comment.trim() === '' || (instagram && !igScreenshot)
                          ? 'bg-primary/50 cursor-not-allowed'
                          : 'bg-primary hover:btn-shadow-hover'
                      }`}
                    >
                      {isUploading ? 'SUBIENDO...' : 'ENVÍA TU PARTICIPACIÓN'}
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <span className="text-5xl block mb-3">🔥</span>
                  <h3 className="font-bold italic text-2xl text-foreground mb-2">¡Participación enviada!</h3>
                  <p className="text-muted-foreground text-sm">Ahora está en manos del administrador. ¡Buena suerte!</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserParticipations;
