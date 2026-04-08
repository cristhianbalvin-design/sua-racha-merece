import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiGetUsers, apiGetCampaigns, apiGetParticipations } from '@/lib/mockApi';
import { Users, Target, Activity, Trophy } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminRelatorio = () => {
  const [stats, setStats] = useState({
    users: 0,
    activeCampaigns: 0,
    participations: 0,
    winners: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      const users = await apiGetUsers();
      const campaigns = await apiGetCampaigns();
      const parts = await apiGetParticipations();
      
      setStats({
        users: users.length,
        activeCampaigns: campaigns.filter(c => c.status === 'Aberto').length,
        participations: parts.length,
        winners: parts.filter(p => p.participationStatus === 'Ganhador').length
      });
    };
    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">RELATÓRIO PRINCIPAL</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0 }} className="bg-card rounded-2xl p-6 card-shadow flex flex-col items-center justify-center text-center">
          <Users size={28} className="text-primary mb-3" />
          <p className="text-3xl font-bold text-foreground">{stats.users}</p>
          <p className="text-xs text-muted-foreground font-bold mt-1">USUÁRIOS ATIVOS</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="bg-card rounded-2xl p-6 card-shadow flex flex-col items-center justify-center text-center">
          <Target size={28} className="text-secondary mb-3" />
          <p className="text-3xl font-bold text-foreground">{stats.activeCampaigns}</p>
          <p className="text-xs text-muted-foreground font-bold mt-1">CAMPANHAS ABERTAS</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="bg-card rounded-2xl p-6 card-shadow flex flex-col items-center justify-center text-center">
          <Activity size={28} className="text-accent mb-3" />
          <p className="text-3xl font-bold text-foreground">{stats.participations}</p>
          <p className="text-xs text-muted-foreground font-bold mt-1">TOTAL PARTICIPAÇÕES</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 }} className="bg-card rounded-2xl p-6 card-shadow flex flex-col items-center justify-center text-center">
          <Trophy size={28} className="text-warning mb-3" />
          <p className="text-3xl font-bold text-foreground">{stats.winners}</p>
          <p className="text-xs text-muted-foreground font-bold mt-1">GANHADORES</p>
        </motion.div>
      </div>
      
      <div className="bg-card rounded-2xl p-6 card-shadow">
        <h3 className="font-bold italic text-lg text-foreground mb-4">MÉTRICAS DETALHADAS</h3>
        <p className="text-sm text-muted-foreground text-center py-12">Gráficos de análise serão integrados com a API do Supabase na próxima fase.</p>
      </div>
    </div>
  );
};

export default AdminRelatorio;
