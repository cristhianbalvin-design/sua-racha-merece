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

  const statusColor = campaign.status === 'Aberto'
    ? 'bg-success/20 text-success'
    : 'bg-muted text-muted-foreground';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={spring}
      className="bg-card rounded-2xl p-4 card-shadow hover:card-shadow-hover transition-shadow flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex items-center gap-2">
          <span className={`text-ui text-xs px-2 py-0.5 rounded-full font-bold ${statusColor}`}>
            {campaign.status?.toUpperCase() || 'ABERTO'}
          </span>
          <span className="text-ui text-xs text-secondary font-semibold">{campaign.sport}</span>
        </div>
      </div>
      <h3 className="font-bold italic text-lg text-foreground mb-3 flex-1 line-clamp-2">
        {campaign.description || `Campanha de ${campaign.sport}`}
      </h3>
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <MapPin size={14} />
        <span>{campaign.city || '—'}{campaign.region ? ` — ${campaign.region}` : ''}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        <Calendar size={14} />
        <span>{campaign.startDate} até {campaign.endDate}</span>
      </div>
      {campaign.prize && (
        <div className="flex items-center gap-2 text-accent text-sm font-bold mb-4">
          <Trophy size={14} />
          <span>{campaign.prize}</span>
        </div>
      )}
      <Link to={`/campanha/${campaign.id}`}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
        >
          PARTICIPAR
        </motion.button>
      </Link>
    </motion.div>
  );
};

export default CampaignCard;

