export type PracticeTime = 'menos_1_ano' | '1_a_3_anos' | '3_a_5_anos' | 'mais_5_anos';
export type MainGoal = 'melhorar_desempenho' | 'participar_eventos' | 'superar_limites' | 'cuidar_saude' | 'competir';
export type WeeklyFrequency = '1_vez' | '2_vezes' | '3_vezes' | '4_vezes' | '5_ou_mais';
export type DesiredReward = 'inscricao_eventos' | 'kit_esportivo' | 'produtos_esportivos' | 'premios_dinheiro' | 'outros_premios';
export type Expectation2028 = 'mais_sorteios' | 'mais_eventos' | 'mais_premios' | 'beneficios_premium' | 'novas_experiencias';

export interface SportProfile {
  userId: string;
  // 7 preguntas de perfil deportivo
  practiceTime?: PracticeTime | null;
  favoriteModality?: string | null;
  mainGoal?: MainGoal | null;
  weeklyFrequency?: WeeklyFrequency | null;
  targetEvent2028?: string | null;
  desiredReward?: DesiredReward | null;
  expectation2028?: Expectation2028 | null;

  // 5 campos de redes sociales
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  facebookHandle?: string | null;
  youtubeHandle?: string | null;
  otherSocialLink?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface OptionItem<T extends string = string> {
  value: T;
  label: string;
}

export const PRACTICE_TIME_OPTIONS: OptionItem<PracticeTime>[] = [
  { value: 'menos_1_ano', label: 'Menos de 1 ano' },
  { value: '1_a_3_anos', label: '1 a 3 anos' },
  { value: '3_a_5_anos', label: '3 a 5 anos' },
  { value: 'mais_5_anos', label: 'Mais de 5 anos' },
];

export const MAIN_GOAL_OPTIONS: OptionItem<MainGoal>[] = [
  { value: 'cuidar_saude', label: 'Cuidar da saúde' },
  { value: 'melhorar_desempenho', label: 'Melhorar desempenho' },
  { value: 'superar_limites', label: 'Superar limites' },
  { value: 'participar_eventos', label: 'Participar de eventos' },
  { value: 'competir', label: 'Competir e vencer' },
];

export const WEEKLY_FREQUENCY_OPTIONS: OptionItem<WeeklyFrequency>[] = [
  { value: '1_vez', label: '1 vez por semana' },
  { value: '2_vezes', label: '2 vezes por semana' },
  { value: '3_vezes', label: '3 vezes por semana' },
  { value: '4_vezes', label: '4 vezes por semana' },
  { value: '5_ou_mais', label: '5 ou mais vezes por semana' },
];

export const DESIRED_REWARD_OPTIONS: OptionItem<DesiredReward>[] = [
  { value: 'inscricao_eventos', label: 'Inscrição em eventos' },
  { value: 'kit_esportivo', label: 'Kits esportivos' },
  { value: 'produtos_esportivos', label: 'Produtos e equipamentos' },
  { value: 'premios_dinheiro', label: 'Prêmios em dinheiro' },
  { value: 'outros_premios', label: 'Outros prêmios e experiências' },
];

export const EXPECTATION_2028_OPTIONS: OptionItem<Expectation2028>[] = [
  { value: 'mais_sorteios', label: 'Mais sorteios e campanhas' },
  { value: 'mais_eventos', label: 'Mais eventos parceiros' },
  { value: 'mais_premios', label: 'Prêmios maiores e frequentes' },
  { value: 'beneficios_premium', label: 'Benefícios e descontos exclusivos' },
  { value: 'novas_experiencias', label: 'Novas experiências esportivas' },
];

export interface UserParticipationHistoryItem {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignSport: string;
  campaignCity: string;
  campaignPrize: string;
  status: string;
  createdAt: string;
}
