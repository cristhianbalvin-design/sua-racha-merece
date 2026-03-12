import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Calendar } from 'lucide-react';
import type { Campaign } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const CampaignCard = ({ campaign }: { campaign: Campaign }) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={spring}
      className="bg-card rounded-2xl p-4 card-shadow hover:card-shadow-hover transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{campaign.sportIcon}</span>
        <span className="text-ui text-xs text-secondary">{campaign.sport}</span>
      </div>
      <h3 className="font-bold italic text-lg text-foreground mb-2">{campaign.description}</h3>
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <MapPin size={14} />
        <span>{campaign.city} — {campaign.region}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
        <Calendar size={14} />
        <span>{campaign.startDate} até {campaign.endDate}</span>
      </div>
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
