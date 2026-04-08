import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check } from 'lucide-react';
import { apiGetCampaigns, apiAddCampaign, apiUpdateCampaign, apiGetSports, apiGetRegions } from '@/lib/mockApi';
import type { CampaignStatus, Campaign } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const formatCampMonth = (dateStr?: string) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  const str = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const statusColor: Record<string, string> = {
  'Aberto': 'bg-secondary/20 text-secondary',
  'Concluído': 'bg-success/20 text-success',
  'Eliminado': 'bg-destructive/20 text-destructive',
  'Qualificado': 'bg-accent/20 text-accent',
};

const AdminCampaigns = () => {
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sportFilter, setSportFilter] = useState('Todos');
  const [showCreate, setShowCreate] = useState(false);

  // List state
  const [campaignsList, setCampaignsList] = useState<Campaign[]>([]);
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [regionsList, setRegionsList] = useState<string[]>([]);

  useEffect(() => {
    apiGetCampaigns().then(setCampaignsList);
    apiGetSports().then(setSportsList);
    apiGetRegions().then(setRegionsList);
  }, []);

  // Create form state
  const [cSport, setCSport] = useState('');
  const [cRegion, setCRegion] = useState('');
  const [cCity, setCCity] = useState('');
  const [cStart, setCStart] = useState('');
  const [cEnd, setCEnd] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cWinners, setCWinners] = useState('');
  const [cPrize, setCPrize] = useState('');

  const [plan, setPlan] = useState<'Freemium'|'Premium'|'Ambos'>('Ambos');
  const [igOptional, setIgOptional] = useState(false);
  const [igHashtags, setIgHashtags] = useState('#3bukchallenge');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Today's date in YYYY-MM-DD format (used as min for date pickers)
  const today = new Date().toISOString().split('T')[0];

  const sorted = [...campaignsList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = sorted.filter((c) => {
    if (nameFilter && !c.description.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (statusFilter !== 'Todos' && c.status !== statusFilter) return false;
    if (sportFilter !== 'Todos' && c.sport !== sportFilter) return false;
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCamp: Campaign = {
      id: `camp-${Date.now()}`,
      sport: cSport,
      sportIcon: '🏆',
      city: cCity,
      region: cRegion,
      startDate: cStart,
      endDate: cEnd,
      description: cDesc,
      winnersCount: parseInt(cWinners, 10),
      prize: cPrize,
      plan,
      instagramOptional: igOptional,
      instagramHashtags: igHashtags,
      status: 'Aberto',
      createdAt: new Date().toISOString()
    };
    
    await apiAddCampaign(newCamp);
    setCampaignsList(await apiGetCampaigns());
    setFormSubmitted(true);
    
    setTimeout(() => {
      setFormSubmitted(false);
      setShowCreate(false);
      setCSport(''); setCRegion(''); setCCity(''); setCStart(''); setCEnd(''); setCDesc(''); setCWinners(''); setCPrize('');
      setPlan('Ambos'); setIgOptional(false); setIgHashtags('#3bukchallenge');
    }, 2500);
  };

  const handleStatusChange = async (id: string, newStatus: CampaignStatus) => {
    // Optimistic update
    setCampaignsList(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    await apiUpdateCampaign(id, { status: newStatus });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold italic text-2xl text-foreground">CAMPANHAS</h1>
        <motion.button
          onClick={() => setShowCreate(true)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="bg-primary text-primary-foreground text-ui text-xs px-5 py-2.5 rounded-xl btn-shadow flex items-center gap-2"
        >
          <Plus size={16} />
          NOVA CAMPANHA
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Buscar campanha..."
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all flex-1 min-w-[200px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
        >
          <option value="Todos">Todos os estados</option>
          <option value="Aberto">Aberto</option>
          <option value="Concluído">Concluído</option>
          <option value="Eliminado">Eliminado</option>
          <option value="Qualificado">Qualificado</option>
        </select>
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
        >
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
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">CAMPANHA</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">ESPORTE</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">MÊS DA CAMPANHA</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">ESTADO DA CAMPANHA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma campanha encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-foreground font-bold">{c.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.sportIcon} {c.sport}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatCampMonth(c.startDate)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        onChange={(e) => handleStatusChange(c.id, e.target.value as CampaignStatus)}
                        className={`text-xs font-bold px-3 py-1 rounded-full appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-ring ${statusColor[c.status] || 'bg-muted text-muted-foreground'}`}
                      >
                        <option value="Aberto">Aberto</option>
                        <option value="Concluído">Concluído</option>
                        <option value="Eliminado">Eliminado</option>
                        <option value="Qualificado">Qualificado</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create campaign modal */}
      <AnimatePresence>
        {showCreate && (
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
              className="bg-card rounded-2xl p-6 card-shadow max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              {!formSubmitted ? (
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <h3 className="font-bold italic text-lg text-foreground mb-2">CRIAR CAMPANHA</h3>

                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-2">ESPORTE</label>
                    <select value={cSport} onChange={(e) => setCSport(e.target.value)} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none" required>
                      <option value="">Selecione</option>
                      {sportsList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-2">ESTADO</label>
                      <select value={cRegion} onChange={(e) => setCRegion(e.target.value)} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all appearance-none" required>
                        <option value="">Selecione</option>
                        {regionsList.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-2">CIDADE</label>
                      <input type="text" value={cCity} onChange={(e) => setCCity(e.target.value)} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" placeholder="São Paulo" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-2">DATA DE INÍCIO</label>
                      <input type="date" value={cStart} min={today} onChange={(e) => { setCStart(e.target.value); if (cEnd && e.target.value > cEnd) setCEnd(''); }} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" required />
                    </div>
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-2">DATA DE FIM</label>
                      <input type="date" value={cEnd} min={cStart || today} onChange={(e) => setCEnd(e.target.value)} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" required />
                    </div>
                  </div>

                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-2">DESCRIÇÃO DO DESAFIO</label>
                    <textarea value={cDesc} onChange={(e) => setCDesc(e.target.value)} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all resize-none h-24" placeholder="Descreva o desafio..." required />
                  </div>

                  {/* Plan */}
                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-2">TIPO DE PLANO</label>
                    <div className="flex gap-3">
                      {['Freemium', 'Premium', 'Ambos'].map((p) => (
                        <motion.button
                          key={p}
                          type="button"
                          onClick={() => setPlan(p as 'Freemium' | 'Premium' | 'Ambos')}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          transition={spring}
                          className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors ${
                            plan === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {p.toUpperCase()}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-2">QTD GANHADORES</label>
                      <input type="number" min="1" value={cWinners} onChange={(e) => setCWinners(e.target.value)} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" placeholder="3" required />
                    </div>
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-2">PRÊMIO</label>
                      <input type="text" value={cPrize} onChange={(e) => setCPrize(e.target.value)} className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" placeholder="Tênis Nike — R$350" required />
                    </div>
                  </div>

                  {/* Instagram optional */}
                  <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => setIgOptional(!igOptional)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          igOptional ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        {igOptional && <Check size={14} className="text-primary-foreground" />}
                      </div>
                      <span className="text-foreground text-sm font-bold">Habilitar publicação no Instagram (opcional)</span>
                    </label>
                    {igOptional && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <label className="text-ui text-xs text-muted-foreground block mb-2">HASHTAGS</label>
                        <input
                          type="text"
                          value={igHashtags}
                          onChange={(e) => setIgHashtags(e.target.value)}
                          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all"
                          placeholder="#3bukchallenge #3bukrun"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">Separe as hashtags por espaço</p>
                      </motion.div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-muted text-foreground text-ui text-xs py-3 rounded-xl"
                    >
                      CANCELAR
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-3 rounded-xl btn-shadow"
                    >
                      PUBLICAR CAMPANHA
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <span className="text-5xl block mb-3">✅</span>
                  <h3 className="font-bold italic text-lg text-foreground mb-2">Campanha publicada!</h3>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCampaigns;
