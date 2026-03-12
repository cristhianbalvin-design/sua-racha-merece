import { motion } from 'framer-motion';
import type { Winner } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const WinnerCard = ({ winner }: { winner: Winner }) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={spring}
      className="bg-card rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-shadow"
    >
      <div className="relative h-48">
        <img
          src={winner.photo}
          alt={winner.user.name}
          className="w-full h-full object-cover img-outline"
        />
        <span className="absolute top-3 left-3 text-3xl">{winner.medal}</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={winner.user.avatar}
            alt={winner.user.name}
            className="w-10 h-10 rounded-full object-cover img-outline"
          />
          <div>
            <h4 className="font-bold text-foreground">{winner.user.name}</h4>
            <p className="text-xs text-muted-foreground">{winner.user.sport} — {winner.user.city}</p>
          </div>
        </div>
        <p className="text-sm text-accent font-bold mb-2">🎁 {winner.prize}</p>
        <p className="text-sm text-muted-foreground italic">"{winner.justification}"</p>
      </div>
    </motion.div>
  );
};

export default WinnerCard;
