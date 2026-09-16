import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Instagram, Trophy, Award } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCampaignById } from '@/lib/mockApi';
import { isCampaignUnavailable } from '@/lib/campaignSharing';
import type { Campaign } from '@/data/mockData';

const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };

const PublicCampaignPreview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  // If user is already authenticated, redirect directly to internal campaign detail
  useEffect(() => {
    if (!authLoading && user && id) {
      navigate(`/campanha/${id}`, { replace: true });
    }
  }, [authLoading, user, id, navigate]);

  useEffect(() => {
    if (!id) return;
    apiGetCampaignById(id)
      .then((data) => {
        setCampaign(data);
      })
      .catch((err) => {
        console.error('Error fetching public campaign:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleQueroParticipar = () => {
    if (!campaign) return;
    localStorage.setItem('3buk_pending_campaign_id', campaign.id);
    navigate(`/registro?campaign=${campaign.id}`);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4 py-16 text-center">
        <span className="text-4xl block mb-3">🔥</span>
        <h2 className="font-bold italic text-xl text-foreground mb-2">Campanha não encontrada.</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs">
          O link pode ter expirado ou a campanha não está mais disponível.
        </p>
        <Link to="/" className="text-primary text-sm font-bold hover:underline">
          Ir para a página inicial
        </Link>
      </div>
    );
  }

  const campaignUnavailable = isCampaignUnavailable(campaign);

  if (campaignUnavailable) {
    return (
      <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4 py-16 text-center">
        <span className="text-4xl block mb-3">⏳</span>
        <h2 className="font-bold italic text-xl text-foreground mb-2">
          Esta campanha já não está mais disponível
        </h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs">
          O prazo para inscrições foi encerrado.
        </p>
        <Link to="/" className="text-primary text-sm font-bold hover:underline">
          Ver outras campanhas
        </Link>
      </div>
    );
  }

  const hasImage = campaign.imageUrl || campaign.imageUrlMobile;

  return (
    <div className="min-h-svh bg-black text-foreground flex flex-col">
      {hasImage && (
        <style>{`
          .campaign-public-bg {
            background-image: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.98) 100%), url(${campaign.imageUrlMobile || campaign.imageUrl});
          }
          @media (min-width: 768px) {
            .campaign-public-bg {
              background-image: linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.65) 100%), url(${campaign.imageUrl || campaign.imageUrlMobile});
            }
          }
        `}</style>
      )}

      {/* Top Bar with Logo */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <Link to="/">
          <Logo size="sm" />
        </Link>
        <Link
          to={`/login?redirectTo=${encodeURIComponent(`/campanha/${campaign.id}`)}`}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60 hover:border-border"
        >
          Entrar
        </Link>
      </header>

      {/* Main Campaign Hero & Details */}
      <main className={`flex-1 bg-cover bg-center bg-no-repeat ${hasImage ? 'campaign-public-bg' : ''}`}>
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 text-primary bg-primary/10 px-3.5 py-2 rounded-2xl border border-primary/20 mb-4">
              <Trophy size={22} className="text-primary" />
              <span className="text-xs font-bold tracking-wide uppercase text-primary">Desafio Aberto</span>
            </div>

            <h1 className="font-bold italic text-3xl md:text-5xl text-foreground mb-3 leading-tight">
              {campaign.name || campaign.description}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-sm font-bold uppercase tracking-wider text-secondary px-2.5 py-1 bg-secondary/10 rounded-md border border-secondary/20">
                {campaign.sport}
              </span>
              {campaign.prize && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent px-2.5 py-1 bg-accent/10 rounded-md border border-accent/20">
                  <Award size={16} />
                  {campaign.prize}
                </span>
              )}
            </div>

            {campaign.description && campaign.description !== campaign.name && (
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed mt-2">
                {campaign.description}
              </p>
            )}
          </div>

          <div className="space-y-3 mb-8 bg-card/40 backdrop-blur-sm p-4 rounded-2xl border border-border/40">
            <div className="flex items-center gap-3 text-muted-foreground text-sm md:text-base">
              <MapPin size={18} className="text-primary shrink-0" />
              <span>{campaign.city} — {campaign.region}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground text-sm md:text-base">
              <Calendar size={18} className="text-primary shrink-0" />
              <span>Válido de {campaign.startDate} até {campaign.endDate}</span>
            </div>
          </div>

          {/* Steps */}
          <div className="mb-8">
            <h2 className="text-foreground font-bold text-lg mb-4">
              Como participar do desafio:
            </h2>
            <div className="space-y-3">
              <div className="bg-primary/10 rounded-2xl p-4 flex items-start gap-4 border border-primary/20">
                <span className="bg-primary text-primary-foreground font-bold rounded-full px-2.5 py-0.5 text-xs uppercase tracking-wide shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-foreground text-sm md:text-base font-semibold">
                  Crie sua conta na 3BUK com seu e-mail ou Google em poucos segundos.
                </p>
              </div>

              <div className="bg-card/70 rounded-2xl p-4 flex items-start gap-4 border border-border/60">
                <span className="bg-secondary text-secondary-foreground font-bold rounded-full px-2.5 py-0.5 text-xs uppercase tracking-wide shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-foreground text-sm md:text-base font-semibold">
                  Envie uma foto ou evidência praticando seu esporte com a melhor atitude.
                </p>
              </div>

              {campaign.instagramOptional && (
                <div className="bg-card/70 rounded-2xl p-4 flex items-start gap-4 border border-secondary/20">
                  <span className="bg-accent text-accent-foreground font-bold rounded-full px-2.5 py-0.5 text-xs uppercase tracking-wide shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <p className="text-foreground text-sm md:text-base font-semibold flex items-center gap-1.5">
                      <Instagram size={18} className="text-accent" />
                      Pontos extras no Instagram!
                    </p>
                    <p className="text-muted-foreground text-xs md:text-sm mt-1">
                      Poste com a hashtag <span className="text-accent font-bold">{campaign.instagramHashtags || '#3bukchallenge'}</span>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CTA Section */}
          <div className="pt-2 pb-10 space-y-4">
            <motion.button
              type="button"
              onClick={handleQueroParticipar}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              className="w-full bg-primary text-primary-foreground text-ui py-4 rounded-xl btn-shadow hover:btn-shadow-hover transition-all text-lg font-bold flex items-center justify-center gap-2"
            >
              QUERO PARTICIPAR
            </motion.button>

            <div className="text-center">
              <Link
                to={`/login?redirectTo=${encodeURIComponent(`/campanha/${campaign.id}`)}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Já tenho conta? Entrar
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicCampaignPreview;
