import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { participations, users, campaigns } from '@/data/mockData';
import { X, Trophy } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

interface ScoreEntry {
  attitude: number | '';
  commitment: number;
  continuity: number | '';
  total: number;
  status: 'Concluído' | 'Qualificado' | 'Ganhador';
}

const AdminQualification = () => {
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, ScoreEntry>>({});

  // Filter: participation=Concluído, campaign=Concluído, user=Ativo
  const eligible = participations
    .filter((p) => p.participationStatus === 'Concluído')
    .map((p) => {
      const user = users.find((u) => u.id === p.userId);
      const campaign = campaigns.find((c) => c.id === p.campaignId);
      return { ...p, user, campaign };
    })
    .filter((p) => p.campaign?.status === 'Concluído' && p.user?.userStatus === 'Ativo');

  const getScore = (id: string): ScoreEntry => {
    return scores[id] || { attitude: '', commitment: 10, continuity: '', total: 0, status: 'Concluído' };
  };

  const updateScore = (id: string, field: 'attitude' | 'continuity', value: string) => {
    const current = getScore(id);
    const numVal = value === '' ? '' : Math.min(10, Math.max(0, parseFloat(value) || 0));
    const updated = { ...current, [field]: numVal };

    const att = typeof updated.attitude === 'number' ? updated.attitude : 0;
    const cont = typeof updated.continuity === 'number' ? updated.continuity : 0;
    updated.total = parseFloat((att + updated.commitment + cont).toFixed(2));

    // Auto-qualify when all 3 fields have values
    if (typeof updated.attitude === 'number' && updated.attitude > 0 &&
        typeof updated.continuity === 'number' && updated.continuity > 0) {
      if (updated.status === 'Concluído') {
        updated.status = 'Qualificado';
      }
    }

    setScores((prev) => ({ ...prev, [id]: updated }));
  };

  const markWinner = (id: string) => {
    const current = getScore(id);
    setScores((prev) => ({ ...prev, [id]: { ...current, status: 'Ganhador' } }));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">QUALIFICAÇÃO</h1>

      {eligible.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">📋</span>
          <p className="text-muted-foreground">Nenhum participante elegível para qualificação.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">PARTICIPANTE</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">CAMPANHA</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">VENCIMENTO</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">ATITUDE</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">COMPROMISSO</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">CONTINUIDADE</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">TOTAL</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eligible.map((p) => {
                  const score = getScore(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-foreground font-bold">{p.user?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.campaign?.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.campaign?.endDate}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={score.attitude}
                          onChange={(e) => updateScore(p.id, 'attitude', e.target.value)}
                          disabled={score.status === 'Ganhador'}
                          className="w-16 bg-input text-foreground text-center rounded-lg px-2 py-1.5 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-16 bg-muted text-foreground text-center rounded-lg px-2 py-1.5 text-sm font-bold">
                          {score.commitment}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={score.continuity}
                          onChange={(e) => updateScore(p.id, 'continuity', e.target.value)}
                          disabled={score.status === 'Ganhador'}
                          className="w-16 bg-input text-foreground text-center rounded-lg px-2 py-1.5 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-16 bg-accent/20 text-accent text-center rounded-lg px-2 py-1.5 text-sm font-bold mx-auto">
                          {score.total}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <motion.button
                            onClick={() => setShowDetail(p.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="text-xs font-bold text-secondary hover:underline"
                          >
                            DETALHES
                          </motion.button>
                          {score.status !== 'Ganhador' && score.status === 'Qualificado' && (
                            <motion.button
                              onClick={() => markWinner(p.id)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              transition={spring}
                              className="bg-warning/20 text-warning text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                            >
                              <Trophy size={12} />
                              GANHADOR
                            </motion.button>
                          )}
                          {score.status === 'Ganhador' && (
                            <span className="text-warning text-xs font-bold">🏆 GANHADOR</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {showDetail && (() => {
          const p = eligible.find((x) => x.id === showDetail);
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
                <div className="relative">
                  <img src={p.photo} alt="Evidência" className="w-full h-64 object-cover" />
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
                  <div className="flex items-center gap-3">
                    <img src={p.user.avatar} alt={p.user.name} className="w-12 h-12 rounded-full object-cover img-outline" />
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{p.user.name}</h3>
                      <p className="text-xs text-muted-foreground">{p.user.sport} · {p.user.city}</p>
                    </div>
                  </div>
                  {p.comment && (
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-1">COMENTÁRIO</label>
                      <p className="text-foreground text-sm italic bg-muted rounded-xl p-3">"{p.comment}"</p>
                    </div>
                  )}
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-1">CAMPANHA</label>
                    <p className="text-foreground text-sm">{p.campaign?.description}</p>
                  </div>
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-1">INSTAGRAM</label>
                    <p className="text-foreground text-sm">
                      {p.instagram ? '📸 Publicou com #3bukchallenge' : '❌ Não publicou'}
                    </p>
                  </div>
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

export default AdminQualification;
