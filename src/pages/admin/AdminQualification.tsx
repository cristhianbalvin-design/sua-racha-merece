import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGetParticipations, apiGetUsers, apiGetCampaigns, apiUpdateParticipation } from '@/lib/mockApi';
import { Participation, User, Campaign } from '@/data/mockData';
import { X, Trophy, Info } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const formatCampMonth = (dateStr?: string) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  const str = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// ── Scoring helpers ──────────────────────────────────────────────────────

/**
 * COMPROMISO: max 5 pts
 * Rule 1: joined campaign on creation day (+1)
 * Rule 2: joined within 7 days (+1)
 * Rule 3: uploaded both photo AND video (+1)
 * Rule 4: concluded participation (+1)
 * Rule 5 (if campaign has IG enabled): submitted instagram screenshot (+1)
 * Formula: 5 * met / required
 */
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
    const hasPhoto = media.some(url => !/\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(url));
    const hasVideo = media.some(url => /\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(url));
    r3 = hasPhoto && hasVideo;
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

/**
 * CONTINUIDADE: max 5 pts
 * Rule 1: Participated within 1st month of registration (+1.0)
 * Rule 2: Won within 1st month of registration (+1.0)
 * Rule 3: Participated in 3+ consecutive months (+1.0)
 * Rule 4: Won in 3+ consecutive months (+1.0)
 * Rule 5: Won another campaign in the same month as current campaign (+1.0)
 */
