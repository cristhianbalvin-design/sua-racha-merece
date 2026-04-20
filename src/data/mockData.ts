import avatarLucas from '@/assets/avatar-lucas.jpg';
import avatarAna from '@/assets/avatar-ana.jpg';
import avatarRafael from '@/assets/avatar-rafael.jpg';
import avatarMariana from '@/assets/avatar-mariana.jpg';
import avatarJoao from '@/assets/avatar-joao.jpg';
import winnerRunning from '@/assets/winner-running.jpg';
import winnerCrossfit from '@/assets/winner-crossfit.jpg';
import winnerCycling from '@/assets/winner-cycling.jpg';

// ─── Status enums ───────────────────────────────────────────────
export type ParticipationStatus = 'Em curso' | 'Concluído' | 'Não concluído' | 'Qualificado' | 'Ganhador';
export type CampaignStatus = 'Aberto' | 'Concluído' | 'Eliminado' | 'Qualificado';
export type UserStatus = 'Ativo' | 'Desabilitado';

// ─── Master tables ──────────────────────────────────────────────
export const sportsMaster: string[] = [
  'Corrida', 'Crossfit', 'Natação', 'Ciclismo', 'Futebol', 'Academia',
  'Basquete', 'Vôlei', 'Tênis', 'Boxe', 'Jiu-Jitsu', 'Yoga', 'Outro',
];

export const regionsMaster: string[] = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre',
  'Salvador', 'Brasília', 'Recife', 'Fortaleza', 'Manaus',
];

// kept for backward compat
export const sports = sportsMaster;

// ─── Interfaces ─────────────────────────────────────────────────
export interface Campaign {
  id: string;
  sport: string;
  sportIcon: string;
  city: string;
  region: string;
  startDate: string;
  endDate: string;
  description: string;
  winnersCount: number;
  prize: string;
  plan?: 'Freemium' | 'Premium' | 'Ambos';
  instagramOptional?: boolean;
  instagramHashtags?: string;
  status: CampaignStatus;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  city: string;
  country: string;
  sport: string;
  phone?: string;
  gender?: string;
  plan: 'Freemium' | 'Premium';
  avatar: string;
  campaignsParticipated: number;
  campaignsWon: number;
  userStatus: UserStatus;
  photos: string[];
  createdAt?: string;
}


export interface Winner {
  id: string;
  user: User;
  prize: string;
  justification: string;
  medal: string;
  photo: string;
  campaignMonth?: string;
  prizeDelivered?: boolean;
}

export interface Participation {
  id: string;
  userId: string;
  campaignId: string;
  participationStatus: ParticipationStatus;
  photo: string | string[];
  instagramPhoto?: string;
  comment?: string;
  instagram: boolean;
  timestamp: string;
  attitudeScore?: number;
  commitmentScore?: number;
  continuityScore?: number;
  totalScore?: number;
  prizeDelivered?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  campaignId: string;
  message: string;
  type: 'status_change' | 'winner' | 'approved';
  timestamp: string;
  read: boolean;
}

// ─── Mock data ──────────────────────────────────────────────────
export const campaigns: Campaign[] = [
  {
    id: 'camp-1',
    sport: 'Corrida',
    sportIcon: '🏃',
    city: 'São Paulo',
    region: 'São Paulo',
    startDate: '01/03/2026',
    endDate: '31/03/2026',
    description: 'Mostre sua melhor corrida e ganhe tênis novos',
    winnersCount: 3,
    prize: 'Tênis Nike Air Zoom — R$350',
    plan: 'Ambos',
    instagramOptional: true,
    instagramHashtags: '#3bukchallenge #3bukrun',
    status: 'Aberto',
    createdAt: '2026-02-25',
  },
  {
    id: 'camp-2',
    sport: 'Crossfit',
    sportIcon: '🏋️',
    city: 'Belo Horizonte',
    region: 'Belo Horizonte',
    startDate: '10/03/2026',
    endDate: '10/04/2026',
    description: 'Foto do seu melhor WOD com atitude máxima',
    winnersCount: 2,
    prize: 'Camiseta Adidas — R$150',
    plan: 'Premium',
    instagramOptional: true,
    instagramHashtags: '#3bukchallenge #3bukcrossfit',
    status: 'Aberto',
    createdAt: '2026-03-01',
  },
  {
    id: 'camp-3',
    sport: 'Ciclismo',
    sportIcon: '🚴',
    city: 'Curitiba',
    region: 'Curitiba',
    startDate: '15/01/2026',
    endDate: '15/02/2026',
    description: 'Pedala e mostra! Melhor foto ganha',
    winnersCount: 1,
    prize: 'Kit Ciclismo Shimano — R$280',
    plan: 'Freemium',
    instagramOptional: false,
    status: 'Concluído',
    createdAt: '2026-01-10',
  },
];

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Lucas Ferreira',
    email: 'lucas@email.com',
    city: 'São Paulo',
    country: 'Brasil',
    sport: 'Corrida',
    plan: 'Freemium',
    avatar: avatarLucas,
    campaignsParticipated: 4,
    campaignsWon: 0,
    userStatus: 'Ativo',
    photos: [winnerRunning, winnerCrossfit],
    createdAt: '2026-01-10',
  },
  {
    id: 'user-2',
    name: 'Ana Beatriz Costa',
    email: 'ana@email.com',
    city: 'Belo Horizonte',
    country: 'Brasil',
    sport: 'Crossfit',
    plan: 'Premium',
    avatar: avatarAna,
    campaignsParticipated: 7,
    campaignsWon: 1,
    userStatus: 'Ativo',
    photos: [winnerCrossfit, winnerRunning, winnerCycling],
    createdAt: '2025-12-05',
  },
  {
    id: 'user-3',
    name: 'Rafael Oliveira',
    email: 'rafael@email.com',
    city: 'Curitiba',
    country: 'Brasil',
    sport: 'Ciclismo',
    plan: 'Premium',
    avatar: avatarRafael,
    campaignsParticipated: 3,
    campaignsWon: 0,
    userStatus: 'Ativo',
    photos: [winnerCycling],
    createdAt: '2026-02-20',
  },
];

