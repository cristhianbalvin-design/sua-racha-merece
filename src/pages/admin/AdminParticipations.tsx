import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { participations, users, campaigns } from '@/data/mockData';
import { ExternalLink, X } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminParticipations = () => {
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [assignedWinners, setAssignedWinners] = useState<string[]>([]);
  const [approvedParticipations, setApprovedParticipations] = useState<string[]>([]);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');

  const enriched = participations.map((p) => {
    const user = users.find((u) => u.id === p.userId);
    const campaign = campaigns.find((c) => c.id === p.campaignId);
    return { ...p, user, campaign };
  });

  const filtered = enriched.filter((p) => {
    if (campaignFilter !== 'Todas' && p.campaign?.id !== campaignFilter) return false;
    if (statusFilter === 'Aprovar' && (approvedParticipations.includes(p.id) || assignedWinners.includes(p.id))) return false;
    if (statusFilter === 'Aprobado' && !approvedParticipations.includes(p.id) && !assignedWinners.includes(p.id)) return false;
    return true;
  });

  const handleAssignWinner = (partId: string) => {
    setAssignedWinners((prev) => [...prev, partId]);
    setShowConfirm(null);
  };

  const handleApprove = (partId: string) => {
    setApprovedParticipations((prev) => [...prev, partId]);
  };

  const activeCampaigns = campaigns.filter((c) => c.status === 'Em curso');

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">PARTICIPAÇÕES</h1>

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
            {activeCampaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.sport} — {c.city}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-ui text-xs text-muted-foreground block mb-1.5">ESTADO</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
          >
            <option value="Todos">Todos</option>
            <option value="Aprovar">Pendente de aprovação</option>
            <option value="Aprobado">Aprovados</option>
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl block mb-3">📋</span>
            <p className="text-muted-foreground">Nenhuma participação encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.06 }}
              className="bg-card rounded-2xl overflow-hidden card-shadow"
            >
              {/* Photo */}
              <img
                src={p.photo}
                alt="Participação"
                className="w-full h-56 object-cover img-outline"
              />

              <div className="p-4">
                {/* User info */}
                <div className="flex items-center gap-3 mb-3">
                  {p.user && (
                    <>
                      <img
                        src={p.user.avatar}
                        alt={p.user.name}
                        className="w-10 h-10 rounded-full object-cover img-outline"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground">{p.user.name}</h3>
                          <PlanBadge plan={p.user.plan} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.user.sport} · {p.user.city} · {p.user.campaignsParticipated} campanhas participadas
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {p.comment && (
                  <p className="text-sm text-muted-foreground italic mb-3">"{p.comment}"</p>
                )}

                <p className="text-xs text-muted-foreground mb-4">
                  {p.campaign?.sport} — {p.campaign?.city} · {p.timestamp}
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                  {/* Detail button */}
                  <motion.button
                    onClick={() => setShowDetail(p.id)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    className="bg-muted/50 text-muted-foreground text-ui text-xs py-2.5 px-3 rounded-xl flex items-center gap-1.5"
                  >
                    <ExternalLink size={14} />
                    DETALHES
                  </motion.button>

                  {!approvedParticipations.includes(p.id) && !assignedWinners.includes(p.id) && (
                    <>
                      <motion.button
                        onClick={() => handleApprove(p.id)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={spring}
                        className="flex-1 bg-muted text-foreground text-ui text-xs py-2.5 rounded-xl btn-shadow"
                      >
                        APROVAR
                      </motion.button>
                      <motion.button
                        onClick={() => setShowConfirm(p.id)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={spring}
                        className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-2.5 rounded-xl btn-shadow"
                      >
                        SELECIONAR GANHADOR
                      </motion.button>
                    </>
                  )}
                  {approvedParticipations.includes(p.id) && !assignedWinners.includes(p.id) && (
                    <span className="text-success text-sm font-bold flex-1 text-right">✅ Aprovado</span>
                  )}
                  {assignedWinners.includes(p.id) && (
                    <span className="text-accent text-sm font-bold flex-1 text-right">🏆 Ganhador · Notificação enviada</span>
                  )}
                </div>
              </div>

              {/* Confirmation modal */}
              <AnimatePresence>
                {showConfirm === p.id && p.user && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
                  >
                    <motion.div
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.95 }}
                      className="bg-card rounded-2xl p-6 card-shadow max-w-sm w-full"
                    >
                      <h3 className="font-bold italic text-lg text-foreground mb-3">
                        Atribuir patrocínio?
                      </h3>
                      <p className="text-muted-foreground text-sm mb-6">
                        Tem certeza que deseja atribuir o patrocínio a <span className="text-foreground font-bold">{p.user.name}</span>?
                      </p>
                      <div className="flex gap-3">
                        <motion.button
                          onClick={() => setShowConfirm(null)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          transition={spring}
                          className="flex-1 bg-muted text-foreground text-ui text-xs py-2.5 rounded-xl"
                        >
                          CANCELAR
                        </motion.button>
                        <motion.button
                          onClick={() => handleAssignWinner(p.id)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          transition={spring}
                          className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-2.5 rounded-xl btn-shadow"
                        >
                          ATRIBUIR PATROCÍNIO
                        </motion.button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && (() => {
          const p = enriched.find((x) => x.id === showDetail);
          if (!p || !p.user) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-card rounded-2xl card-shadow max-w-lg w-full max-h-[90vh] overflow-y-auto"
              >
                {/* Photo */}
                <div className="relative">
                  <img src={p.photo} alt="Participação" className="w-full h-64 object-cover" />
                  <motion.button
                    onClick={() => setShowDetail(null)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm text-foreground w-8 h-8 rounded-full flex items-center justify-center"
                  >
                    <X size={16} />
                  </motion.button>
                </div>

                <div className="p-6 space-y-4">
                  {/* User */}
                  <div className="flex items-center gap-3">
                    <img src={p.user.avatar} alt={p.user.name} className="w-12 h-12 rounded-full object-cover img-outline" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground text-lg">{p.user.name}</h3>
                        <PlanBadge plan={p.user.plan} />
                      </div>
                      <p className="text-xs text-muted-foreground">{p.user.sport} · {p.user.city}</p>
                    </div>
                  </div>

                  {/* Comment */}
                  {p.comment && (
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-1">COMENTÁRIO</label>
                      <p className="text-foreground text-sm italic bg-muted rounded-xl p-3">"{p.comment}"</p>
                    </div>
                  )}

                  {/* Campaign */}
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-1">CAMPANHA</label>
                    <p className="text-foreground text-sm">{p.campaign?.sport} — {p.campaign?.city} ({p.campaign?.startDate} a {p.campaign?.endDate})</p>
                  </div>

                  {/* Registration date */}
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-1">REGISTRADO NA PLATAFORMA DESDE</label>
                    <p className="text-foreground text-sm">{p.user.registeredAt || 'N/A'}</p>
                  </div>

                  {/* Participation stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{p.user.campaignsParticipated}</p>
                      <p className="text-xs text-muted-foreground">Participações</p>
                    </div>
                    <div className="bg-muted rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-accent">{p.user.campaignsWon}</p>
                      <p className="text-xs text-muted-foreground">Vitórias</p>
                    </div>
                  </div>

                  {/* Concluded status */}
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-1">STATUS DE CONCLUSÃO</label>
                    <span className={`inline-flex text-xs font-bold px-3 py-1 rounded-full ${
                      p.concluded
                        ? 'bg-success/20 text-success'
                        : 'bg-warning/20 text-warning'
                    }`}>
                      {p.concluded ? '✅ Concluído' : '⏳ Não concluído'}
                    </span>
                  </div>

                  {/* Instagram */}
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-1">INSTAGRAM</label>
                    <p className="text-foreground text-sm">
                      {p.instagram ? '📸 Publicou com #3bukchallenge' : '❌ Não publicou no Instagram'}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-1">DATA DA PARTICIPAÇÃO</label>
                    <p className="text-foreground text-sm">{p.timestamp}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default AdminParticipations;
