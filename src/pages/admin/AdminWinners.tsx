import { useState } from 'react';
import { motion } from 'framer-motion';
import { winners } from '@/data/mockData';
import { Gift } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminWinners = () => {
  const [delivered, setDelivered] = useState<string[]>([]);

  const markDelivered = (id: string) => {
    setDelivered((prev) => [...prev, id]);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">GANHADORES</h1>

      {winners.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">🏆</span>
          <p className="text-muted-foreground">Nenhum ganhador registrado ainda.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">PARTICIPANTE</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">CAMPANHA</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">MÊS DA CAMPANHA</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">PRÊMIO</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">ENTREGA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {winners.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{w.medal}</span>
                        <span className="text-foreground font-bold">{w.user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{w.user.sport} — {w.user.city}</td>
                    <td className="px-4 py-3 text-muted-foreground">{w.campaignMonth || 'N/A'}</td>
                    <td className="px-4 py-3 text-accent font-bold">{w.prize}</td>
                    <td className="px-4 py-3 text-center">
                      {delivered.includes(w.id) ? (
                        <span className="text-success text-xs font-bold">✅ ENTREGUE</span>
                      ) : (
                        <motion.button
                          onClick={() => markDelivered(w.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={spring}
                          className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-xl btn-shadow flex items-center gap-1.5 mx-auto"
                        >
                          <Gift size={12} />
                          ENTREGAR PRÊMIO
                        </motion.button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWinners;