export const winners: Winner[] = [
  {
    id: 'win-1',
    user: {
      id: 'user-w1',
      name: 'Mariana Silva',
      city: 'São Paulo',
      country: 'Brasil',
      sport: 'Corrida',
      plan: 'Premium',
      avatar: avatarMariana,
      campaignsParticipated: 5,
      campaignsWon: 1,
      userStatus: 'Ativo',
      photos: [winnerRunning],
    },
    prize: 'Tênis Nike Air Zoom — R$350',
    justification: 'Atitude incrível, presença e energia em cada foto. Merece!',
    medal: '🥇',
    photo: winnerRunning,
    campaignMonth: 'Janeiro 2026',
  },
  {
    id: 'win-2',
    user: {
      id: 'user-w2',
      name: 'João Pedro Alves',
      city: 'Belo Horizonte',
      country: 'Brasil',
      sport: 'Crossfit',
      plan: 'Freemium',
      avatar: avatarJoao,
      campaignsParticipated: 6,
      campaignsWon: 1,
      userStatus: 'Ativo',
      photos: [winnerCrossfit],
    },
    prize: 'Camiseta Adidas — R$150',
    justification: 'Participou de todas as campanhas. Continuidade exemplar.',
    medal: '🥈',
    photo: winnerCrossfit,
    campaignMonth: 'Fevereiro 2026',
  },
];

export const participations: Participation[] = [
  {
    id: 'part-1',
    userId: 'user-1',
    campaignId: 'camp-1',
    participationStatus: 'Em curso',
    photo: winnerRunning,
    comment: 'Melhor corrida da minha vida!',
    instagram: true,
    timestamp: '12/03/2026 08:45',
  },
  {
    id: 'part-2',
    userId: 'user-2',
    campaignId: 'camp-2',
    participationStatus: 'Concluído',
    photo: winnerCrossfit,
    comment: 'WOD insano hoje!',
    instagram: true,
    timestamp: '11/03/2026 17:30',
  },
  {
    id: 'part-3',
    userId: 'user-3',
    campaignId: 'camp-3',
    participationStatus: 'Concluído',
    photo: winnerCycling,
    instagram: false,
    timestamp: '10/03/2026 14:20',
  },
];

export const notifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-1',
    campaignId: 'camp-1',
    message: 'Sua participação na campanha "Mostre sua melhor corrida" está em curso.',
    type: 'status_change',
    timestamp: '12/03/2026 09:00',
    read: false,
  },
  {
    id: 'notif-2',
    userId: 'user-1',
    campaignId: 'camp-1',
    message: 'Nova campanha disponível: Corrida — São Paulo. Participe agora!',
    type: 'approved',
    timestamp: '01/03/2026 08:00',
    read: true,
  },
  {
    id: 'notif-3',
    userId: 'user-2',
    campaignId: 'camp-2',
    message: '🏆 Parabéns! Você foi selecionado como ganhador de patrocínio na campanha de Crossfit!',
    type: 'winner',
    timestamp: '11/03/2026 18:00',
    read: false,
  },
];

export const currentUser = users[0];
