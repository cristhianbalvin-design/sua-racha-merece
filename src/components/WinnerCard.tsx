import { motion } from "framer-motion";
import { CalendarDays, Gift, MapPin, Trophy } from "lucide-react";
import type { Winner } from "@/data/mockData";

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const medalPosition: Record<string, string> = {
  "\u{1F947}": "1º lugar",
  "\u{1F948}": "2º lugar",
  "\u{1F949}": "3º lugar",
};

const WinnerCard = ({ winner }: { winner: Winner }) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={spring}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card card-shadow transition-shadow hover:card-shadow-hover"
    >
      <div className="relative h-48 overflow-hidden bg-black/90">
        <img
          src={winner.photo}
          alt={winner.user.name}
          className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
        <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-background/85 text-primary backdrop-blur-sm">
          <Trophy size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-success/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success backdrop-blur-sm">
          {medalPosition[winner.medal] || "Ganhador"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={winner.user.avatar}
            alt={winner.user.name}
            className="w-10 h-10 rounded-full object-cover img-outline"
          />
          <div>
            <h4 className="font-bold text-foreground">{winner.user.name}</h4>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} aria-hidden="true" />
              <span>
                {winner.user.sport} — {winner.user.city}
              </span>
            </p>
          </div>
        </div>
        {winner.campaignMonth && (
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-secondary">
            <CalendarDays size={13} aria-hidden="true" />
            <span>{winner.campaignMonth}</span>
          </p>
        )}
        <p className="mb-2 flex items-start gap-1.5 text-sm font-bold text-accent">
          <Gift size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{winner.prize}</span>
        </p>
        <p className="mt-auto text-sm italic text-muted-foreground">
          "{winner.justification}"
        </p>
      </div>
    </motion.div>
  );
};

export default WinnerCard;
