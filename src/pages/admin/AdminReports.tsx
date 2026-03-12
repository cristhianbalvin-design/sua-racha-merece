import { useState } from 'react';
import { motion } from 'framer-motion';
import { campaigns, participations, users } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

type PrizeStatus = 'Premiado' | 'Pendiente';

const AdminReports = () => {
  const [campaignFilter, setCampaignFilter] = useState('Todas');
  const [participationFilter, setParticipationFilter] = useState('Todos');
  const [prizeFilter, setPrizeFilter] = useState('Todos');

  // Build report data
  const reportData = campaigns.map((campaign) => {
    const campParticipations = participations.filter((p) => p.campaignId === campaign.id);
    const campUsers = campParticipations.map((p) => {
      const user = users.find((u) => u.id === p.userId);
      const prizeStatus: PrizeStatus = p.status === 'Ganhador de patrocínio' ? 'Premiado' : 'Pendiente';
      return { ...p, user, prizeStatus };
    });
    return { campaign, participations: campUsers };
  });

  const filtered = reportData
    .filter((r) => campaignFilter === 'Todas' || r.campaign.id === campaignFilter)
    .map((r) => ({
      ...r,
      participations: r.participations.filter((p) => {
        if (participationFilter === 'Em curso' && r.campaign.status !== 'Em curso') return false;
        if (participationFilter === 'Terminado' && r.campaign.status !== 'Terminado') return false;
        if (prizeFilter === 'Premiado' && p.prizeStatus !== 'Premiado') return false;
        if (prizeFilter === 'Pendiente' && p.prizeStatus !== 'Pendiente') return false;
        return true;
      }),
    }));

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">RELATÓRIO DE CAMPANHAS</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="text-ui text-xs text-muted-foreground block mb-1.5">CAMPANHA</label>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
          >
            <option value="Todas">Todas as campanhas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.sport} — {c.city}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-ui text-xs text-muted-foreground block mb-1.5">PARTICIPAÇÃO</label>
          <select
            value={participationFilter}
            onChange={(e) => setParticipationFilter(e.target.value)}
            className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
          >
            <option value="Todos">Todos</option>
            <option value="Em curso">Em curso</option>
            <option value="Terminado">Terminado</option>
          </select>
        </div>
        <div>
          <label className="text-ui text-xs text-muted-foreground block mb-1.5">PREMIAÇÃO</label>
          <select
            value={prizeFilter}
            onChange={(e) => setPrizeFilter(e.target.value)}
            className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
          >
            <option value="Todos">Todos</option>
            <option value="Premiado">Premiado</option>
            <option value="Pendiente">Pendente</option>
          </select>
        </div>
      </div>

      {/* Report cards */}
      <div className="space-y-6">
        {filtered.map((report, ri) => (
          <motion.div
            key={report.campaign.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: ri * 0.06 }}
            className="bg-card rounded-2xl card-shadow overflow-hidden"
          >
            {/* Campaign header */}
            <div className="p-4 flex items-center justify-between flex-wrap gap-2"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{report.campaign.sportIcon}</span>
                <div>
                  <h3 className="font-bold text-foreground">{report.campaign.sport} — {report.campaign.city}</h3>
                  <p className="text-xs text-muted-foreground">{report.campaign.startDate} a {report.campaign.endDate}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  report.campaign.status === 'Em curso'
                    ? 'bg-secondary/20 text-secondary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {report.campaign.status}
                </span>
              </div>
            </div>

            {/* Participants */}
            {report.participations.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Nenhum participante com os filtros selecionados.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {report.participations.map((p) => (
                  <div key={p.id} className="p-4 flex items-center gap-3">
                    {p.user && (
                      <>
                        <img
                          src={p.user.avatar}
                          alt={p.user.name}
                          className="w-9 h-9 rounded-full object-cover img-outline flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-sm truncate">{p.user.name}</p>
                          <p className="text-xs text-muted-foreground">{p.user.sport} · {p.user.city}</p>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2 flex-shrink-0">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        report.campaign.status === 'Em curso'
                          ? 'bg-secondary/20 text-secondary'
                          : 'bg-success/20 text-success'
                      }`}>
                        {report.campaign.status === 'Em curso' ? 'Em curso' : 'Terminado'}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        p.prizeStatus === 'Premiado'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-warning/20 text-warning'
                      }`}>
                        {p.prizeStatus === 'Premiado' ? '🏆 Premiado' : '⏳ Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminReports;
