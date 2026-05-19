import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGetWinners, apiUpdateParticipation, apiGetParticipations, apiGetUsers, apiGetCampaigns } from '@/lib/mockApi';
import { Participation, User, Campaign } from '@/data/mockData';
import { Gift, Search, X } from 'lucide-react';
import { toast } from 'sonner';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

// ── Scoring helpers (same as AdminQualification) ────────────────

const calcCompromiso = (
  p: Participation,
  campaign: Campaign | undefined
): { score: number; rules: boolean[]; required: number } => {
  if (!campaign) return { score: 0, rules: [false, false, false, false, false], required: 4 };

  const campCreated = new Date(campaign.createdAt || campaign.startDate || '');
  const partCreated = new Date(p.timestamp);
  const dayDiff = (partCreated.getTime() - campCreated.getTime()) / (1000 * 60 * 60 * 24);

  const r1 = dayDiff >= 0 && dayDiff < 1;
  const r2 = dayDiff >= 0 && dayDiff <= 7;

  let r3 = false;
  if (p.photo) {
    const media = Array.isArray(p.photo) ? p.photo : [p.photo];
    r3 = media.some(Boolean);
  }

  const r4 = ['Concluído', 'Qualificado', 'Ganhador'].includes(p.participationStatus);
  const hasIgReq = !!campaign.instagramOptional;
  const r5 = hasIgReq ? !!p.instagramPhoto : false;
  const required = hasIgReq ? 5 : 4;
  const met = [r1, r2, r3, r4].filter(Boolean).length + (hasIgReq && r5 ? 1 : 0);

  return {
    score: parseFloat((5 * met / required).toFixed(2)),
    rules: [r1, r2, r3, r4, r5],
    required
  };
};