const calcContinuidade = (
  p: Participation,
  allParts: Participation[],
  user: User | undefined,
  campsList: Campaign[]
): { score: number; rules: boolean[] } => {
  if (!user || !user.createdAt) return { score: 0, rules: [false, false, false, false, false] };

  // Helper to safely parse YYYY-MM-DD from campaign
  const getCampDate = (campId: string) => {
    const camp = campsList.find(c => c.id === campId);
    if (!camp || !camp.startDate) return new Date();
    const [y, m, d] = camp.startDate.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0); // Noon local to avoid timezone shift
  };

  const getCampMonthStr = (campId: string) => {
    const camp = campsList.find(c => c.id === campId);
    if (!camp || !camp.startDate) return '';
    const [y, m] = camp.startDate.split('-');
    return `${y}-${m}`;
  };

  // Consider only concluded participations
  const userParts = allParts.filter(
    op => op.userId === user.id && ['Concluído', 'Qualificado', 'Ganhador'].includes(op.participationStatus)
  );

  const isWithinFirstMonth = (campId: string) => {
    const campDate = getCampDate(campId);
    const userRegDate = new Date(user.createdAt!);
    const daysDiff = (campDate.getTime() - userRegDate.getTime()) / (1000 * 60 * 60 * 24);
    // Within ~1 month (allow negative if joined right after campaign started)
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
        const [y2, m2] = months[i+1].split('-').map(Number);
        const [y3, m3] = months[i+2].split('-').map(Number);
        
        const diff1 = (y2 - y1) * 12 + (m2 - m1);
        const diff2 = (y3 - y2) * 12 + (m3 - m2);
        
        if (diff1 === 1 && diff2 === 1) return true;
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

const AdminQualification = () => {
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [parts, setParts] = useState<Participation[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [campsList, setCampsList] = useState<Campaign[]>([]);

  const loadAll = async () => {
    const [p, u, c] = await Promise.all([apiGetParticipations(), apiGetUsers(), apiGetCampaigns()]);
    setParts(p);
    setUsersList(u);
    setCampsList(c);
  };

  useEffect(() => { loadAll(); }, []);

  // Eligible: participation concluded+, campaign concluded, user active
  const eligible = parts
    .filter((p) => ['Concluído', 'Qualificado', 'Ganhador'].includes(p.participationStatus))
    .map((p) => ({
      ...p,
      user: usersList.find((u) => u.id === p.userId),
      campaign: campsList.find((c) => c.id === p.campaignId),
    }))
    .filter((p) => p.campaign?.status === 'Concluído' && p.user?.userStatus === 'Ativo');

  const handleAttitudeChange = async (p: Participation, value: string) => {
    const attitude = value === '' ? 0 : Math.min(0.95, Math.max(0, parseFloat(value) || 0));
    const campaign = campsList.find((c) => c.id === p.campaignId);
    const user = usersList.find((u) => u.id === p.userId);

    const { score: compromiso } = calcCompromiso(p, campaign);
    const { score: continuidade } = calcContinuidade(p, parts, user, campsList);
    const total = parseFloat(((compromiso + continuidade) * attitude).toFixed(2));

    let newStatus = p.participationStatus;
    if (attitude > 0 && p.participationStatus === 'Concluído') {
      newStatus = 'Qualificado';
    }

    await apiUpdateParticipation(p.id, {
      attitudeScore: attitude,
      commitmentScore: compromiso,
      continuityScore: continuidade,
      totalScore: total,
      participationStatus: newStatus,
    });
    await loadAll();
  };

  const markWinner = async (p: Participation) => {
    const campaign = campsList.find((c) => c.id === p.campaignId);
    const user = usersList.find((u) => u.id === p.userId);
    const { score: compromiso } = calcCompromiso(p, campaign);

    // After marking winner, continuidade rule 1 becomes true
    const fakeWinner = { ...p, participationStatus: 'Ganhador' as const };
    const { score: continuidade } = calcContinuidade(fakeWinner, [...parts, fakeWinner], user, campsList);
    const attitude = p.attitudeScore ?? 0;
    const total = parseFloat(((compromiso + continuidade) * attitude).toFixed(2));

    await apiUpdateParticipation(p.id, {
      participationStatus: 'Ganhador' as const,
      continuityScore: continuidade,
      totalScore: total,
    });
    await loadAll();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-2">QUALIFICAÇÃO</h1>
      <p className="text-xs text-muted-foreground mb-6">
        TOTAL = (COMPROMISSO + CONTINUIDADE) × ATITUDE &nbsp;·&nbsp; Máx 9.5 pontos
      </p>

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
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">ESPORTE</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">CAMPANHA</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">MÊS DE CAMPANHA</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">VENCIMENTO</th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">
                    ATITUDE<br/><span className="text-[10px] font-normal opacity-60">0–0.95</span>
                  </th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">
                    COMPROMISSO<br/><span className="text-[10px] font-normal opacity-60">auto / máx 5</span>
                  </th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">
                    CONTINUIDADE<br/><span className="text-[10px] font-normal opacity-60">auto / máx 5</span>
                  </th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">
                    TOTAL<br/><span className="text-[10px] font-normal opacity-60">máx 9.5</span>
                  </th>
                  <th className="text-center px-4 py-3 text-ui text-xs text-muted-foreground">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eligible.map((p) => {
                  const { score: compromiso, rules: compRules, required: compReq } = calcCompromiso(p, p.campaign);
                  const { score: continuidade, rules: contRules } = calcContinuidade(p, parts, p.user, campsList);
                  const attitude = p.attitudeScore ?? '';
                  const total = attitude !== '' && attitude > 0
                    ? parseFloat(((compromiso + continuidade) * (attitude as number)).toFixed(2))
                    : p.totalScore ?? 0;

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-foreground font-bold">{p.user?.name}</p>
                        {p.user?.email && <p className="text-xs text-muted-foreground">{p.user.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.campaign?.sportIcon} {p.campaign?.sport || 'N/A'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.campaign?.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatCampMonth(p.campaign?.startDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.campaign?.endDate ? new Date(p.campaign.endDate).toLocaleDateString('pt-BR') : '—'}
                      </td>

                      {/* ATITUDE: manual 0–0.95 */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="0.95"
                          value={attitude}
                          placeholder="0.00"
                          onChange={(e) => handleAttitudeChange(p, e.target.value)}
                          disabled={p.participationStatus === 'Ganhador'}
                          className="w-20 bg-input text-foreground text-center rounded-lg px-2 py-1.5 text-sm input-shadow focus:ring-2 focus:ring-ring outline-none disabled:opacity-50"
                        />
                      </td>

                      {/* COMPROMISSO: auto-calculated */}
                      <td className="px-4 py-3 text-center">
                        <div
                          className="inline-flex items-center gap-1 bg-secondary/10 text-secondary rounded-lg px-3 py-1.5 text-sm font-bold cursor-help"
                          title={`R1: mesmo dia=${compRules[0]} | R2: ≤7 dias=${compRules[1]} | R3: foto+vídeo=${compRules[2]} | R4: concluído=${compRules[3]}${compReq === 5 ? ` | R5: instagram=${compRules[4]}` : ''}`}
                        >
                          {compromiso}
                          <Info size={10} className="opacity-50" />
                        </div>
                      </td>

                      {/* CONTINUIDADE: auto-calculated */}
                      <td className="px-4 py-3 text-center">
                        <div
                          className="inline-flex items-center gap-1 bg-accent/10 text-accent rounded-lg px-3 py-1.5 text-sm font-bold cursor-help"
                          title={`R1: 1er mes partic.=${contRules[0]} | R2: 1er mes ganado=${contRules[1]} | R3: 3meses consec.=${contRules[2]} | R4: 3meses ganados=${contRules[3]} | R5: Vencedor este mes=${contRules[4]}`}
                        >
                          {continuidade}
                          <Info size={10} className="opacity-50" />
                        </div>
                      </td>

                      {/* TOTAL */}
                      <td className="px-4 py-3 text-center">
                        <div className={`w-16 text-center rounded-lg px-2 py-1.5 text-sm font-bold mx-auto ${
                          total >= 8 ? 'bg-warning/20 text-warning' :
                          total >= 5 ? 'bg-accent/20 text-accent' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {total > 0 ? total : '—'}
                        </div>
                      </td>

                      {/* AÇÕES */}
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
                          {p.participationStatus === 'Qualificado' && (
                            <motion.button
                              onClick={() => markWinner(p)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              transition={spring}
                              className="bg-warning/20 text-warning text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                            >
                              <Trophy size={12} />
                              GANHADOR
                            </motion.button>
                          )}
                          {p.participationStatus === 'Ganhador' && (
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

      {/* Score formula legend */}
      <div className="mt-6 bg-card rounded-2xl p-4 card-shadow text-xs text-muted-foreground space-y-1">
        <p className="font-bold text-foreground mb-2">📐 Critérios de Pontuação</p>
        <p><span className="text-secondary font-bold">COMPROMISSO</span> = 5 × (regras concluídas / req) &nbsp;|&nbsp; R1: participou no dia da criação (+1) · R2: ≤7 dias (+1) · R3: foto+vídeo (+1) · R4: concluiu (+1) · R5: ig (opcional, +1)</p>
        <p><span className="text-accent font-bold">CONTINUIDADE</span> = até 5 pts &nbsp;|&nbsp; R1: partic. 1º mês (+1) · R2: vitória 1º mês (+1) · R3: partic. 3 meses consec. (+1) · R4: vitória 3 meses consec. (+1) · R5: vitória neste mês (+1)</p>
        <p><span className="text-warning font-bold">TOTAL</span> = (COMPROMISSO + CONTINUIDADE) × ATITUDE &nbsp;|&nbsp; Máx: (5+5) × 0.95 = <strong>9.5</strong></p>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {showDetail && (() => {
          const p = eligible.find((x) => x.id === showDetail);
          if (!p || !p.user) return null;
          const { score: compromiso, rules: compRules, required: compReq } = calcCompromiso(p, p.campaign);
          const { score: continuidade, rules: contRules } = calcContinuidade(p, parts, p.user, campsList);
          const attitude = p.attitudeScore ?? 0;
          const total = attitude > 0 ? parseFloat(((compromiso + continuidade) * attitude).toFixed(2)) : 0;
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
                  {/* Media Section: Photos and Videos Separately */}
                  {p.photo && (() => {
                    const media = Array.isArray(p.photo) ? p.photo : [p.photo];
                    const videos = media.filter(url => /\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(url));
                    let displayPhotos = media.filter(url => !/\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(url));
                    let displayIg = p.instagramPhoto;

                    // Fallback for older test data where IG screenshot was appended to the photos array
                    if (p.instagram && !p.instagramPhoto && displayPhotos.length > 0) {
                      displayIg = displayPhotos.pop();
                    }
                    
                    return (
                      <div className="space-y-4">
                        {displayPhotos.length > 0 && (
                          <div>
                            <p className="text-ui text-xs text-muted-foreground font-bold mb-2">FOTOS ENVIADAS</p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {displayPhotos.map((url, i) => (
                                <img key={i} src={url} alt={`Foto ${i+1}`} 
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.user.avatar && (
                        <img src={p.user.avatar} alt={p.user.name} className="w-12 h-12 rounded-full object-cover img-outline" />
                      )}
                      <div>
                        <h3 className="font-bold text-foreground text-lg">{p.user.name}</h3>
                        <p className="text-xs text-muted-foreground">{p.user.sport} · {p.user.city}</p>
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

                  {p.comment && (
                    <div>
                      <label className="text-ui text-xs text-muted-foreground block mb-1">COMENTÁRIO</label>
                      <p className="text-foreground text-sm italic bg-muted rounded-xl p-3">"{p.comment}"</p>
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
                        <p>{compRules[2] ? '✅' : '❌'} Enviou foto E vídeo como evidência</p>
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

                  <div className="bg-muted/50 rounded-xl p-4">
                    <label className="text-ui text-xs text-muted-foreground font-bold block mb-3">INSTAGRAM</label>
                    {p.instagram ? (
                      <div className="space-y-3">
                        <p className="text-foreground text-sm font-bold flex items-center gap-2">
                          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span>
                          Publicou com #3bukchallenge
                        </p>
                        {(() => {
                          let displayPhotos = Array.isArray(p.photo) ? p.photo : [p.photo];
                          let displayIg = p.instagramPhoto;
                          if (p.instagram && !p.instagramPhoto && displayPhotos.length > 0) {
                            displayIg = displayPhotos.filter(u => u && !/\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(u)).pop();
                          }
                          
                          return displayIg ? (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-2">Captura de tela da evidência:</p>
                              <img src={displayIg} alt="Instagram Evidence" 
                                   onClick={() => setSelectedImage(displayIg)}
                                   className="h-48 cursor-pointer hover:opacity-80 transition-opacity rounded-xl object-contain bg-background/50 card-shadow border border-border" />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Foto de evidência não anexada.</p>
                          );
                        })()}
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
              onClick={(e) => e.stopPropagation()} // Let user click image without closing
            />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full w-10 h-10 flex items-center justify-center"
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminQualification;
