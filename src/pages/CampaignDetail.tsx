import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Instagram, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCampaigns, apiAddParticipation, apiGetParticipations } from '@/lib/mockApi';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [participated, setParticipated] = useState(false);

  useEffect(() => {
    apiGetCampaigns().then(camps => {
      setCampaign(camps.find(c => c.id === id) || null);
    });
  }, [id]);

  useEffect(() => {
    if (user && id) {
      apiGetParticipations().then(parts => {
        const existing = parts.find(p => p.campaignId === id && p.userId === user.id);
        if (existing) setParticipated(true);
      });
    }
  }, [user, id]);

  if (!campaign) {
    return (
      <div className="px-4 py-16 text-center">
        <span className="text-4xl block mb-3">🔥</span>
        <h2 className="font-bold italic text-xl text-foreground mb-2">Campanha não encontrada.</h2>
        <Link to="/dashboard" className="text-primary text-sm font-bold">Voltar</Link>
      </div>
    );
  }

  const handleParticipate = async () => {
    if (!user || !id) return;
    setParticipated(true);
    
    const result = await apiAddParticipation({
      userId: user.id,
      campaignId: id,
      participationStatus: 'Em curso',
      photo: '',
      instagram: false,
    });
    
    if (!result) {
      setParticipated(false);
      console.error('Failed to insert participation');
    } else {
      navigate('/participacoes');
    }
  };

  const hasImage = campaign.imageUrl || campaign.imageUrlMobile;

  return (
    <>
      {hasImage && (
        <style>{`
          .campaign-detail-bg {
            background-image: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.95) 100%), url(${campaign.imageUrlMobile || campaign.imageUrl});
          }
          @media (min-width: 768px) {
            .campaign-detail-bg {
              background-image: linear-gradient(90deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.84) 38%, rgba(0,0,0,0.58) 72%, rgba(0,0,0,0.78) 100%), url(${campaign.imageUrl || campaign.imageUrlMobile});
            }
          }
        `}</style>
      )}
      <div className={`min-h-[calc(100svh-49px)] bg-black bg-cover bg-center md:bg-[center_right] bg-no-repeat md:min-h-[calc(100svh-65px)] ${hasImage ? 'campaign-detail-bg' : ''}`}>
      <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors">
        ← Voltar
      </button>

      <div className="mb-6">
        <div className="text-primary bg-primary/10 p-3 rounded-2xl border border-primary/20 w-fit mb-4">
          <Trophy size={32} strokeWidth={2} />
        </div>
        <h1 className="font-bold italic text-3xl md:text-4xl text-foreground mb-2">{campaign.name || campaign.description}</h1>
        <span className="text-base text-secondary font-bold uppercase">{campaign.sport}</span>
        {campaign.description && campaign.description !== campaign.name && (
          <p className="text-muted-foreground text-base md:text-lg mt-4 leading-relaxed">
            {campaign.description}
          </p>
        )}
      </div>

      <div className="space-y-3 mb-8">
        <div className="flex items-center gap-3 text-muted-foreground text-base md:text-lg">
          <MapPin size={20} />
          <span>{campaign.city} — {campaign.region}</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground text-base md:text-lg">
          <Calendar size={20} />
          <span>{campaign.startDate} até {campaign.endDate}</span>
        </div>
      </div>

      {/* Instruções Numéricas */}
      <div className="mb-4">
        <h3 className="text-foreground font-bold text-lg mb-4">Siga estes passos para validar sua participação:</h3>
      </div>
      <div className="space-y-4 mb-10">
        <div className="bg-primary/10 rounded-2xl p-5 flex flex-col sm:flex-row items-start gap-4">
          <div className="bg-primary text-primary-foreground font-bold rounded-full px-3 py-1 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs uppercase tracking-wide">
            Passo 1
          </div>
          <p className="text-foreground font-bold text-base md:text-lg leading-snug">
            Envie uma foto em 3buk.com mostrando sua melhor atitude enquanto pratica seu esporte favorito.
          </p>
        </div>

        {campaign.instagramOptional && (
          <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col sm:flex-row items-start gap-4 border border-secondary/20">
            <div className="bg-secondary text-secondary-foreground font-bold rounded-full px-3 py-1 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs uppercase tracking-wide">
              Passo 2
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Instagram size={24} className="text-secondary" />
                <p className="text-foreground text-base md:text-lg font-bold">Ganhe pontos extras!</p>
              </div>
              <p className="text-muted-foreground text-base leading-snug">
                Publique no Instagram com a hashtag <span className="text-accent font-bold">{campaign.instagramHashtags || '#3bukchallenge'}</span> para ganhar pontos extras na avaliação.
              </p>
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col sm:flex-row items-start gap-4 border border-success/20">
          <div className="bg-success text-success-foreground font-bold rounded-full px-3 py-1 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs uppercase tracking-wide">
            Passo {campaign.instagramOptional ? '3' : '2'}
          </div>
          <p className="text-foreground font-bold text-base md:text-lg leading-snug">
            É isso! Você concluiu sua participação. Agora é só aguardar os resultados. Lembre-se de manter sempre uma excelente atitude!
          </p>
        </div>
      </div>

      {!participated ? (
        <motion.button
          onClick={handleParticipate}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="w-full bg-primary text-primary-foreground text-ui py-5 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow text-lg md:text-xl font-bold"
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
            🟢 EM CURSO
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-center gap-2 text-center text-muted-foreground text-xs mt-4">
        <Trophy size={14} className="text-accent" />
        <span>{campaign.winnersCount} ganhador{campaign.winnersCount > 1 ? 'es' : ''} · Prêmio: {campaign.prize}</span>
      </div>
      </div>
    </div>
    </>
  );
};

export default CampaignDetail;
