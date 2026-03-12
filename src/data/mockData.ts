import avatarLucas from '@/assets/avatar-lucas.jpg';
import avatarAna from '@/assets/avatar-ana.jpg';
import avatarRafael from '@/assets/avatar-rafael.jpg';
import avatarMariana from '@/assets/avatar-mariana.jpg';
import avatarJoao from '@/assets/avatar-joao.jpg';
import winnerRunning from '@/assets/winner-running.jpg';
import winnerCrossfit from '@/assets/winner-crossfit.jpg';
import winnerCycling from '@/assets/winner-cycling.jpg';

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
}

export interface User {
  id: string;
  name: string;
  city: string;
  country: string;
  sport: string;
  plan: 'Freemium' | 'Premium';
  avatar: string;
  campaignsParticipated: number;
  campaignsWon: number;
  status: 'Pendente' | 'Aprovado';
  photos: string[];
}

export interface Winner {
  id: string;
  user: User;
  prize: string;
  justification: string;
  medal: string;
  photo: string;
}

export interface Participation {
  userId: string;
  campaignId: string;
  status: 'Em avaliação' | 'Ganhador de patrocínio' | 'Participação registrada';
  statusIcon: string;
  photo: string;
  comment?: string;
  instagram: boolean;
  timestamp: string;
}

export const campaigns: Campaign[] = [
  {
    id: 'camp-1',
    sport: 'Corrida',
    sportIcon: '🏃',
    city: 'São Paulo',
    region: 'SP',
    startDate: '01/03/2026',
    endDate: '31/03/2026',
    description: 'Mostre sua melhor corrida e ganhe tênis novos',
    winnersCount: 3,
    prize: 'Tênis Nike Air Zoom — R$350',
  },
  {
    id: 'camp-2',
    sport: 'Crossfit',
    sportIcon: '🏋️',
    city: 'Belo Horizonte',
    region: 'MG',
    startDate: '10/03/2026',
    endDate: '10/04/2026',
    description: 'Foto do seu melhor WOD com atitude máxima',
    winnersCount: 2,
    prize: 'Camiseta Adidas — R$150',
  },
  {
    id: 'camp-3',
    sport: 'Ciclismo',
    sportIcon: '🚴',
    city: 'Curitiba',
    region: 'PR',
    startDate: '15/03/2026',
    endDate: '15/04/2026',
    description: 'Pedala e mostra! Melhor foto ganha',
    winnersCount: 1,
    prize: 'Kit Ciclismo Shimano — R$280',
  },
];

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Lucas Ferreira',
    city: 'São Paulo',
    country: 'Brasil',
    sport: 'Corrida',
    plan: 'Freemium',
    avatar: avatarLucas,
    campaignsParticipated: 4,
    campaignsWon: 0,
    status: 'Aprovado',
    photos: [winnerRunning, winnerCrossfit],
  },
  {
    id: 'user-2',
    name: 'Ana Beatriz Costa',
    city: 'Belo Horizonte',
    country: 'Brasil',
    sport: 'Crossfit',
    plan: 'Premium',
    avatar: avatarAna,
    campaignsParticipated: 7,
    campaignsWon: 1,
    status: 'Aprovado',
    photos: [winnerCrossfit, winnerRunning, winnerCycling],
  },
  {
    id: 'user-3',
    name: 'Rafael Oliveira',
    city: 'Curitiba',
    country: 'Brasil',
    sport: 'Ciclismo',
    plan: 'Premium',
    avatar: avatarRafael,
    campaignsParticipated: 3,
    campaignsWon: 0,
    status: 'Pendente',
    photos: [winnerCycling],
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
      status: 'Aprovado',
      photos: [winnerRunning],
    },
    prize: 'Tênis Nike Air Zoom — R$350',
    justification: 'Atitude incrível, presença e energia em cada foto. Merece!',
    medal: '🥇',
    photo: winnerRunning,
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
      status: 'Aprovado',
      photos: [winnerCrossfit],
    },
    prize: 'Camiseta Adidas — R$150',
    justification: 'Participou de todas as campanhas. Continuidade exemplar.',
    medal: '🥈',
    photo: winnerCrossfit,
  },
];

export const participations: Participation[] = [
  {
    userId: 'user-1',
    campaignId: 'camp-1',
    status: 'Em avaliação',
    statusIcon: '🟡',
    photo: winnerRunning,
    comment: 'Melhor corrida da minha vida!',
    instagram: true,
    timestamp: '12/03/2026 08:45',
  },
  {
    userId: 'user-2',
    campaignId: 'camp-2',
    status: 'Ganhador de patrocínio',
    statusIcon: '🏆',
    photo: winnerCrossfit,
    comment: 'WOD insano hoje!',
    instagram: true,
    timestamp: '11/03/2026 17:30',
  },
  {
    userId: 'user-3',
    campaignId: 'camp-3',
    status: 'Participação registrada',
    statusIcon: '✅',
    photo: winnerCycling,
    instagram: false,
    timestamp: '10/03/2026 14:20',
  },
];

export const currentUser = users[0];

export const sports = ['Corrida', 'Crossfit', 'Natação', 'Ciclismo', 'Futebol', 'Academia', 'Outro'];
