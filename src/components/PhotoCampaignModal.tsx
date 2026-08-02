import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Campaign, Participation } from '@/data/mockData';
import { apiAddParticipation, apiGetAvailableCampaigns, apiGetParticipations } from '@/lib/mockApi';
import { submitParticipationEvidence } from '@/lib/participationEvidence';
import CampaignCard from '@/components/CampaignCard';
import ParticipationEvidenceModal from '@/components/ParticipationEvidenceModal';

interface SearchPhoto {
  id: string;
  imageUrl: string;
}

interface PhotoCampaignModalProps {
  photo: SearchPhoto | null;
  onClose: () => void;
}

const isInProgress = (participation: Participation) => participation.participationStatus === 'Em curso';

const fileExtensionFromBlob = (blob: Blob, imageUrl: string): string => {
  const fromMime = blob.type.split('/')[1]?.split('+')[0];
  if (fromMime) return fromMime === 'jpeg' ? 'jpg' : fromMime;

  const fromUrl = new URL(imageUrl).pathname.split('.').pop();
  return fromUrl && fromUrl.length <= 5 ? fromUrl : 'jpg';
};

const PhotoCampaignModal = ({ photo, onClose }: PhotoCampaignModalProps) => {
  const { user } = useAuth();
  const carouselRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const instagramInputRef = useRef<HTMLInputElement>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [preparingCampaignId, setPreparingCampaignId] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [activeParticipation, setActiveParticipation] = useState<Participation | null>(null);

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [instagram, setInstagram] = useState(false);
  const [instagramScreenshot, setInstagramScreenshot] = useState<File | null>(null);
  const [instagramScreenshotPreview, setInstagramScreenshotPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!photo || !user) return;

    let cancelled = false;
    setLoadingCampaigns(true);

    Promise.all([apiGetAvailableCampaigns(), apiGetParticipations()])
      .then(([availableCampaigns, allParticipations]) => {
        if (cancelled) return;
        setCampaigns(availableCampaigns.filter((campaign) => !campaign.isHidden));
        setParticipations(allParticipations.filter((participation) => participation.userId === user.id));
      })
      .catch(() => {
        if (!cancelled) toast.error('Não foi possível carregar suas campanhas.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCampaigns(false);
      });

    return () => {
      cancelled = true;
    };
  }, [photo, user]);

  const resetEvidence = () => {
    setEvidenceOpen(false);
    setSubmitted(false);
    setUploading(false);
    setActiveCampaign(null);
    setActiveParticipation(null);
    setPhotos([]);
    setPhotoPreviews([]);
    setComment('');
    setInstagram(false);
    setInstagramScreenshot(null);
    setInstagramScreenshotPreview(null);
  };

  const closeAll = () => {
    resetEvidence();
    setCampaigns([]);
    setParticipations([]);
    setPreparingCampaignId(null);
    onClose();
  };

  const participationForCampaign = (campaignId: string) => (
    participations.find((participation) => participation.campaignId === campaignId)
  );

  const prepareEvidence = async (campaign: Campaign) => {
    if (!photo || !user || preparingCampaignId) return;

    const existingParticipation = participationForCampaign(campaign.id);
    if (existingParticipation && !isInProgress(existingParticipation)) return;

    setPreparingCampaignId(campaign.id);
    try {
      const imageResponse = await fetch(photo.imageUrl);
      if (!imageResponse.ok) throw new Error('Não foi possível carregar a foto original.');

      const imageBlob = await imageResponse.blob();
      const extension = fileExtensionFromBlob(imageBlob, photo.imageUrl);
      const evidenceFile = new File([imageBlob], `foto-3buk-${photo.id}.${extension}`, {
        type: imageBlob.type || 'image/jpeg',
      });

      let participation = existingParticipation;
      if (!participation) {
        participation = await apiAddParticipation({
          userId: user.id,
          campaignId: campaign.id,
          participationStatus: 'Em curso',
          photo: '',
          instagram: false,
        }) || undefined;
      }
      if (!participation) throw new Error('Não foi possível registrar a participação.');

      setParticipations((current) => {
        const withoutCurrent = current.filter((item) => item.id !== participation.id);
        return [...withoutCurrent, participation];
      });
      setActiveCampaign(campaign);
      setActiveParticipation(participation);
      setPhotos([evidenceFile]);
      setPhotoPreviews([photo.imageUrl]);
      setComment('');
      setInstagram(false);
      setInstagramScreenshot(null);
      setInstagramScreenshotPreview(null);
      setSubmitted(false);
      setEvidenceOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao preparar a participação.');
    } finally {
      setPreparingCampaignId(null);
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setPhotos([selectedFile]);
    setPhotoPreviews([URL.createObjectURL(selectedFile)]);
    event.target.value = '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !activeParticipation || !activeCampaign || photos.length === 0 || !comment.trim()) return;
    if (instagram && !instagramScreenshot) {
      toast.error('Adicione a captura do Instagram ou desmarque a opção.');
      return;
    }

    setUploading(true);
    toast.loading('Enviando evidência...', { id: 'photo-campaign-evidence' });
    try {
      const updatedParticipation = await submitParticipationEvidence({
        participationId: activeParticipation.id,
        userId: user.id,
        expectedStatus: 'Em curso',
        photos,
        instagram,
        instagramScreenshot,
        comment: comment.trim(),
      });

      setParticipations((current) => current.map((item) => (
        item.id === updatedParticipation.id ? updatedParticipation : item
      )));
      setSubmitted(true);
      toast.success('Participação enviada com sucesso!', { id: 'photo-campaign-evidence' });
      window.setTimeout(closeAll, 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar a participação.', {
        id: 'photo-campaign-evidence',
      });
    } finally {
      setUploading(false);
    }
  };

  const timestamp = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <>
      <AnimatePresence>
        {photo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 px-4 py-8 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="Escolher campanha"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl md:p-8"
            >
              <button
                type="button"
                onClick={closeAll}
                disabled={Boolean(preparingCampaignId)}
                className="absolute right-4 top-4 z-20 rounded-full bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>

              <div className="mb-6 pr-12">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Use sua foto</p>
                <h3 className="text-2xl font-bold italic text-foreground md:text-3xl">Escolha uma campanha</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  A foto original já está pronta. Selecione onde deseja registrar sua participação.
                </p>
              </div>

              {loadingCampaigns ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="animate-spin text-primary" size={30} />
                  <span className="text-sm">Carregando campanhas disponíveis...</span>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
                  Nenhuma campanha disponível no momento.
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => carouselRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                    className="absolute -left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-background/95 p-2 text-foreground shadow-lg hover:text-primary md:block"
                    aria-label="Campanhas anteriores"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <div ref={carouselRef} className="flex items-stretch snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-4 scrollbar-hide md:px-8">
                    {campaigns.map((campaign) => {
                      const existingParticipation = participationForCampaign(campaign.id);
                      const disabled = Boolean(existingParticipation && !isInProgress(existingParticipation));
                      const preparing = preparingCampaignId === campaign.id;
                      const actionLabel = disabled
                        ? 'Participação já enviada'
                        : preparing
                          ? 'Preparando...'
                          : existingParticipation
                            ? 'Continuar participação'
                            : 'Usar nesta campanha';

                      return (
                        <div key={campaign.id} className="flex w-[85%] shrink-0 snap-center sm:w-[48%] lg:w-[31%] [&>*]:w-full">
                          <CampaignCard
                            campaign={campaign}
                            onSelect={() => prepareEvidence(campaign)}
                            disabled={disabled || Boolean(preparingCampaignId)}
                            actionLabel={actionLabel}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => carouselRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                    className="absolute -right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-background/95 p-2 text-foreground shadow-lg hover:text-primary md:block"
                    aria-label="Próximas campanhas"
                  >
                    <ChevronRight size={22} />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ParticipationEvidenceModal
        open={evidenceOpen}
        submitted={submitted}
        editing={false}
        uploading={uploading}
        photoPreviews={photoPreviews}
        videos={[]}
        videoPreviews={[]}
        comment={comment}
        timestamp={timestamp}
        instagram={instagram}
        instagramEnabled={Boolean(activeCampaign?.instagramOptional)}
        instagramHashtags={activeCampaign?.instagramHashtags}
        instagramScreenshotPreview={instagramScreenshotPreview}
        photoInputRef={photoInputRef}
        videoInputRef={videoInputRef}
        instagramInputRef={instagramInputRef}
        onPhotoChange={handlePhotoChange}
        onVideoChange={() => undefined}
        onRemovePhoto={() => {
          setPhotos([]);
          setPhotoPreviews([]);
        }}
        onRemoveVideo={() => undefined}
        onCommentChange={setComment}
        onInstagramChange={setInstagram}
        onInstagramScreenshotChange={(selectedFile, previewUrl) => {
          setInstagramScreenshot(selectedFile);
          setInstagramScreenshotPreview(previewUrl);
        }}
        onRemoveInstagramScreenshot={() => {
          setInstagramScreenshot(null);
          setInstagramScreenshotPreview(null);
        }}
        onCancel={resetEvidence}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export default PhotoCampaignModal;
