import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { apiGetParticipations, apiGetUsers, apiGetCampaigns, apiGetSports } from '@/lib/mockApi';
import { Participation, User, Campaign } from '@/data/mockData';
import { X } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const partStatusColor: Record<string, string> = {
  'EM CURSO': 'bg-secondary/20 text-secondary',
  'CONCLUÍDO': 'bg-success/20 text-success',
  'NÃO CONCLUÍDO': 'bg-destructive/20 text-destructive',
  'QUALIFICADO': 'bg-accent/20 text-accent',
  'GANHADOR': 'bg-warning/20 text-warning',
};

const campStatusColor: Record<string, string> = {
  'Aberto': 'bg-secondary/20 text-secondary',
  'Concluído': 'bg-success/20 text-success',
  'Eliminado': 'bg-destructive/20 text-destructive',
  'Qualificado': 'bg-accent/20 text-accent',
};

const formatCampMonth = (dateStr?: string) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  const str = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const AdminParticipations = () => {
  const [campaignFilter, setCampaignFilter] = useState('Todas');
  const [planFilter, setPlanFilter] = useState('Todos');
  const [partStatusFilter, setPartStatusFilter] = useState('Todos');
  const [campStatusFilter, setCampStatusFilter] = useState('Todos');
  const [sportFilter, setSportFilter] = useState('Todos');
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const [parts, setParts] = useState<Participation[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [campsList, setCampsList] = useState<Campaign[]>([]);
  const [sportsList, setSportsList] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      apiGetParticipations(),
      apiGetUsers(),
      apiGetCampaigns(),
      apiGetSports(),
    ]).then(([partsData, usersData, campsData, sportsData]) => {
      setParts(partsData);
      setUsersList(usersData);
      setCampsList(campsData);
      setSportsList(sportsData);
    });
  }, []);

  const enriched = parts.map((p) => {
    const user = usersList.find((u) => u.id === p.userId);
    const campaign = campsList.find((c) => c.id === p.campaignId);
    return { ...p, user, campaign };
  }).sort((a, b) => {
    const dateA = a.campaign ? new Date(a.campaign.createdAt).getTime() : 0;
    const dateB = b.campaign ? new Date(b.campaign.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const filtered = enriched.filter((p) => {
    if (campaignFilter !== 'Todas' && p.campaign?.id !== campaignFilter) return false;
    if (planFilter !== 'Todos' && p.user?.plan !== planFilter) return false;
    if (partStatusFilter !== 'Todos' && p.participationStatus !== partStatusFilter) return false;
    if (campStatusFilter !== 'Todos' && p.campaign?.status !== campStatusFilter) return false;
    if (sportFilter !== 'Todos' && p.campaign?.sport !== sportFilter) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">PARTICIPAÇÕES</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none">
          <option value="Todas">Todas as campanhas</option>
          {campsList.map((c) => (
            <option key={c.id} value={c.id}>{c.description}</option>
          ))}
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none">
          <option value="Todos">Todos os planos</option>
          <option value="Freemium">Freemium</option>
          <option value="Premium">Premium</option>
        </select>
        <select value={partStatusFilter} onChange={(e) => setPartStatusFilter(e.target.value)}
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none">
          <option value="Todos">Estado participação</option>
          <option value="EM CURSO">EM CURSO</option>
          <option value="CONCLUÍDO">CONCLUÍDO</option>
          <option value="NÃO CONCLUÍDO">NÃO CONCLUÍDO</option>
          <option value="QUALIFICADO">QUALIFICADO</option>
          <option value="GANHADOR">GANHADOR</option>
        </select>
        <select value={campStatusFilter} onChange={(e) => setCampStatusFilter(e.target.value)}
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none">
          <option value="Todos">Estado campanha</option>
          <option value="Aberto">Aberto</option>
          <option value="Concluído">Concluído</option>
          <option value="Eliminado">Eliminado</option>
          <option value="Qualificado">Qualificado</option>
        </select>
        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none">
          <option value="Todos">Todos os esportes</option>
          {sportsList.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Report table */}
      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">PARTICIPANTE</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">PLANO</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">ESPORTE</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">CAMPANHA</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">MÊS DA CAMPANHA</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">EST. PARTICIPAÇÃO</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">EST. CAMPANHA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma participação encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-foreground font-bold">{p.user?.name || 'N/A'}</p>
                      {p.user?.email && <p className="text-xs text-muted-foreground">{p.user.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {p.user && <PlanBadge plan={p.user.plan} />}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.campaign?.sportIcon} {p.campaign?.sport || 'N/A'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.campaign?.description || 'N/A'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatCampMonth(p.campaign?.startDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${partStatusColor[p.participationStatus] || 'bg-muted text-muted-foreground'}`}>
                        {p.participationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${campStatusColor[p.campaign?.status || ''] || 'bg-muted text-muted-foreground'}`}>
                        {p.campaign?.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminParticipations;
