import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, Trophy, Target, TrendingUp, Activity,
  Award, Calendar, Zap
} from 'lucide-react';
import { apiGetUsers, apiGetCampaigns, apiGetParticipations } from '@/lib/mockApi';
import { User, Campaign, Participation } from '@/data/mockData';

const spring = { type: 'spring' as const, duration: 0.5, bounce: 0 };

// ── Palette ────────────────────────────────────────────────────────────────
const COLORS = {
  primary:  'hsl(var(--primary))',
  secondary:'hsl(var(--secondary))',
  accent:   'hsl(var(--accent))',
  warning:  'hsl(var(--warning))',
  success:  'hsl(var(--success))',
  muted:    'hsl(var(--muted-foreground))',
};
const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

// ── Helpers ────────────────────────────────────────────────────────────────
const parseDate = (raw: string | undefined): Date | null => {
  if (!raw) return null;
  // ISO "2026-01-15" or "YYYY-MM-DDTHH:…"
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const monthKey = (d: Date) =>
  d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

// ── Tooltip customizado ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────
interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
}
const KpiCard = ({ icon, label, value, sub, color, delay = 0 }: KpiProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...spring, delay }}
    className="bg-card rounded-2xl p-5 card-shadow flex items-center gap-4"
  >
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}22` }}
    >
      <span style={{ color }}>{icon}</span>
    </div>
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-foreground leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

// ── Chart Card ─────────────────────────────────────────────────────────────
const ChartCard = ({
  title, subtitle, children, delay = 0, className = '',
}: {
  title: string; subtitle?: string; children: React.ReactNode;
  delay?: number; className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...spring, delay }}
    className={`bg-card rounded-2xl p-5 card-shadow ${className}`}
  >
    <p className="font-bold italic text-sm text-foreground">{title}</p>
    {subtitle && <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>}
    {!subtitle && <div className="mb-4" />}
    {children}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [users, setUsers]   = useState<User[]>([]);
  const [camps, setCamps]   = useState<Campaign[]>([]);
  const [parts, setParts]   = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGetUsers(), apiGetCampaigns(), apiGetParticipations()])
      .then(([u, c, p]) => { setUsers(u); setCamps(c); setParts(p); })
      .finally(() => setLoading(false));
  }, []);

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const totalUsers      = users.length;
  const activeUsers     = users.filter(u => u.userStatus === 'Ativo').length;
  const premiumUsers    = users.filter(u => u.plan === 'Premium').length;
  const totalCampaigns  = camps.length;
  const openCampaigns   = camps.filter(c => c.status === 'Aberto').length;
  const totalParts      = parts.length;
  const winners         = parts.filter(p => p.participationStatus === 'Ganhador').length;
  const qualified       = parts.filter(p => p.participationStatus === 'Qualificado').length;
  const concludedParts  = parts.filter(p =>
    ['Concluído', 'Qualificado', 'Ganhador'].includes(p.participationStatus)
  ).length;
  const conversionRate  = totalParts > 0
    ? Math.round((concludedParts / totalParts) * 100) : 0;

  // avg score of scored participations
  const scored = parts.filter(p => p.totalScore != null && p.totalScore > 0);
  const avgScore = scored.length > 0
    ? (scored.reduce((s, p) => s + (p.totalScore ?? 0), 0) / scored.length).toFixed(1)
    : '—';

  // ── Chart: participações por mês ──────────────────────────────────────────
  const partsByMonth: Record<string, number> = {};
  parts.forEach(p => {
    const d = parseDate(p.timestamp);
    if (!d) return;
    const k = monthKey(d);
    partsByMonth[k] = (partsByMonth[k] || 0) + 1;
  });
  const partsMonthData = Object.entries(partsByMonth)
    .map(([month, total]) => ({ month, total }))
    .slice(-8);

  // ── Chart: usuários novos por mês ─────────────────────────────────────────
  const usersByMonth: Record<string, number> = {};
  users.forEach(u => {
    const d = parseDate(u.createdAt);
    if (!d) return;
    const k = monthKey(d);
    usersByMonth[k] = (usersByMonth[k] || 0) + 1;
  });
  const usersMonthData = Object.entries(usersByMonth)
    .map(([month, novos]) => ({ month, novos }))
    .slice(-8);

  // ── Chart: status de participações (donut) ────────────────────────────────
  const statusCount: Record<string, number> = {};
  parts.forEach(p => {
    statusCount[p.participationStatus] = (statusCount[p.participationStatus] || 0) + 1;
  });
  const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  // ── Chart: campanhas por esporte (bar) ────────────────────────────────────
  const campsBySport: Record<string, number> = {};
  camps.forEach(c => {
    campsBySport[c.sport] = (campsBySport[c.sport] || 0) + 1;
  });
  const sportData = Object.entries(campsBySport)
    .map(([sport, total]) => ({ sport, total }))
    .sort((a, b) => b.total - a.total);

  // ── Chart: plano dos usuários (pie) ───────────────────────────────────────
  const planData = [
    { name: 'Premium',  value: premiumUsers },
    { name: 'Freemium', value: totalUsers - premiumUsers },
  ];

  // ── Chart: status das campanhas ───────────────────────────────────────────
  const campStatusCount: Record<string, number> = {};
  camps.forEach(c => { campStatusCount[c.status] = (campStatusCount[c.status] || 0) + 1; });
  const campStatusData = Object.entries(campStatusCount).map(([name, value]) => ({ name, value }));

  // ── Top performers (highest totalScore) ───────────────────────────────────
  const topPerformers = [...parts]
    .filter(p => p.totalScore != null && p.totalScore > 0)
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    .slice(0, 5)
    .map(p => {
      const u = users.find(u => u.id === p.userId);
      const c = camps.find(c => c.id === p.campaignId);
      return { name: u?.name ?? 'Desconhecido', score: p.totalScore ?? 0, sport: c?.sport ?? '' };
    });

  const topPerformerChartData = topPerformers.map(t => ({
    name: t.name.split(' ')[0],
    score: t.score,
    sport: t.sport,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-bold italic text-2xl text-foreground">DASHBOARD</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Visão geral da plataforma · Dados em tempo real
        </p>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users size={22} />}
          label="Usuários Totais"
          value={totalUsers}
          sub={`${activeUsers} ativos`}
          color={COLORS.primary}
          delay={0}
        />
        <KpiCard
          icon={<Target size={22} />}
          label="Campanhas"
          value={totalCampaigns}
          sub={`${openCampaigns} abertas`}
          color={COLORS.accent}
          delay={0.05}
        />
        <KpiCard
          icon={<Activity size={22} />}
          label="Participações"
          value={totalParts}
          sub={`${conversionRate}% taxa conclusão`}
          color={COLORS.secondary}
          delay={0.1}
        />
        <KpiCard
          icon={<Trophy size={22} />}
          label="Ganhadores"
          value={winners}
          sub={`${qualified} qualificados`}
          color={COLORS.warning}
          delay={0.15}
        />
        <KpiCard
          icon={<Award size={22} />}
          label="Usuários Premium"
          value={premiumUsers}
          sub={`${Math.round((premiumUsers / (totalUsers || 1)) * 100)}% do total`}
          color="#8b5cf6"
          delay={0.2}
        />
        <KpiCard
          icon={<Zap size={22} />}
          label="Nota Média"
          value={avgScore}
          sub="pontuação total"
          color={COLORS.success}
          delay={0.25}
        />
        <KpiCard
          icon={<Calendar size={22} />}
          label="Concluídas"
          value={concludedParts}
          sub="participações encerradas"
          color="#06b6d4"
          delay={0.3}
        />
        <KpiCard
          icon={<TrendingUp size={22} />}
          label="Taxa Conversão"
          value={`${conversionRate}%`}
          sub="em → concluído"
          color="#f43f5e"
          delay={0.35}
        />
      </div>

      {/* ── Row 1: Area + Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="PARTICIPAÇÕES POR MÊS"
          subtitle="Evolução histórica de participações"
          delay={0.2}
        >
          {partsMonthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={partsMonthData}>
                <defs>
                  <linearGradient id="gradParts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.secondary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: COLORS.muted }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Participações"
                  stroke={COLORS.secondary}
                  fill="url(#gradParts)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: COLORS.secondary }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard
          title="NOVOS USUÁRIOS POR MÊS"
          subtitle="Crescimento da base de atletas"
          delay={0.25}
        >
          {usersMonthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={usersMonthData}>
                <defs>
                  <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: COLORS.muted }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="novos"
                  name="Novos usuários"
                  stroke={COLORS.primary}
                  fill="url(#gradUsers)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: COLORS.primary }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      {/* ── Row 2: Donuts + Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status participações */}
        <ChartCard title="STATUS DAS PARTICIPAÇÕES" subtitle="Distribuição atual" delay={0.3}>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {statusData.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </ChartCard>

        {/* Plano usuários */}
        <ChartCard title="PLANO DOS USUÁRIOS" subtitle="Premium vs Freemium" delay={0.35}>
          {totalUsers > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={planData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#8b5cf6" />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {planData.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: i === 0 ? '#8b5cf6' : 'hsl(var(--muted-foreground))' }} />
                      <span className="text-muted-foreground">{p.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </ChartCard>

        {/* Status campanhas */}
        <ChartCard title="STATUS DAS CAMPANHAS" subtitle="Por estado atual" delay={0.4}>
          {campStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={campStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {campStatusData.map((_, i) => (
                      <Cell key={i} fill={[COLORS.success, COLORS.warning, COLORS.accent, '#ef4444'][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {campStatusData.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: [COLORS.success, COLORS.warning, COLORS.accent, '#ef4444'][i % 4] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* ── Row 3: Bar esportes + Top performers ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="CAMPANHAS POR ESPORTE"
          subtitle="Distribuição de modalidades"
          delay={0.45}
        >
          {sportData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sportData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: COLORS.muted }} allowDecimals={false} />
                <YAxis dataKey="sport" type="category" tick={{ fontSize: 10, fill: COLORS.muted }} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Campanhas" radius={[0, 6, 6, 0]}>
                  {sportData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard
          title="TOP 5 PONTUAÇÕES"
          subtitle="Participantes com maior nota total"
          delay={0.5}
        >
          {topPerformerChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topPerformerChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.muted }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} domain={[0, 9.5]} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name="Nota" radius={[6, 6, 0, 0]}>
                  {topPerformerChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs">
              <Trophy size={28} className="mb-2 opacity-30" />
              <p>Nenhuma pontuação registrada ainda.</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Row 4: Funil de conversão ── */}
      <ChartCard
        title="FUNIL DE PARTICIPAÇÃO"
        subtitle="Conversão de status por etapa"
        delay={0.55}
      >
        <FunnelVis parts={parts} />
      </ChartCard>

      {/* ── Row 5: Tabela top performers ── */}
      {topPerformers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.6 }}
          className="bg-card rounded-2xl card-shadow overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border">
            <p className="font-bold italic text-sm text-foreground">RANKING DE PONTUAÇÃO</p>
            <p className="text-xs text-muted-foreground">Top participantes qualificados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground">#</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground">PARTICIPANTE</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground">ESPORTE</th>
                  <th className="text-right px-5 py-3 text-xs text-muted-foreground">NOTA TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topPerformers.map((t, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-black text-muted-foreground">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="px-5 py-3 font-bold text-foreground">{t.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{t.sport}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-black px-2 py-1 rounded-lg text-sm ${
                        t.score >= 8 ? 'bg-warning/20 text-warning' :
                        t.score >= 5 ? 'bg-accent/20 text-accent' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {t.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ── Funil visual ────────────────────────────────────────────────────────────
const FunnelVis = ({ parts }: { parts: Participation[] }) => {
  const steps = [
    { label: 'Em Curso',    status: 'Em curso',        color: '#6366f1' },
    { label: 'Concluído',   status: 'Concluído',       color: '#10b981' },
    { label: 'Qualificado', status: 'Qualificado',     color: '#f59e0b' },
    { label: 'Ganhador',    status: 'Ganhador',        color: '#f43f5e' },
  ];
  const total = parts.length || 1;

  return (
    <div className="flex flex-col md:flex-row items-stretch gap-2 py-2">
      {steps.map((s, i) => {
        const count = parts.filter(p => p.participationStatus === s.status).length;
        const pct   = Math.round((count / total) * 100);
        return (
          <div key={s.status} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full rounded-xl flex flex-col items-center justify-center py-6 transition-all"
              style={{ background: `${s.color}22`, borderLeft: `3px solid ${s.color}` }}
            >
              <span className="text-2xl font-black" style={{ color: s.color }}>{count}</span>
              <span className="text-xs font-bold mt-1" style={{ color: s.color }}>{pct}%</span>
            </div>
            <p className="text-xs text-muted-foreground text-center font-bold">{s.label}</p>
            {i < steps.length - 1 && (
              <span className="hidden md:block absolute text-muted-foreground text-lg" style={{ pointerEvents: 'none' }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Componente vazio ────────────────────────────────────────────────────────
const EmptyChart = () => (
  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs">
    <Activity size={28} className="mb-2 opacity-30" />
    <p>Sem dados suficientes ainda.</p>
  </div>
);

export default AdminDashboard;
