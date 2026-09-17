import { useState, useEffect } from 'react';
import { Trophy, Share2, ExternalLink, Activity, Calendar, Target, Award, Sparkles, Instagram, Youtube } from 'lucide-react';
import { apiGetSportProfile } from '@/lib/mockApi';
import {
  SportProfile,
  PRACTICE_TIME_OPTIONS,
  MAIN_GOAL_OPTIONS,
  WEEKLY_FREQUENCY_OPTIONS,
  DESIRED_REWARD_OPTIONS,
  EXPECTATION_2028_OPTIONS,
} from '@/types/sportProfile';

interface AdminUserSportProfileSectionProps {
  userId: string;
}

const TikTokIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743 2.895 2.895 0 0 1 2.313-4.639c.329 0 .647.054.945.152V9.38a6.333 6.333 0 0 0-.945-.072 6.34 6.34 0 0 0-6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 0 0 0 6.328-6.34V8.718a8.21 8.21 0 0 0 4.775 1.516V6.789a4.814 4.814 0 0 1-1-.103z" />
  </svg>
);

const FacebookIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const AdminUserSportProfileSection = ({ userId }: AdminUserSportProfileSectionProps) => {
  const [profile, setProfile] = useState<SportProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setHasError(false);

    apiGetSportProfile(userId)
      .then((data) => {
        if (isMounted) setProfile(data);
      })
      .catch((err) => {
        console.error('Erro ao carregar perfil esportivo no modal admin:', err);
        if (isMounted) {
          setProfile(null);
          setHasError(true);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-muted/20 border border-border/40 rounded-xl p-3.5 text-center">
        <p className="text-xs text-muted-foreground animate-pulse">Carregando dados do atleta...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3.5 text-center">
        <p className="text-xs text-destructive font-medium">
          Não foi possível carregar os dados do atleta
        </p>
      </div>
    );
  }

  const hasSportData = Boolean(
    profile && (
      profile.practiceTime ||
      profile.favoriteModality ||
      profile.mainGoal ||
      profile.weeklyFrequency ||
      profile.targetEvent2028 ||
      profile.desiredReward ||
      profile.expectation2028
    )
  );

  const hasSocialData = Boolean(
    profile && (
      profile.instagramHandle ||
      profile.tiktokHandle ||
      profile.facebookHandle ||
      profile.youtubeHandle ||
      profile.otherSocialLink
    )
  );

  if (!profile || (!hasSportData && !hasSocialData)) {
    return (
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4">
        <p className="text-ui text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-accent" />
          Perfil Esportivo 2028 & Redes Sociais
        </p>
        <div className="bg-background/60 rounded-lg p-3 border border-border/40 text-center">
          <p className="text-xs text-muted-foreground font-medium">Ainda não preenchido</p>
        </div>
      </div>
    );
  }

  const practiceTimeLabel =
    PRACTICE_TIME_OPTIONS.find((o) => o.value === profile.practiceTime)?.label || profile.practiceTime || '—';

  const mainGoalLabel =
    MAIN_GOAL_OPTIONS.find((o) => o.value === profile.mainGoal)?.label || profile.mainGoal || '—';

  const weeklyFreqLabel =
    WEEKLY_FREQUENCY_OPTIONS.find((o) => o.value === profile.weeklyFrequency)?.label || profile.weeklyFrequency || '—';

  const desiredRewardLabel =
    DESIRED_REWARD_OPTIONS.find((o) => o.value === profile.desiredReward)?.label || profile.desiredReward || '—';

  const expectationLabel =
    EXPECTATION_2028_OPTIONS.find((o) => o.value === profile.expectation2028)?.label || profile.expectation2028 || '—';

  return (
    <div className="space-y-4 pt-1">
      {/* 1. SEÇÃO PERFIL ESPORTIVO (7 PERGUNTAS) */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <p className="text-ui text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-accent" />
          Perfil Esportivo (7 perguntas)
        </p>

        {!hasSportData ? (
          <div className="bg-background/60 rounded-lg p-3 border border-border/40 text-center">
            <p className="text-xs text-muted-foreground font-medium">Ainda não preenchido</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40">
              <p className="text-[11px] text-muted-foreground">Tempo de Prática</p>
              <p className="font-bold text-foreground mt-0.5">{practiceTimeLabel}</p>
            </div>

            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40">
              <p className="text-[11px] text-muted-foreground">Modalidade Favorita</p>
              <p className="font-bold text-foreground mt-0.5">{profile.favoriteModality || '—'}</p>
            </div>

            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40">
              <p className="text-[11px] text-muted-foreground">Principal Objetivo</p>
              <p className="font-bold text-foreground mt-0.5">{mainGoalLabel}</p>
            </div>

            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40">
              <p className="text-[11px] text-muted-foreground">Frequência Semanal</p>
              <p className="font-bold text-foreground mt-0.5">{weeklyFreqLabel}</p>
            </div>

            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40 sm:col-span-2">
              <p className="text-[11px] text-muted-foreground">Desafio / Evento Alvo até 2028</p>
              <p className="font-bold text-foreground mt-0.5">{profile.targetEvent2028 || '—'}</p>
            </div>

            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40">
              <p className="text-[11px] text-muted-foreground">Recompensa que Mais Motiva</p>
              <p className="font-bold text-foreground mt-0.5">{desiredRewardLabel}</p>
            </div>

            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40">
              <p className="text-[11px] text-muted-foreground">Expectativa 3BUK até 2028</p>
              <p className="font-bold text-foreground mt-0.5">{expectationLabel}</p>
            </div>
          </div>
        )}
      </div>

      {/* 2. SEÇÃO REDES SOCIAIS (5 CANAIS) */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <p className="text-ui text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5 text-primary" />
          Redes Sociais (5 canais)
        </p>

        {!hasSocialData ? (
          <div className="bg-background/60 rounded-lg p-3 border border-border/40 text-center">
            <p className="text-xs text-muted-foreground font-medium">Ainda não preenchido</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Instagram */}
            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Instagram className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                <span className="text-[11px] text-muted-foreground">Instagram:</span>
              </div>
              {profile.instagramHandle ? (
                <a
                  href={`https://instagram.com/${profile.instagramHandle.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary hover:underline flex items-center gap-0.5 truncate text-[11px]"
                >
                  @{profile.instagramHandle.replace(/^@/, '')}
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground italic text-[11px]">Não informado</span>
              )}
            </div>

            {/* TikTok */}
            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TikTokIcon className="text-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">TikTok:</span>
              </div>
              {profile.tiktokHandle ? (
                <a
                  href={`https://tiktok.com/@${profile.tiktokHandle.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary hover:underline flex items-center gap-0.5 truncate text-[11px]"
                >
                  @{profile.tiktokHandle.replace(/^@/, '')}
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground italic text-[11px]">Não informado</span>
              )}
            </div>

            {/* Facebook */}
            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FacebookIcon className="text-blue-500 shrink-0" />
                <span className="text-[11px] text-muted-foreground">Facebook:</span>
              </div>
              {profile.facebookHandle ? (
                <a
                  href={profile.facebookHandle.startsWith('http') ? profile.facebookHandle : `https://facebook.com/${profile.facebookHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary hover:underline flex items-center gap-0.5 truncate text-[11px]"
                >
                  {profile.facebookHandle.replace(/^https?:\/\/(www\.)?facebook\.com\//, '')}
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground italic text-[11px]">Não informado</span>
              )}
            </div>

            {/* YouTube */}
            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Youtube className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-[11px] text-muted-foreground">YouTube:</span>
              </div>
              {profile.youtubeHandle ? (
                <a
                  href={profile.youtubeHandle.startsWith('http') ? profile.youtubeHandle : `https://youtube.com/@${profile.youtubeHandle.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary hover:underline flex items-center gap-0.5 truncate text-[11px]"
                >
                  {profile.youtubeHandle.replace(/^https?:\/\/(www\.)?youtube\.com\/(@)?/, '@')}
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground italic text-[11px]">Não informado</span>
              )}
            </div>

            {/* Outras redes */}
            <div className="bg-background/70 rounded-lg p-2.5 border border-border/40 flex items-center justify-between gap-2 sm:col-span-2">
              <div className="flex items-center gap-2 min-w-0">
                <Share2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">Outras Redes:</span>
              </div>
              {profile.otherSocialLink ? (
                <a
                  href={profile.otherSocialLink.startsWith('http') ? profile.otherSocialLink : `https://${profile.otherSocialLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary hover:underline flex items-center gap-0.5 truncate text-[11px] max-w-[200px]"
                >
                  {profile.otherSocialLink}
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground italic text-[11px]">Não informado</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