const calcContinuidade = (
  p: Participation,
  allParts: Participation[],
  user: User | undefined,
  campsList: Campaign[]
): { score: number; rules: boolean[] } => {
  if (!user || !user.createdAt) return { score: 0, rules: [false, false, false, false, false] };

  const getCampDate = (campId: string) => {
    const camp = campsList.find(c => c.id === campId);
    if (!camp || !camp.startDate) return new Date();
    const [y, m, d] = camp.startDate.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  };

  const getCampMonthStr = (campId: string) => {
    const camp = campsList.find(c => c.id === campId);
    if (!camp || !camp.startDate) return '';
    const [y, m] = camp.startDate.split('-');
    return `${y}-${m}`;
  };

  const userParts = allParts.filter(
    op => op.userId === user.id && ['Concluído', 'Qualificado', 'Ganhador'].includes(op.participationStatus)
  );

  const isWithinFirstMonth = (campId: string) => {
    const campDate = getCampDate(campId);
    const userRegDate = new Date(user.createdAt!);
    const daysDiff = (campDate.getTime() - userRegDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff >= -31 && daysDiff <= 31;
  };

  const has3ConsecutiveMonths = (partsList: Participation[]) => {
    const months = [...new Set(partsList.map(op => getCampMonthStr(op.campaignId)).filter(Boolean))].sort((a, b) => {
      const [ya, ma] = a.split('-');
      const [yb, mb] = b.split('-');
      return parseInt(ya) - parseInt(yb) || parseInt(ma) - parseInt(mb);
    });
    for (let i = 0; i <= months.length - 3; i++) {
      const [y1, m1] = months[i].split('-').map(Number);
      const [y2, m2] = months[i + 1].split('-').map(Number);
      const [y3, m3] = months[i + 2].split('-').map(Number);
      if ((y2 - y1) * 12 + (m2 - m1) === 1 && (y3 - y2) * 12 + (m3 - m2) === 1) return true;
    }
    return false;
  };

  const r1 = userParts.some(op => isWithinFirstMonth(op.campaignId));
  const r2 = userParts.some(op => op.participationStatus === 'Ganhador' && isWithinFirstMonth(op.campaignId));
  const r3 = has3ConsecutiveMonths(userParts);
  const r4 = has3ConsecutiveMonths(userParts.filter(op => op.participationStatus === 'Ganhador'));
  const currentCampMonthStr = getCampMonthStr(p.campaignId);
  const r5 = userParts.some(op =>
    op.id !== p.id &&
    op.participationStatus === 'Ganhador' &&
    getCampMonthStr(op.campaignId) === currentCampMonthStr
  );

  let score = 0;
  if (r1) score += 1.0;
  if (r2) score += 1.0;
  if (r3) score += 1.0;
  if (r4) score += 1.0;
  if (r5) score += 1.0;

  return { score, rules: [r1, r2, r3, r4, r5] };
};

// ───────────────────────────────────────────────────────────────

const AdminWinners = () => {
  const [filterState, setFilterState] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filterSport, setFilterSport] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const [winnersList, setWinnersList] = useState<any[]>([]);
  const [allParts, setAllParts] = useState<Participation[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [campsList, setCampsList] = useState<Campaign[]>([]);

  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const loadAll = async () => {
    const [winners, parts, users, camps] = await Promise.all([
      apiGetWinners(),
      apiGetParticipations(),
      apiGetUsers(),
      apiGetCampaigns(),
    ]);
    setWinnersList(winners);
    setAllParts(parts);
    setUsersList(users);
    setCampsList(camps);
  };

  useEffect(() => { loadAll(); }, []);

  const markDelivered = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setWinnersList(prev => prev.map(w => w.id === id ? { ...w, prizeDelivered: newStatus } : w));
    if (newStatus) toast.success('Prêmio marcado como entregue!');
    await apiUpdateParticipation(id, { prizeDelivered: newStatus });
  };

  // ── Unique filter options ──────────────────────────────────────
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
    if (filterState === 'Entregado') { if (!w.prizeDelivered) return false; }
    else if (filterState === 'Pendiente') { if (w.prizeDelivered) return false; }
    if (searchName) {
      const haystack = (w.camp?.name || '').toLowerCase();
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
        <select
          value={filterSport}
          onChange={e => setFilterSport(e.target.value)}
          className="bg-card border border-border text-sm rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[150px]"
        >
          <option value="">Esporte (Todos)</option>
          {sportOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="bg-card border border-border text-sm rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[170px]"
        >
          <option value="">Mês de campanha (Todos)</option>
          {monthOptions.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
        </select>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="bg-card border border-border text-sm rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[170px]"
        >
          <option value="">Estado (Todos)</option>
          <option value="Entregado">Entregado</option>
          <option value="Pendiente">Pendiente</option>
        </select>
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
                    <td className="px-4 py-3 text-muted-foreground">{w.camp?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {w.campaignMonth ? w.campaignMonth.charAt(0).toUpperCase() + w.campaignMonth.slice(1) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-accent font-bold">{w.prize}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${w.prizeDelivered ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                        {w.prizeDelivered ? 'Entregado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <motion.button
                          onClick={() => setShowDetail(w.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="text-xs font-bold text-secondary hover:underline"
                        >
                          DETALHES
                        </motion.button>
                        {!w.prizeDelivered ? (
                          <motion.button
                            onClick={() => markDelivered(w.id, !!w.prizeDelivered)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={spring}
                            className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg btn-shadow flex items-center gap-1.5"
                          >
                            <Gift size={12} />
                            ENTREGAR
                          </motion.button>
                        ) : (
                          <div className="flex items-center gap-2">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {showDetail && (() => {
          const part = allParts.find(x => x.id === showDetail);
          const winner = winnersList.find(w => w.id === showDetail);
          if (!part || !winner) return null;

          const user = usersList.find(u => u.id === part.userId);
          const campaign = campsList.find(c => c.id === part.campaignId);
          const { score: compromiso, rules: compRules, required: compReq } = calcCompromiso(part, campaign);
          const { score: continuidade, rules: contRules } = calcContinuidade(part, allParts, user, campsList);
          const attitude = part.attitudeScore ?? 0;
          const total = attitude > 0 ? parseFloat(((compromiso + continuidade) * attitude).toFixed(2)) : (part.totalScore ?? 0);

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
                <div className="p-6 space-y-6">
                  {/* Media */}
                  {part.photo && (() => {
                    const media = Array.isArray(part.photo) ? part.photo : [part.photo];
                    const videos = media.filter(url => /\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(url));
                    const displayPhotos = media.filter(url => !/\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(url));
                    return (
                      <div className="space-y-4">
                        {displayPhotos.length > 0 && (
                          <div>
                            <p className="text-ui text-xs text-muted-foreground font-bold mb-2">FOTOS ENVIADAS</p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {displayPhotos.map((url, i) => (
                                <img key={i} src={url} alt={`Foto ${i + 1}`}
                                  onClick={() => setSelectedImage(url)}
                                  className="h-32 w-32 object-cover rounded-xl flex-shrink-0 card-shadow cursor-pointer hover:opacity-80 transition-opacity" />
                              ))}
                            </div>
                          </div>
                        )}
                        {videos.length > 0 && (
                          <div>
                            <p className="text-ui text-xs text-muted-foreground font-bold mb-2">VÍDEOS ENVIADOS</p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {videos.map((url, i) => (
                                <video key={i} src={url} className="h-32 w-48 object-cover rounded-xl bg-black flex-shrink-0 card-shadow" controls preload="metadata" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* User header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {winner.user?.avatar && (
                        <img src={winner.user.avatar} alt={winner.user.name} className="w-12 h-12 rounded-full object-cover img-outline" />
                      )}
                      <div>
                        <h3 className="font-bold text-foreground text-lg">{winner.user?.name}</h3>
                        <p className="text-xs text-muted-foreground">{winner.user?.sport} · {winner.user?.city}</p>
                      </div>
                    </div>
                    <motion.button
                      onClick={() => setShowDetail(null)}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      className="bg-muted text-foreground w-8 h-8 rounded-full flex items-center justify-center"
                    >
                      <X size={16} />
                    </motion.button>
                  </div>

                  {/* Comment */}
                  {part.comment && (
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-1">COMENTÁRIO</label>
                      <p className="text-foreground text-sm italic bg-muted rounded-xl p-3">"{part.comment}"</p>
                    </div>
                  )}

                  {/* Score breakdown */}
                  <div className="bg-muted rounded-xl p-4 space-y-3">
                    <p className="text-ui text-xs text-muted-foreground font-bold mb-2">DETALHES DA PONTUAÇÃO</p>
                    <div>
                      <p className="text-xs font-bold text-secondary mb-1">COMPROMISSO: {compromiso}/5</p>
                      <div className="space-y-0.5 text-xs text-muted-foreground pl-2">
                        <p>{compRules[0] ? '✅' : '❌'} Participou no mesmo dia da criação da campanha</p>
                        <p>{compRules[1] ? '✅' : '❌'} Participou nos primeiros 7 dias</p>
                        <p>{compRules[2] ? '✅' : '❌'} Enviou evidência da participação</p>
                        <p>{compRules[3] ? '✅' : '❌'} Concluiu a participação</p>
                        {compReq === 5 && (
                          <p>{compRules[4] ? '✅' : '❌'} Publicou evidência no Instagram</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-accent mb-1">CONTINUIDADE: {continuidade}/5</p>
                      <div className="space-y-0.5 text-xs text-muted-foreground pl-2">
                        <p>{contRules[0] ? '✅' : '❌'} Competiu em seu primeiro mês de afiliação (+1.0)</p>
                        <p>{contRules[1] ? '✅' : '❌'} Ganhou em seu primeiro mês de afiliação (+1.0)</p>
                        <p>{contRules[2] ? '✅' : '❌'} Competiu pelo menos 1 vez por mês por 3 meses seguidos (+1.0)</p>
                        <p>{contRules[3] ? '✅' : '❌'} Ganhou pelo menos 1 vez por mês por 3 meses seguidos (+1.0)</p>
                        <p>{contRules[4] ? '✅' : '❌'} Ganhou outra campanha no mesmo mês desta avaliação (+1.0)</p>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">ATITUDE:</span> {attitude}
                      </p>
                      <p className="text-sm font-bold text-warning mt-1">
                        TOTAL: ({compromiso} + {continuidade}) × {attitude} = <span className="text-lg">{total}</span>
                      </p>
                    </div>
                  </div>

                  {/* Instagram */}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <label className="text-ui text-xs text-muted-foreground font-bold block mb-3">INSTAGRAM</label>
                    {part.instagram ? (
                      <div className="space-y-3">
                        <p className="text-foreground text-sm font-bold flex items-center gap-2">
                          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span>
                          Publicou com #3bukchallenge
                        </p>
                        {part.instagramPhoto ? (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-2">Captura de tela da evidência:</p>
                            <img src={part.instagramPhoto} alt="Instagram Evidence"
                              onClick={() => setSelectedImage(part.instagramPhoto!)}
                              className="h-48 cursor-pointer hover:opacity-80 transition-opacity rounded-xl object-contain bg-background/50 card-shadow border border-border" />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Foto de evidência não anexada.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-foreground text-sm flex items-center gap-2">
                        <span className="text-destructive">❌</span> Não publicou
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Image Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out backdrop-blur-sm"
          >
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              src={selectedImage}
              alt="Zoomed Evidence"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminWinners;
