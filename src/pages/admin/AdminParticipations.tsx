import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { participations, users, campaigns } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminParticipations = () => {
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [assignedWinners, setAssignedWinners] = useState<string[]>([]);
  const [approvedParticipations, setApprovedParticipations] = useState<string[]>([]);

  const enriched = participations.map((p) => {
    const user = users.find((u) => u.id === p.userId);
    const campaign = campaigns.find((c) => c.id === p.campaignId);
    return { ...p, user, campaign };
  });

  const handleAssignWinner = (userId: string) => {
    setAssignedWinners((prev) => [...prev, userId]);
    setShowConfirm(null);
  };

  const handleApprove = (userId: string) => {
    setApprovedParticipations((prev) => [...prev, userId]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">PARTICIPAÇÕES</h1>

      <div className="space-y-6">
        {enriched.map((p, i) => (
          <motion.div
            key={i}
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
                {!approvedParticipations.includes(p.userId) && !assignedWinners.includes(p.userId) && (
                  <>
                    <motion.button
                      onClick={() => handleApprove(p.userId)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-muted text-foreground text-ui text-xs py-2.5 rounded-xl btn-shadow"
                    >
                      APROVAR
                    </motion.button>
                    <motion.button
                      onClick={() => setShowConfirm(p.userId)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-2.5 rounded-xl btn-shadow"
                    >
                      SELECIONAR GANHADOR
                    </motion.button>
                  </>
                )}
                {approvedParticipations.includes(p.userId) && !assignedWinners.includes(p.userId) && (
                  <span className="text-success text-sm font-bold">✅ Aprovado</span>
                )}
                {assignedWinners.includes(p.userId) && (
                  <span className="text-accent text-sm font-bold">🏆 Ganhador de patrocínio · Notificação enviada</span>
                )}
              </div>
            </div>

            {/* Confirmation modal */}
            <AnimatePresence>
              {showConfirm === p.userId && p.user && (
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
                        onClick={() => handleAssignWinner(p.userId)}
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
        ))}
      </div>
    </div>
  );
};

export default AdminParticipations;
