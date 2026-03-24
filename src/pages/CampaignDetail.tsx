import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Instagram } from 'lucide-react';
import { campaigns } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const campaign = campaigns.find((c) => c.id === id);
  const [participated, setParticipated] = useState(false);

  if (!campaign) {
    return (
      <div className="px-4 py-16 text-center">
        <span className="text-4xl block mb-3">🔥</span>
        <h2 className="font-bold italic text-xl text-foreground mb-2">Campanha não encontrada.</h2>
        <Link to="/dashboard" className="text-primary text-sm font-bold">Voltar</Link>
      </div>
    );
  }

  const handleParticipate = () => {
    setParticipated(true);
    // In a real app, this would create a participation with status "Em curso"
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors">
        ← Voltar
      </button>

      <div className="mb-6">
        <span className="text-3xl mb-2 block">{campaign.sportIcon}</span>
        <h1 className="font-bold italic text-2xl text-foreground mb-2">{campaign.description}</h1>
        <span className="text-ui text-xs text-secondary">{campaign.sport}</span>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <MapPin size={16} />
          <span>{campaign.city} — {campaign.region}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Calendar size={16} />
          <span>{campaign.startDate} até {campaign.endDate}</span>
        </div>
      </div>

      {/* Instrução principal */}
      <div className="bg-primary/10 rounded-2xl p-5 mb-4">
        <p className="text-foreground font-bold text-sm">
          📸 Suba uma foto no site 3buk.com com sua melhor atitude praticando seu esporte favorito
        </p>
      </div>

      {/* Instagram */}
      {campaign.instagramOptional && (
        <div className="bg-card rounded-2xl p-5 card-shadow mb-8">
          <div className="flex items-start gap-3">
            <Instagram size={20} className="text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-foreground text-sm font-bold mb-1">Ganhe pontos extras!</p>
              <p className="text-muted-foreground text-sm">
                Publique no Instagram com a hashtag <span className="text-accent font-bold">{campaign.instagramHashtags || '#3bukchallenge'}</span> para ganhar pontos extras na avaliação
              </p>
            </div>
          </div>
        </div>
      )}

      {!participated ? (
        <motion.button
          onClick={handleParticipate}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="w-full bg-primary text-primary-foreground text-ui py-4 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow text-base"
        >
          QUERO PARTICIPAR
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring}
          className="text-center py-6"
        >
          <span className="text-5xl block mb-3">🔥</span>
          <h3 className="font-bold italic text-lg text-foreground mb-2">Participação registrada!</h3>
          <p className="text-muted-foreground text-sm mb-4">Sua participação está em curso. Envie suas evidências na aba Participações.</p>
          <div className="inline-block bg-secondary/20 text-secondary text-sm font-bold px-4 py-2 rounded-full">
            🟢 Em curso
          </div>
        </motion.div>
      )}

      <p className="text-center text-muted-foreground text-xs mt-4">
        🏆 {campaign.winnersCount} ganhador{campaign.winnersCount > 1 ? 'es' : ''} · Prêmio: {campaign.prize}
      </p>
    </div>
  );
};

export default CampaignDetail;
