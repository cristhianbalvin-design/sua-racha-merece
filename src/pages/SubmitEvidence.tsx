import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Check } from 'lucide-react';
import { campaigns } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const SubmitEvidence = () => {
  const { id } = useParams();
  const campaign = campaigns.find((c) => c.id === id);
  const [comment, setComment] = useState('');
  const [instagram, setInstagram] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photoSelected, setPhotoSelected] = useState(false);

  const now = new Date();
  const timestamp = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  if (!campaign) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
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
              {/* Photo upload */}
              <div>
                <label className="text-ui text-xs text-muted-foreground block mb-2">SUA FOTO</label>
                <button
                  type="button"
                  onClick={() => setPhotoSelected(true)}
                  className={`w-full h-40 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
                    photoSelected
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {photoSelected ? (
                    <>
                      <Check size={32} />
                      <span className="text-sm font-bold">Foto selecionada</span>
                    </>
                  ) : (
                    <>
                      <Upload size={32} />
                      <span className="text-sm">Toque para selecionar sua foto</span>
                    </>
                  )}
                </button>
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
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    instagram ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  {instagram && <Check size={14} className="text-primary-foreground" />}
                </div>
                <span className="text-foreground text-sm">
                  Publiquei no Instagram com <span className="text-accent font-bold">#3bukchallenge</span> ✓
                </span>
              </label>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="w-full bg-primary text-primary-foreground text-ui py-4 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow text-base"
              >
                ENVIAR PARTICIPAÇÃO
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
