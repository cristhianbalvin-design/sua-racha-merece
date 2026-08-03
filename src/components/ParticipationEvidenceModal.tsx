import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Edit2, Film, ImageIcon, Upload, X } from 'lucide-react';

const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };
const MAX_PHOTOS = 1;
const MAX_VIDEOS = 1;

interface ParticipationEvidenceModalProps {
  open: boolean;
  submitted: boolean;
  editing: boolean;
  uploading: boolean;
  photoPreviews: string[];
  videos: File[];
  videoPreviews: string[];
  comment: string;
  timestamp: string;
  instagram: boolean;
  instagramEnabled: boolean;
  instagramHashtags?: string;
  instagramScreenshotPreview: string | null;
  photoInputRef: RefObject<HTMLInputElement>;
  videoInputRef: RefObject<HTMLInputElement>;
  instagramInputRef: RefObject<HTMLInputElement>;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onVideoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onRemoveVideo: (index: number) => void;
  onCommentChange: (value: string) => void;
  onInstagramChange: (value: boolean) => void;
  onInstagramScreenshotChange: (file: File, previewUrl: string) => void;
  onRemoveInstagramScreenshot: () => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const ParticipationEvidenceModal = ({
  open,
  submitted,
  editing,
  uploading,
  photoPreviews,
  videos,
  videoPreviews,
  comment,
  timestamp,
  instagram,
  instagramEnabled,
  instagramHashtags,
  instagramScreenshotPreview,
  photoInputRef,
  videoInputRef,
  instagramInputRef,
  onPhotoChange,
  onVideoChange,
  onRemovePhoto,
  onRemoveVideo,
  onCommentChange,
  onInstagramChange,
  onInstagramScreenshotChange,
  onRemoveInstagramScreenshot,
  onCancel,
  onSubmit,
}: ParticipationEvidenceModalProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Editar evidência' : 'Registrar participação'}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6 card-shadow"
        >
          {!submitted ? (
            <form onSubmit={onSubmit}>
              <h3 className="mb-4 text-lg font-bold italic uppercase text-foreground">
                {editing ? 'Editar evidência' : 'Registrar participação'}
              </h3>

              <div className="mb-4 mt-2">
                <div className="mb-1 flex items-end justify-between">
                  <label className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground text-ui">
                    FOTOS <span className="text-destructive">(OBRIGATÓRIO)</span>
                    <span className="ml-1 text-primary">{photoPreviews.length}/{MAX_PHOTOS}</span>
                  </label>
                  {photoPreviews.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <ImageIcon size={11} /> Para adicionar
                    </button>
                  )}
                </div>
                <p className="mb-3 text-sm leading-snug text-foreground">
                  Envie uma foto mostrando sua melhor atitude enquanto pratica seu esporte favorito.
                </p>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />

                {photoPreviews.length > 0 ? (
                  <div className="mb-1 grid grid-cols-1 gap-1.5">
                    {photoPreviews.map((src, index) => (
                      <motion.div
                        key={src}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative flex items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-black/90"
                      >
                        <img src={src} className="max-h-[50vh] w-full object-contain" alt={`Foto ${index + 1}`} />
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 text-primary shadow-sm"
                          aria-label="Editar foto"
                        >
                          <Edit2 size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 bg-muted/40 py-8 text-muted-foreground transition-all hover:bg-muted/80"
                  >
                    <ImageIcon size={24} />
                    <span className="text-xs">Até 1 foto</span>
                  </button>
                )}
              </div>

              <div className="hidden">
                <div className="mb-1 flex items-end justify-between">
                  <label className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground text-ui">
                    VÍDEOS <span className="text-destructive">(OBRIGATÓRIO)</span>
                    <span className="ml-1 text-primary">{videos.length}/{MAX_VIDEOS}</span>
                  </label>
                  {videos.length < MAX_VIDEOS && (
                    <button type="button" onClick={() => videoInputRef.current?.click()} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                      <Film size={11} /> Para adicionar
                    </button>
                  )}
                </div>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={onVideoChange} />
                {videos.map((video, index) => (
                  <div key={`${video.name}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted">
                    <video src={videoPreviews[index]} className="h-full w-full object-cover" controls playsInline preload="metadata" />
                    <button type="button" onClick={() => onRemoveVideo(index)} className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-destructive" aria-label="Remover vídeo">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground text-ui">
                  COMENTÁRIO <span className="text-destructive">(OBRIGATÓRIO)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  className="h-20 w-full resize-none rounded-lg bg-input px-4 py-3 text-foreground input-shadow outline-none transition-all focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  placeholder="Exemplo: O melhor treino da semana!"
                />
              </div>

              <div className="mb-4 rounded-xl border border-border/50 bg-card p-3 card-shadow">
                <span className="text-xs font-bold uppercase text-muted-foreground text-ui">REGISTRO DE TEMPO</span>
                <p className="mt-1 text-sm font-bold text-foreground">{timestamp}</p>
              </div>

              {instagramEnabled && (
                <div className="mb-6">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => onInstagramChange(!instagram)}
                  >
                    <span className={`flex h-5 w-5 min-w-5 items-center justify-center rounded-full transition-colors ${instagram ? 'bg-primary' : 'border border-border bg-muted'}`}>
                      {instagram && <Check size={14} className="font-bold text-primary-foreground" />}
                    </span>
                    <span className="text-sm font-bold leading-tight text-foreground">
                      Publiquei no Instagram com a <span className="text-accent">hashtag {instagramHashtags || '#3bukchallenge'}</span>
                    </span>
                  </button>

                  <AnimatePresence>
                    {instagram && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <label className="mb-2 mt-2 block text-xs font-bold uppercase text-muted-foreground text-ui">
                          CAPTURA DE TELA DO INSTAGRAM (OPCIONAL)
                        </label>
                        <input
                          ref={instagramInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const selectedFile = event.target.files?.[0];
                            if (selectedFile) onInstagramScreenshotChange(selectedFile, URL.createObjectURL(selectedFile));
                          }}
                        />
                        {instagramScreenshotPreview ? (
                          <div className="group relative h-40 overflow-hidden rounded-xl border border-border/50">
                            <img src={instagramScreenshotPreview} className="h-full w-full object-cover" alt="Captura do Instagram" />
                            <button type="button" onClick={onRemoveInstagramScreenshot} className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-destructive opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remover captura do Instagram">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => instagramInputRef.current?.click()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent py-5 text-accent transition-all hover:bg-accent/10"
                          >
                            <Upload size={18} />
                            <span className="text-sm font-bold">Anexe uma captura de tela do Instagram.</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="flex gap-3">
                <motion.button type="button" onClick={onCancel} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring} className="flex-[0.4] rounded-xl bg-muted/60 py-3 text-xs font-bold text-foreground text-ui hover:bg-muted">
                  CANCELAR
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={uploading || photoPreviews.length === 0 || comment.trim() === '' || (instagram && !instagramScreenshotPreview)}
                  whileHover={!uploading ? { scale: 1.02 } : {}}
                  whileTap={!uploading ? { scale: 0.98 } : {}}
                  transition={spring}
                  className={`flex-[0.6] rounded-xl py-3 text-xs font-bold text-primary-foreground text-ui btn-shadow ${uploading || photoPreviews.length === 0 || comment.trim() === '' || (instagram && !instagramScreenshotPreview) ? 'cursor-not-allowed bg-primary/50' : 'bg-primary hover:btn-shadow-hover'}`}
                >
                  {uploading ? 'ENVIANDO...' : (editing ? 'SALVAR ALTERAÇÕES' : 'ENVIE SUA PARTICIPAÇÃO')}
                </motion.button>
              </div>
            </form>
          ) : (
            <div className="py-8 text-center">
              <span className="mb-3 block text-5xl">🔥</span>
              <h3 className="mb-2 text-2xl font-bold italic text-foreground">
                {editing ? 'Evidência atualizada!' : 'Participação enviada!'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {editing ? 'Suas alterações foram salvas.' : 'Agora está nas mãos do administrador. Boa sorte!'}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ParticipationEvidenceModal;
