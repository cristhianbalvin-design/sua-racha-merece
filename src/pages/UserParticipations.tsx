import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { participations, campaigns, currentUser } from '@/data/mockData';
import { Upload, Check, Camera } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const statusColor: Record<string, string> = {
  'Em curso': 'bg-secondary/20 text-secondary',
  'Concluído': 'bg-success/20 text-success',
  'Não concluído': 'bg-destructive/20 text-destructive',
  'Qualificado': 'bg-accent/20 text-accent',
  'Ganhador': 'bg-warning/20 text-warning',
};

const UserParticipations = () => {
  const [showEvidenceModal, setShowEvidenceModal] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [instagram, setInstagram] = useState(false);
  const [photoSelected, setPhotoSelected] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const userParticipations = participations
    .filter((p) => p.userId === currentUser.id)
    .map((p) => {
      const campaign = campaigns.find((c) => c.id === p.campaignId);
      return { ...p, campaign };
    });

  const handleSubmitEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setShowEvidenceModal(null);
      setComment('');
      setInstagram(false);
      setPhotoSelected(false);
    }, 2500);
  };

  const now = new Date();
  const timestamp = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <h1 className="font-bold italic text-xl text-foreground mb-6">MINHAS PARTICIPAÇÕES</h1>

      {userParticipations.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">🔥</span>
          <h3 className="font-bold italic text-lg text-foreground mb-2">Nenhuma participação ainda.</h3>
          <p className="text-sm text-muted-foreground">Participe de uma campanha e mostre sua raça!</p>
        </div>
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
                <img
                  src={p.photo}
                  alt="Participação"
                  className="w-16 h-16 rounded-xl object-cover img-outline flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm truncate">
                    {p.campaign?.description}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {p.campaign?.sport} — {p.campaign?.city}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">📅 {p.timestamp}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor[p.participationStatus] || 'bg-muted text-muted-foreground'}`}>
                    {p.participationStatus}
                  </span>
                  {p.participationStatus === 'Em curso' && (
                    <motion.button
                      onClick={() => setShowEvidenceModal(p.id)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="bg-primary text-primary-foreground text-ui text-xs px-3 py-1.5 rounded-xl btn-shadow flex items-center gap-1.5"
                    >
                      <Camera size={12} />
                      REGISTRAR PARTICIPAÇÃO
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card rounded-2xl p-6 card-shadow max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              {!submitted ? (
                <form onSubmit={handleSubmitEvidence}>
                  <h3 className="font-bold italic text-lg text-foreground mb-4">REGISTRAR PARTICIPAÇÃO</h3>

                  {/* Photo upload */}
                  <div className="mb-4">
                    <label className="text-ui text-xs text-muted-foreground block mb-2">FOTO / VÍDEO</label>
                    <button
                      type="button"
                      onClick={() => setPhotoSelected(true)}
                      className={`w-full h-32 rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${
                        photoSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {photoSelected ? (
                        <>
                          <Check size={28} />
                          <span className="text-sm font-bold">Arquivo selecionado</span>
                        </>
                      ) : (
                        <>
                          <Upload size={28} />
                          <span className="text-sm">Toque para enviar foto ou vídeo</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Comment */}
                  <div className="mb-4">
                    <label className="text-ui text-xs text-muted-foreground block mb-2">COMENTÁRIO (OPCIONAL)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all resize-none h-20"
                      placeholder="Ex: Melhor treino da semana!"
                    />
                  </div>

                  {/* Timestamp */}
                  <div className="bg-muted rounded-xl p-3 mb-4">
                    <span className="text-ui text-xs text-muted-foreground">TIMESTAMP</span>
                    <p className="text-foreground text-sm font-bold mt-1">{timestamp}</p>
                  </div>

                  {/* Instagram */}
                  <label className="flex items-center gap-3 cursor-pointer mb-6">
                    <div
                      onClick={() => setInstagram(!instagram)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                        instagram ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      {instagram && <Check size={14} className="text-primary-foreground" />}
                    </div>
                    <span className="text-foreground text-sm">
                      Publiquei no Instagram com <span className="text-accent font-bold">#3bukchallenge</span>
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <motion.button
                      type="button"
                      onClick={() => {
                        setShowEvidenceModal(null);
                        setPhotoSelected(false);
                        setComment('');
                        setInstagram(false);
                      }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-muted text-foreground text-ui text-xs py-2.5 rounded-xl"
                    >
                      CANCELAR
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-2.5 rounded-xl btn-shadow"
                    >
                      ENVIAR PARTICIPAÇÃO
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <span className="text-5xl block mb-3">🔥</span>
                  <h3 className="font-bold italic text-lg text-foreground mb-2">Participação enviada!</h3>
                  <p className="text-muted-foreground text-sm">Agora é com o admin. Boa sorte!</p>
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
