import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiGetWinners, apiUpdateParticipation } from '@/lib/mockApi';
import { Gift, Search, X } from 'lucide-react';
import { toast } from 'sonner';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminWinners = () => {
  const [filterState, setFilterState] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filterSport, setFilterSport] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const [winnersList, setWinnersList] = useState<any[]>([]);

  useEffect(() => {
    apiGetWinners().then(setWinnersList);
  }, []);

  const markDelivered = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    // Optimistic UI update
    setWinnersList(prev => prev.map(w => w.id === id ? { ...w, prizeDelivered: newStatus } : w));
    if (newStatus) {
      toast.success('Prêmio marcado como entregue!');
    }
    
    // DB Update
    await apiUpdateParticipation(id, { prizeDelivered: newStatus });
  };

  // ── Unique filter options ─────────────────────────────────────────
  const sportOptions = [...new Set(winnersList.map(w => w.camp?.sport).filter(Boolean))] as string[];
  const monthOptions = [...new Set(winnersList.map(w => {
    const s = w.camp?.startDate;
    if (!s) return '';
    const [y, m] = s.split('-');
    return `${y}-${m}`;
  }).filter(Boolean))].sort() as string[];

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const filtered = winnersList.filter(w => {
    if (filterState === 'Entregado') {
      if (!w.prizeDelivered) return false;
    } else if (filterState === 'Pendiente') {
      if (w.prizeDelivered) return false;
    }
    
    if (searchName) {
      const haystack = (w.camp?.description || '').toLowerCase();
      if (!haystack.includes(searchName.toLowerCase())) return false;
    }
    if (filterSport && w.camp?.sport !== filterSport) return false;
    if (filterMonth) {
      const s = w.camp?.startDate || '';
      const [y, m] = s.split('-');
      if (`${y}-${m}` !== filterMonth) return false;
    }
    
    return true;
  });

  const hasActiveFilters = searchName || filterSport || filterMonth || filterState !== '';
  const clearFilters = () => { setSearchName(''); setFilterSport(''); setFilterMonth(''); setFilterState(''); };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">GANADORES</h1>

      {/* ── Search + Filters ── */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            placeholder="Buscar por nome de campanha…"
            className="w-full bg-card border border-border text-sm rounded-xl pl-9 pr-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Sport filter */}
        <select
          value={filterSport}
          onChange={e => setFilterSport(e.target.value)}
          className="bg-card border border-border text-sm rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[150px]"
        >
          <option value="">Esporte (Todos)</option>
          {sportOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Month filter */}
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="bg-card border border-border text-sm rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[170px]"
        >
          <option value="">Mês de campanha (Todos)</option>
          {monthOptions.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="bg-card border border-border text-sm rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[170px]"
        >
          <option value="">Estado (Todos)</option>
          <option value="Entregado">Entregado</option>
          <option value="Pendiente">Pendiente</option>
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl px-3 py-2.5 transition-colors"
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">{winnersList.length === 0 ? '🏆' : '🔍'}</span>
          <p className="text-muted-foreground">
            {winnersList.length === 0
              ? 'Nenhum ganhador registrado ainda.'
              : 'Nenhum resultado para os filtros selecionados.'}
          </p>
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
                        {w.prizeDelivered ? 'Entregado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!w.prizeDelivered ? (
                        <motion.button
                          onClick={() => markDelivered(w.id, !!w.prizeDelivered)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={spring}
                          className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg btn-shadow flex items-center gap-1.5 mx-auto"
                        >
                          <Gift size={12} />
                          ENTREGAR
                        </motion.button>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-muted-foreground italic">✔</span>
                          <motion.button
                            onClick={() => markDelivered(w.id, !!w.prizeDelivered)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="text-[10px] bg-muted hover:bg-muted/80 text-foreground px-2 py-1 rounded transition-colors"
                          >
                            DESFAZER
                          </motion.button>
                        </div>
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
