import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Trophy } from 'lucide-react';
import type { Campaign } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const sportIconFallback: Record<string, string> = {
  'Corrida': '🏃',
  'Crossfit': '🏋️',
  'Ciclismo': '🚴',
  'Natação': '🏊',
  'Futebol': '⚽',
  'Basquete': '🏀',
  'Vôlei': '🏐',
  'Tênis': '🎾',
  'Boxe': '🥊',
  'Baloncesto': '🏀',
  'Nadar': '🏊',
};

const CampaignCard = ({ campaign }: { campaign: Campaign }) => {
  const icon = campaign.sportIcon || sportIconFallback[campaign.sport] || '🏆';

  const hasImage = !!(campaign.imageUrlMobile || campaign.imageUrl);

  const statusColor = campaign.status === 'Aberto'
    ? 'bg-success/20 text-success'
    : 'bg-muted text-muted-foreground';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={spring}
      className="group relative bg-card rounded-2xl p-4 card-shadow hover:card-shadow-hover transition-shadow flex flex-col overflow-hidden"
    >
      {hasImage && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-500 z-0"
            style={{ backgroundImage: `url(${campaign.imageUrlMobile || campaign.imageUrl})` }}
          />
          <div 
            className="absolute inset-0 z-0"
            style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 48%, rgba(0,0,0,0.28) 100%)` }}
          />
        </>
      )}

      <div className="relative z-10 flex flex-col h-full flex-1">
        <div className="flex items-start justify-between mb-3">
          <div className="text-primary bg-primary/10 p-2 rounded-xl border border-primary/20">
            <Trophy size={20} strokeWidth={2} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-ui text-xs px-2 py-0.5 rounded-full font-bold ${statusColor}`}>
              {campaign.status?.toUpperCase() || 'ABERTO'}
            </span>
            <span className="text-ui text-xs text-secondary font-semibold">{campaign.sport}</span>
          </div>
        </div>
        <h3 className="font-bold italic text-lg text-foreground mb-3 flex-1 line-clamp-2 drop-shadow-sm">
          {campaign.name || campaign.description || `Campanha de ${campaign.sport}`}
        </h3>
        <div className={`flex items-center gap-2 text-sm mb-1 ${hasImage ? 'text-white/85' : 'text-muted-foreground'}`}>
          <MapPin size={14} />
          <span>{campaign.city || '—'}{campaign.region ? ` — ${campaign.region}` : ''}</span>
        </div>
        <div className={`flex items-center gap-2 text-sm mb-2 ${hasImage ? 'text-white/85' : 'text-muted-foreground'}`}>
          <Calendar size={14} />
          <span>{campaign.startDate} até {campaign.endDate}</span>
        </div>
        {campaign.prize && (
          <div className="flex items-center gap-2 text-accent text-sm font-bold mb-4">
            <Trophy size={14} />
            <span>{campaign.prize}</span>
          </div>
        )}
        <Link to={`/campanha/${campaign.id}`} className="mt-auto">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
          >
            PARTICIPAR
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
};

export default CampaignCard;
