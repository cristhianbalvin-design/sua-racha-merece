import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { apiGetParticipations, apiGetCampaigns } from '@/lib/mockApi';
import { Participation, Campaign } from '@/data/mockData';
import { canEditParticipationEvidence } from '@/lib/participationRules';
import ParticipationEvidenceModal from '@/components/ParticipationEvidenceModal';
import { submitParticipationEvidence } from '@/lib/participationEvidence';
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
      reject("Erro ao carregar o vídeo");
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
  const [isEditingEvidence, setIsEditingEvidence] = useState(false);

  // Multi-file state
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Instagram screenshot
  const [igScreenshot, setIgScreenshot] = useState<File | null>(null);
  const [igScreenshotPreview, setIgScreenshotPreview] = useState<string | null>(null);
  const [existingIgScreenshotUrl, setExistingIgScreenshotUrl] = useState<string | null>(null);
  const igScreenshotRef = useRef<HTMLInputElement>(null);

  const [participations, setParticipations] = useState<(Participation & { campaign?: Campaign })[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const [autoPhotoProcessed, setAutoPhotoProcessed] = useState(false);
  const [autoOpenProcessed, setAutoOpenProcessed] = useState(false);
  const allPhotoPreviews = [...existingPhotoUrls, ...photoPreviews];

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

  useEffect(() => {
    if (userParticipations.length > 0 && location.state?.autoPhotoUrl && !autoPhotoProcessed) {
      const url = location.state.autoPhotoUrl;
      setAutoPhotoProcessed(true);
      window.history.replaceState({}, document.title); // clear state
      
      toast.loading('Carregando foto...', { id: 'auto-photo' });
      fetch(url).then(r => r.blob()).then(blob => {
        const file = new File([blob], 'foto_3buk.jpg', { type: blob.type || 'image/jpeg' });
        setPhotos([file]);
        setPhotoPreviews([url]);
        toast.dismiss('auto-photo');
        
        const emCursoParts = userParticipations.filter(p => p.participationStatus === 'Em curso' || p.participationStatus?.toLowerCase() === 'em curso');
        if (emCursoParts.length >= 1) {
          toast.success("Foto carregada! Clique em REGISTRAR PARTICIPAÇÃO na campanha desejada.");
        } else {
          toast('Sem campanhas em curso', {
            description: 'Você não tem campanhas em curso para usar esta foto. Participe de uma nova campanha primeiro.',
            action: {
              label: 'Ver Campanhas',
              onClick: () => navigate('/dashboard')
            },
            duration: 5000,
          });
        }
      }).catch(() => {
        toast.error('Erro ao carregar a foto.', { id: 'auto-photo' });
      });
    }
  }, [userParticipations, location.state, autoPhotoProcessed, navigate]);

  useEffect(() => {
    if (userParticipations.length > 0 && location.state?.autoOpenNewParticipationForCampaign && !autoOpenProcessed) {
      const campaignId = location.state.autoOpenNewParticipationForCampaign;
      setAutoOpenProcessed(true);
      window.history.replaceState({}, document.title); // clear state
      
      const newParticipation = userParticipations.find(p => p.campaignId === campaignId && p.participationStatus === 'Em curso');
      if (newParticipation) {
        openNewEvidence(newParticipation.id);
      }
    }
  }, [userParticipations, location.state, autoOpenProcessed]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    if (MAX_PHOTOS === 1) {
      setPhotos([selected[0]]);
      setPhotoPreviews([URL.createObjectURL(selected[0])]);
      setExistingPhotoUrls([]);
      e.target.value = '';
      return;
    }

    const remaining = MAX_PHOTOS - existingPhotoUrls.length - photos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_PHOTOS} fotos atingido.`); return; }
    const toAdd = selected.slice(0, remaining);
    if (selected.length > remaining) toast.warning(`Apenas 1 foto foi adicionada.`);
    setPhotos(prev => [...prev, ...toAdd]);
    setPhotoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_VIDEOS - videos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_VIDEOS} vídeos atingido.`); return; }

    const toProcess = selected.slice(0, remaining);
    const validFiles: File[] = [];

    for (const file of toProcess) {
      try {
        const duration = await getVideoDuration(file);
        if (duration > MAX_VIDEO_DURATION_SECONDS + 0.5) {
          toast.error(`O vídeo "${file.name}" ultrapassa 10 segundos (dura aprox. ${Math.round(duration)}s).`);
        } else {
          validFiles.push(file);
        }
      } catch (err) {
        toast.error(`Não foi possível verificar a duração do vídeo "${file.name}".`);
      }
    }

    if (selected.length > remaining) toast.warning(`Só é possível enviar ${MAX_VIDEOS} vídeo.`);
    
    if (validFiles.length > 0) {
      setVideos(prev => [...prev, ...validFiles]);
      setVideoPreviews(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);
    }
    e.target.value = '';
  };

  const removePhoto = (i: number) => {
    if (i < existingPhotoUrls.length) {
      setExistingPhotoUrls((prev) => prev.filter((_, idx) => idx !== i));
      return;
    }
    const newPhotoIndex = i - existingPhotoUrls.length;
    setPhotos(prev => prev.filter((_, idx) => idx !== newPhotoIndex));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== newPhotoIndex));
  };

  const removeVideo = (i: number) => {
    setVideos(prev => prev.filter((_, idx) => idx !== i));
    setVideoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const resetEvidenceForm = () => {
    setShowEvidenceModal(null);
    setIsEditingEvidence(false);
    setSubmitted(false);
    setComment('');
    setInstagram(false);
    setPhotos([]);
    setPhotoPreviews([]);
    setExistingPhotoUrls([]);
    setVideos([]);
    setVideoPreviews([]);
    setIgScreenshot(null);
    setIgScreenshotPreview(null);
    setExistingIgScreenshotUrl(null);
  };

  const openNewEvidence = (participationId: string) => {
    setIsEditingEvidence(false);
    setExistingPhotoUrls([]);
    setExistingIgScreenshotUrl(null);
    setShowEvidenceModal(participationId);
  };

  const openEvidenceEditor = (participation: Participation) => {
    if (!canEditParticipationEvidence(participation.participationStatus)) return;
    const currentPhotos = participation.photo
      ? (Array.isArray(participation.photo) ? participation.photo : [participation.photo])
      : [];
    setIsEditingEvidence(true);
    setPhotos([]);
    setPhotoPreviews([]);
    setExistingPhotoUrls(currentPhotos);
    setComment(participation.comment || '');
    setInstagram(Boolean(participation.instagram));
    setIgScreenshot(null);
    setExistingIgScreenshotUrl(participation.instagramPhoto || null);
    setIgScreenshotPreview(participation.instagramPhoto || null);
    setShowEvidenceModal(participation.id);
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEvidenceModal || !user) return;
    const activeParticipation = userParticipations.find((p) => p.id === showEvidenceModal);
    const expectedStatus = isEditingEvidence ? 'Concluído' : 'Em curso';
    if (!activeParticipation || activeParticipation.participationStatus !== expectedStatus) {
      toast.error('Esta participação mudou de estado e não pode ser editada.');
      return;
    }
    if (existingPhotoUrls.length + photos.length === 0 || comment.trim() === '') {
      toast.error('Adicione uma foto e um comentário para participar.');
      return;
    }
    if (instagram && !igScreenshot && !existingIgScreenshotUrl) {
      toast.error('Por favor, adicione a captura de tela do Instagram ou desmarque a opção.');
      return;
    }
    setIsUploading(true);
    toast.loading('Enviando evidência...', { id: 'upload-evidence' });

    try {
      await submitParticipationEvidence({
        participationId: showEvidenceModal,
        userId: user.id,
        expectedStatus,
        photos,
        existingPhotoUrls,
        comment: comment.trim(),
        instagram,
        instagramScreenshot: igScreenshot,
        existingInstagramScreenshotUrl: existingIgScreenshotUrl,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar participação.', { id: 'upload-evidence' });
      setIsUploading(false);
      return;
    }

    toast.success(isEditingEvidence ? 'Evidência atualizada com sucesso!' : 'Arquivos enviados com sucesso!', { id: 'upload-evidence' });
    setIsUploading(false);
    setSubmitted(true);
    setTimeout(() => {
      const shouldRedirect = !isEditingEvidence;
      resetEvidenceForm();
      if (shouldRedirect) navigate('/perfil');
    }, isEditingEvidence ? 1200 : 2500);
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
              role={p.campaign ? 'link' : undefined}
              tabIndex={p.campaign ? 0 : undefined}
              onClick={() => p.campaign && navigate(`/campanha/${p.campaign.id}`, { state: { readOnly: true } })}
              onKeyDown={(event) => {
                if (p.campaign && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  navigate(`/campanha/${p.campaign.id}`, { state: { readOnly: true } });
                }
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.06 }}
              className="bg-card rounded-2xl p-4 card-shadow cursor-pointer hover:ring-2 hover:ring-primary/30 transition-shadow"
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
                    {p.campaign?.name || p.campaign?.description}
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
                      onClick={(event) => {
                        event.stopPropagation();
                        openNewEvidence(p.id);
                      }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="bg-primary text-primary-foreground text-ui text-xs px-3 py-1.5 rounded-xl btn-shadow flex items-center gap-1.5"
                    >
                      <Upload size={12} />
                      REGISTRAR PARTICIPAÇÃO
                    </motion.button>
                  )}
                  {canEditParticipationEvidence(p.participationStatus) && (
                    <motion.button
                      onClick={(event) => {
                        event.stopPropagation();
                        openEvidenceEditor(p);
                      }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex items-center gap-1.5 rounded-xl bg-secondary/20 px-3 py-1.5 text-xs font-bold text-secondary"
                    >
                      <Pencil size={12} />
                      EDITAR EVIDÊNCIA
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

      <ParticipationEvidenceModal
        open={Boolean(showEvidenceModal)}
        submitted={submitted}
        editing={isEditingEvidence}
        uploading={isUploading}
        photoPreviews={allPhotoPreviews}
        videos={videos}
        videoPreviews={videoPreviews}
        comment={comment}
        timestamp={timestamp}
        instagram={instagram}
        instagramEnabled={Boolean(
          userParticipations.find((participation) => participation.id === showEvidenceModal)?.campaign?.instagramOptional
        )}
        instagramHashtags={
          userParticipations.find((participation) => participation.id === showEvidenceModal)?.campaign?.instagramHashtags
        }
        instagramScreenshotPreview={igScreenshotPreview}
        photoInputRef={photoInputRef}
        videoInputRef={videoInputRef}
        instagramInputRef={igScreenshotRef}
        onPhotoChange={handlePhotoChange}
        onVideoChange={handleVideoChange}
        onRemovePhoto={removePhoto}
        onRemoveVideo={removeVideo}
        onCommentChange={setComment}
        onInstagramChange={setInstagram}
        onInstagramScreenshotChange={(selectedFile, previewUrl) => {
          setIgScreenshot(selectedFile);
          setIgScreenshotPreview(previewUrl);
        }}
        onRemoveInstagramScreenshot={() => {
          setIgScreenshot(null);
          setIgScreenshotPreview(null);
          setExistingIgScreenshotUrl(null);
        }}
        onCancel={resetEvidenceForm}
        onSubmit={handleSubmitEvidence}
      />
    </div>
  );
};

export default UserParticipations;
