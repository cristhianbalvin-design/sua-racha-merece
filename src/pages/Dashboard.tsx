import { useState } from 'react';
import { motion } from 'framer-motion';
import CampaignCard from '@/components/CampaignCard';
import PlanBadge from '@/components/PlanBadge';
import { campaigns, currentUser, sports } from '@/data/mockData';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const Dashboard = () => {
  const [sportFilter, setSportFilter] = useState('Todos');

  const filteredCampaigns = sportFilter === 'Todos'
    ? campaigns
    : campaigns.filter((c) => c.sport === sportFilter);

  const availableSports = ['Todos', ...new Set(campaigns.map((c) => c.sport))];

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
      {/* Header mobile */}
      <div className="flex items-center justify-between mb-8 md:hidden">
        <div>
          <h1 className="font-bold italic text-xl text-foreground">Olá, {currentUser.name.split(' ')[0]}!</h1>
          <PlanBadge plan={currentUser.plan} />
        </div>
        <img
          src={currentUser.avatar}
          alt={currentUser.name}
          className="w-10 h-10 rounded-full object-cover img-outline"
        />
      </div>

      {/* Campanhas disponíveis */}
      <section>
        <h2 className="font-bold italic text-xl text-foreground mb-4">CAMPANHAS DISPONÍVEIS</h2>

        {/* Sport filter */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          {availableSports.map((sport) => (
            <motion.button
              key={sport}
              onClick={() => setSportFilter(sport)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className={`text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                sportFilter === sport
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {sport}
            </motion.button>
          ))}
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl block mb-3">🔍</span>
            <h3 className="font-bold italic text-lg text-foreground mb-2">Nenhuma campanha encontrada.</h3>
            <p className="text-sm text-muted-foreground">Tente outro filtro de esporte!</p>
          </div>
        ) : (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid md:grid-cols-2 gap-6"
          >
            {filteredCampaigns.map((campaign) => (
              <motion.div key={campaign.id} variants={fadeIn} transition={spring}>
                <CampaignCard campaign={campaign} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
