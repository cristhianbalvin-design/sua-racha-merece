import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, CheckCircle2, Trophy, Flame, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  SportProfile,
  PracticeTime,
  MainGoal,
  WeeklyFrequency,
  DesiredReward,
  Expectation2028,
  PRACTICE_TIME_OPTIONS,
  MAIN_GOAL_OPTIONS,
  WEEKLY_FREQUENCY_OPTIONS,
  DESIRED_REWARD_OPTIONS,
  EXPECTATION_2028_OPTIONS,
} from '@/types/sportProfile';
import { apiGetSportProfile, apiUpsertSportProfile } from '@/lib/mockApi';

interface SportProfileFormProps {
  userId: string;
  onSaved?: (profile: SportProfile) => void;
}

const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };

export const SportProfileForm = ({ userId, onSaved }: SportProfileFormProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form fields
  const [practiceTime, setPracticeTime] = useState<PracticeTime | ''>('');
  const [favoriteModality, setFavoriteModality] = useState('');
  const [mainGoal, setMainGoal] = useState<MainGoal | ''>('');
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeeklyFrequency | ''>('');
  const [targetEvent2028, setTargetEvent2028] = useState('');
  const [desiredReward, setDesiredReward] = useState<DesiredReward | ''>('');
  const [expectation2028, setExpectation2028] = useState<Expectation2028 | ''>('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    apiGetSportProfile(userId)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setPracticeTime(data.practiceTime || '');
          setFavoriteModality(data.favoriteModality || '');
          setMainGoal(data.mainGoal || '');
          setWeeklyFrequency(data.weeklyFrequency || '');
          setTargetEvent2028(data.targetEvent2028 || '');
          setDesiredReward(data.desiredReward || '');
          setExpectation2028(data.expectation2028 || '');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error('Falha ao carregar perfil esportivo:', err);
        setLoadError(err.message || 'Erro ao carregar dados do perfil');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, retryKey]);

  // Calculate answered questions (0 to 7)
  const answeredCount = [
    Boolean(practiceTime),
    Boolean(favoriteModality.trim()),
    Boolean(mainGoal),
    Boolean(weeklyFrequency),
    Boolean(targetEvent2028.trim()),
    Boolean(desiredReward),
    Boolean(expectation2028),
  ].filter(Boolean).length;

  const progressPercentage = Math.round((answeredCount / 7) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    toast.loading('Salvando perfil esportivo...', { id: 'sport-profile' });

    try {
      const updated = await apiUpsertSportProfile(userId, {
        practiceTime: practiceTime ? (practiceTime as PracticeTime) : null,
        favoriteModality: favoriteModality.trim() || null,
        mainGoal: mainGoal ? (mainGoal as MainGoal) : null,
        weeklyFrequency: weeklyFrequency ? (weeklyFrequency as WeeklyFrequency) : null,
        targetEvent2028: targetEvent2028.trim() || null,
        desiredReward: desiredReward ? (desiredReward as DesiredReward) : null,
        expectation2028: expectation2028 ? (expectation2028 as Expectation2028) : null,
      });

      toast.success('Perfil esportivo atualizado com sucesso!', { id: 'sport-profile' });
      if (updated && onSaved) onSaved(updated);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar perfil esportivo.', { id: 'sport-profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl card-shadow p-6 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Carregando perfil esportivo...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-card rounded-2xl card-shadow p-6 text-center space-y-4 border border-destructive/30">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Não foi possível carregar seu perfil</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Ocorreu uma falha ao consultar suas respostas salvas. Para sua segurança, a edição foi bloqueada para não sobrescrever seus dados.
          </p>
          <p className="text-[11px] text-destructive font-mono mt-2 bg-destructive/10 py-1 px-2.5 rounded-lg inline-block">
            {loadError}
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl card-shadow p-5 space-y-6">
      {/* Header & Completion Badge */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold italic uppercase tracking-wider text-foreground">
              Perfil Esportivo
            </h2>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
              answeredCount === 7
                ? 'bg-success/20 text-success'
                : 'bg-primary/20 text-primary'
            }`}
          >
            {answeredCount === 7 && <CheckCircle2 className="w-3.5 h-3.5" />}
            {answeredCount}/7 respondidas
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <motion.div
            className={`h-full ${answeredCount === 7 ? 'bg-success' : 'bg-primary'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* 1. Practice Time */}
      <div>
        <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1.5">
          1. Há quanto tempo você pratica esportes?
        </label>
        <select
          value={practiceTime}
          onChange={(e) => setPracticeTime(e.target.value as PracticeTime)}
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
        >
          <option value="">Selecione o tempo de prática</option>
          {PRACTICE_TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Favorite Modality (Text libre) */}
      <div>
        <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1.5">
          2. Qual é a sua modalidade favorita?
        </label>
        <input
          type="text"
          value={favoriteModality}
          onChange={(e) => setFavoriteModality(e.target.value)}
          placeholder="Ex: 5k e 10k, Meia-maratona, Atacante, Crossfit RX..."
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Especifique dentro do seu esporte principal (distância, posição, categoria, etc.)
        </p>
      </div>

      {/* 3. Main Goal */}
      <div>
        <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1.5">
          3. Qual é o seu objetivo principal hoje?
        </label>
        <select
          value={mainGoal}
          onChange={(e) => setMainGoal(e.target.value as MainGoal)}
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
        >
          <option value="">Selecione seu objetivo</option>
          {MAIN_GOAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Weekly Frequency */}
      <div>
        <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1.5">
          4. Com que frequência você treina por semana?
        </label>
        <select
          value={weeklyFrequency}
          onChange={(e) => setWeeklyFrequency(e.target.value as WeeklyFrequency)}
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
        >
          <option value="">Selecione a frequência</option>
          {WEEKLY_FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Target Event 2028 (Text libre) */}
      <div>
        <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1.5">
          5. Qual é a sua meta ou evento dos sonhos até 2028?
        </label>
        <input
          type="text"
          value={targetEvent2028}
          onChange={(e) => setTargetEvent2028(e.target.value)}
          placeholder="Ex: Maratona do Rio 2028, Sub-40 nos 10km, Campeonato Estadual..."
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
        />
      </div>

      {/* 6. Desired Reward */}
      <div>
        <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1.5">
          6. Que tipo de prêmio você mais gostaria de ganhar?
        </label>
        <select
          value={desiredReward}
          onChange={(e) => setDesiredReward(e.target.value as DesiredReward)}
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
        >
          <option value="">Selecione sua premiação ideal</option>
          {DESIRED_REWARD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 7. Expectation 2028 */}
      <div>
        <label className="text-ui text-xs text-muted-foreground block font-bold uppercase mb-1.5">
          7. O que você mais espera da 3BUK até 2028?
        </label>
        <select
          value={expectation2028}
          onChange={(e) => setExpectation2028(e.target.value as Expectation2028)}
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
        >
          <option value="">Selecione o que espera da plataforma</option>
          {EXPECTATION_2028_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <motion.button
          type="submit"
          disabled={saving}
          whileHover={!saving ? { scale: 1.02 } : {}}
          whileTap={!saving ? { scale: 0.98 } : {}}
          transition={spring}
          className={`w-full py-3.5 rounded-xl font-bold btn-shadow flex items-center justify-center gap-2 text-ui text-xs transition-all ${
            saving
              ? 'bg-primary/70 text-primary-foreground cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
        >
          <Save size={16} />
          {saving ? 'SALVANDO RESPOSTAS...' : 'SALVAR PERFIL ESPORTIVO'}
        </motion.button>
      </div>
    </form>
  );
};
