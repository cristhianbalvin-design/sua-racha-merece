import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiGetWinners, apiUpdateParticipation } from '@/lib/mockApi';
import { Gift, Search } from 'lucide-react';
import { toast } from 'sonner';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminWinners = () => {
  const [filterState, setFilterState] = useState('Todos');
  const [winnersList, setWinnersList] = useState<any[]>([]);

  useEffect(() => {
    apiGetWinners().then(setWinnersList);
  }, []);

  const markDelivered = async (id: string) => {
    // Optimistic UI update
    setWinnersList(prev => prev.map(w => w.id === id ? { ...w, prizeDelivered: true } : w));
    toast.success('Prêmio marcado como entregue!');
    
    // DB Update
    await apiUpdateParticipation(id, { prizeDelivered: true });
  };

  const filtered = winnersList.filter(w => {
    if (filterState === 'Entregue') return w.prizeDelivered;
    if (filterState === 'Pendente') return !w.prizeDelivered;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="font-bold italic text-2xl text-foreground">GANHADORES</h1>
        
        <div className="flex items-center bg-card rounded-xl p-1.5 card-shadow border border-border">
          <button
            onClick={() => setFilterState('Todos')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterState === 'Todos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterState('Entregue')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterState === 'Entregue' ? 'bg-success text-success-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Entregue
          </button>
          <button
            onClick={() => setFilterState('Pendente')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterState === 'Pendente' ? 'bg-warning text-warning-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Pendente
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
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
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">ESPORTE</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">CAMPANHA</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">MÊS DA CAMPANHA</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">PRÊMIO</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">ESTADO</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">AÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{w.medal}</span>
                        <div>
                          <p className="text-foreground font-bold">{w.user?.name}</p>
                          {w.user?.email && <p className="text-xs text-muted-foreground font-normal">{w.user.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{w.camp?.sportIcon} {w.camp?.sport || 'N/A'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{w.camp?.description || 'N/A'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {w.campaignMonth ? w.campaignMonth.charAt(0).toUpperCase() + w.campaignMonth.slice(1) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-accent font-bold">{w.prize}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${w.prizeDelivered ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                        {w.prizeDelivered ? 'Entregue' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!w.prizeDelivered ? (
                        <motion.button
                          onClick={() => markDelivered(w.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={spring}
                          className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg btn-shadow flex items-center gap-1.5 mx-auto"
                        >
                          <Gift size={12} />
                          ENTREGAR
                        </motion.button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">✔</span>
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
