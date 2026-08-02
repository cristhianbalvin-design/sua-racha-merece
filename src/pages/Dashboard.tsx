import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import CampaignCard from '@/components/CampaignCard';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetAvailableCampaigns, apiGetSports, apiGetRegions, apiGetParticipations } from '@/lib/mockApi';
import { Campaign, Participation } from '@/data/mockData';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const Dashboard = () => {
  const { user } = useAuth();
  const [sportFilter, setSportFilter] = useState('Todos');
  const [regionFilter, setRegionFilter] = useState('Todos');
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [joinedCampaignIds, setJoinedCampaignIds] = useState<Set<string>>(new Set());
  const [sportsMaster, setSportsMaster] = useState<string[]>([]);
  const [regionsMaster, setRegionsMaster] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [camps, sports, regions] = await Promise.all([
          apiGetAvailableCampaigns(),
          apiGetSports(),
          apiGetRegions()
        ]);

        setCampaigns(camps);
        setSportsMaster(sports);
        setRegionsMaster(regions);

        if (user) {
          const parts = await apiGetParticipations();
          const ids = new Set(parts.filter((p: Participation) => p.userId === user.id).map((p: Participation) => p.campaignId));
          setJoinedCampaignIds(ids);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (!user || isLoading) return null;

  const filteredCampaigns = campaigns.filter((c) => {
    if (c.isHidden) return false;
    if (joinedCampaignIds.has(c.id)) return false; // Hide already joined
    if (sportFilter !== 'Todos' && c.sport !== sportFilter) return false;
    if (regionFilter !== 'Todos' && c.region !== regionFilter) return false;
    return true;
  });

  const availableSports = ['Todos', ...sportsMaster];
  const availableRegions = ['Todos', ...regionsMaster];

  return (
    <div className="px-4 md:px-8 py-4 max-w-4xl mx-auto">
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
          {/* Region filter */}
          <div className="flex gap-3">
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
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 px-4 bg-card/30 rounded-3xl border border-dashed border-border/50 max-w-lg mx-auto mt-8"
          >
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl block">🔍</span>
            </div>
            <h3 className="font-bold italic text-xl text-foreground mb-3">NENHUMA CAMPANHA ENCONTRADA</h3>
            <p className="text-muted-foreground mb-6">Não achamos nenhuma campanha com os filtros atuais. Que tal explorar outras opções?</p>
            <motion.button
              onClick={() => { setSportFilter('Todos'); setRegionFilter('Todos'); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground text-ui px-6 py-2.5 rounded-full transition-colors"
            >
              LIMPAR FILTROS
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredCampaigns.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: i * 0.06 }}
              >
                <CampaignCard campaign={campaign} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
