import { useState } from 'react';
import { motion } from 'framer-motion';
import CampaignCard from '@/components/CampaignCard';
import PlanBadge from '@/components/PlanBadge';
import { campaigns, currentUser, sportsMaster, regionsMaster } from '@/data/mockData';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const Dashboard = () => {
  const [sportFilter, setSportFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [regionFilter, setRegionFilter] = useState('Todos');

  const filteredCampaigns = campaigns.filter((c) => {
    if (sportFilter !== 'Todos' && c.sport !== sportFilter) return false;
    if (statusFilter !== 'Todos' && c.status !== statusFilter) return false;
    if (regionFilter !== 'Todos' && c.region !== regionFilter) return false;
    return true;
  });

  const availableSports = ['Todos', ...new Set(campaigns.map((c) => c.sport))];
  const campaignStatuses = ['Todos', 'Aberto', 'Concluído'];
  const availableRegions = ['Todos', ...new Set(campaigns.map((c) => c.region))];

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

      <section>
        <h2 className="font-bold italic text-xl text-foreground mb-4">CAMPANHAS DISPONÍVEIS</h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Sport filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full">
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
          {/* Status & Region filters */}
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-input text-foreground rounded-lg px-3 py-2 text-xs input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
            >
              {campaignStatuses.map((s) => (
                <option key={s} value={s}>{s === 'Todos' ? 'Todos os estados' : s}</option>
              ))}
            </select>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-input text-foreground rounded-lg px-3 py-2 text-xs input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
            >
              {availableRegions.map((r) => (
                <option key={r} value={r}>{r === 'Todos' ? 'Todas as regiões' : r}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl block mb-3">🔍</span>
            <h3 className="font-bold italic text-lg text-foreground mb-2">Nenhuma campanha encontrada.</h3>
            <p className="text-sm text-muted-foreground">Tente outro filtro!</p>
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
