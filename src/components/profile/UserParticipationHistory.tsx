import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ExternalLink, Calendar, MapPin, CheckCircle, Clock } from 'lucide-react';
import { UserParticipationHistoryItem } from '@/types/sportProfile';
import { apiGetUserParticipationHistory } from '@/lib/mockApi';

interface UserParticipationHistoryProps {
  userId: string;
}

const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };

const statusBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  'Ganhador': { bg: 'bg-warning/20', text: 'text-warning', label: 'GANHADOR' },
  'GANHADOR': { bg: 'bg-warning/20', text: 'text-warning', label: 'GANHADOR' },
  'Qualificado': { bg: 'bg-accent/20', text: 'text-accent', label: 'QUALIFICADO' },
  'QUALIFICADO': { bg: 'bg-accent/20', text: 'text-accent', label: 'QUALIFICADO' },
  'Concluído': { bg: 'bg-success/20', text: 'text-success', label: 'CONCLUÍDO' },
  'CONCLUÍDO': { bg: 'bg-success/20', text: 'text-success', label: 'CONCLUÍDO' },
  'Em curso': { bg: 'bg-secondary/20', text: 'text-secondary', label: 'EM CURSO' },
  'EM CURSO': { bg: 'bg-secondary/20', text: 'text-secondary', label: 'EM CURSO' },
  'Não concluído': { bg: 'bg-destructive/20', text: 'text-destructive', label: 'NÃO CONCLUÍDO' },
  'NÃO CONCLUÍDO': { bg: 'bg-destructive/20', text: 'text-destructive', label: 'NÃO CONCLUÍDO' },
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return dateStr;
  }
};

export const UserParticipationHistory = ({ userId }: UserParticipationHistoryProps) => {
  const [history, setHistory] = useState<UserParticipationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiGetUserParticipationHistory(userId)
      .then((items) => {
        if (isMounted) setHistory(items);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Desglose dinámico por estado de participación
  const statusCounts = history.reduce<Record<string, number>>((acc, item) => {
    const raw = (item.status || '').toLowerCase().trim();
    if (raw.includes('ganhador') || raw.includes('ganha')) {
      acc.ganhador = (acc.ganhador || 0) + 1;
    } else if (raw.includes('qualificado')) {
      acc.qualificado = (acc.qualificado || 0) + 1;
    } else if (raw.includes('concluído') || raw.includes('concluido')) {
      acc.concluido = (acc.concluido || 0) + 1;
    } else if (raw.includes('curso')) {
      acc.em_curso = (acc.em_curso || 0) + 1;
    } else if (raw.includes('não') || raw.includes('nao')) {
      acc.nao_concluido = (acc.nao_concluido || 0) + 1;
    } else {
      acc.outros = (acc.outros || 0) + 1;
    }
    return acc;
  }, {});

  const breakdownParts: string[] = [];
  if (statusCounts.ganhador) breakdownParts.push(`${statusCounts.ganhador} ${statusCounts.ganhador === 1 ? 'ganha' : 'ganhas'}`);
  if (statusCounts.qualificado) breakdownParts.push(`${statusCounts.qualificado} ${statusCounts.qualificado === 1 ? 'qualificada' : 'qualificadas'}`);
  if (statusCounts.concluido) breakdownParts.push(`${statusCounts.concluido} ${statusCounts.concluido === 1 ? 'concluída' : 'concluídas'}`);
  if (statusCounts.em_curso) breakdownParts.push(`${statusCounts.em_curso} em curso`);
  if (statusCounts.nao_concluido) breakdownParts.push(`${statusCounts.nao_concluido} não ${statusCounts.nao_concluido === 1 ? 'concluída' : 'concluídas'}`);
  if (statusCounts.outros) breakdownParts.push(`${statusCounts.outros} outros`);

  const breakdownText = breakdownParts.join(' • ');

  if (loading) {
    return (
      <div className="bg-card rounded-2xl card-shadow p-6 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Carregando histórico de campanhas...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl card-shadow p-5 space-y-4">
      <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent shrink-0" />
            <h2 className="text-base font-bold italic uppercase tracking-wider text-foreground">
              3BUK: Meu Histórico
            </h2>
          </div>
          <span className="text-xs font-bold text-foreground sm:hidden">
            {history.length} {history.length === 1 ? 'campanha' : 'campanhas'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground sm:text-right">
          <span className="hidden sm:inline font-bold text-foreground">
            {history.length} {history.length === 1 ? 'campanha' : 'campanhas'}{breakdownText ? ' • ' : ''}
          </span>
          {breakdownText && (
            <span className="text-[11px] text-muted-foreground">
              {breakdownText}
            </span>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm text-foreground font-medium">Nenhuma participação registrada ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Participe das campanhas ativas para concorrer a prêmios incríveis!
          </p>
          <Link
            to="/dashboard"
            className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Explorar Campanhas
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const isWinner = item.status === 'Ganhador' || item.status === 'GANHADOR';
            const badge = statusBadgeStyles[item.status] || {
              bg: 'bg-muted',
              text: 'text-muted-foreground',
              label: item.status.toUpperCase(),
            };

            return (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.01 }}
                transition={spring}
                className={`p-4 rounded-xl border transition-all ${
                  isWinner
                    ? 'border-warning/50 bg-warning/5 shadow-sm'
                    : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      {item.campaignName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="font-semibold text-primary">{item.campaignSport}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin size={11} /> {item.campaignCity}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 uppercase ${badge.bg} ${badge.text}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Prize Banner if Winner */}
                {isWinner && item.campaignPrize && (
                  <div className="my-2.5 p-2.5 rounded-lg bg-warning/15 border border-warning/30 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-warning shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-warning block">
                        Prêmio Conquistado
                      </span>
                      <p className="text-xs font-bold text-foreground">{item.campaignPrize}</p>
                    </div>
                  </div>
                )}

                {/* Footer: Date & Link */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {formatDate(item.createdAt)}
                  </span>
                  <Link
                    to={`/campanha/${item.campaignId}`}
                    className="text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    Ver detalhes da campanha
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
