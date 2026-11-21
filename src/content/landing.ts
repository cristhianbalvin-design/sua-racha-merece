import type { LucideIcon } from 'lucide-react';

export type Testimonial = { img: string; quote: string; name: string; meta: string };
// Solo se deben cargar testimonios reales con autorización de imagen.
export const TESTIMONIALS: Testimonial[] = [];
export const SOCIAL_LINKS: { label: string; href: string; icon: LucideIcon }[] = [];
export const FAQS = [
  [
    'Como funciona o Buky?',
    'O Buky é o jogo de corrida da 3buk. Você escolhe uma rota oficial da sua cidade (ou, nas cidades em que estiver liberado, o treino livre), corre com o GPS ligado e pega Bukys pelo caminho. Os Bukys contam para o ranking da cidade e o ranking nacional. Há um limite diário de treinos e de Bukys, que é maior para quem é Premium.',
  ],
  [
    'O que é o Freemium?',
    'É o plano gratuito. Você cria sua conta, corre, pega Bukys, aparece no ranking e participa das campanhas disponíveis para o seu perfil, sem pagar nada.',
  ],
  [
    'O que é o Premium?',
    'É a assinatura da 3buk para quem quer ir além: mais Bukys por dia, participação em todas as campanhas e maior chance de prêmios. Nesta fase, a assinatura é feita diretamente com a equipe pelo e-mail contato@3buk.com.',
  ],
  [
    'Como participo das campanhas?',
    'Crie sua conta, complete seu perfil e abra a área de Campanhas. Escolha uma campanha, siga o regulamento e envie sua participação. A 3buk avalia atitude, comprometimento e continuidade para premiar atletas amadores.',
  ],
];
export const PAGINAS = {
  sobre: {
    title: 'Sobre a 3buk',
    intro:
      'A 3buk é entretenimento esportivo para amadores. Patrocinamos atletas amadores com base em compromisso, continuidade e atitude, e reunimos corrida, fotos e campanhas em um só lugar.',
    sections: [
      {
        id: 'como-funciona',
        title: 'Como funciona',
        items: [
          '1. Você entra — Crie seu perfil e escolha como quer competir.',
          '2. Você participa — Corra, pegue Bukys e entre nas campanhas.',
          '3. Você pode ser patrocinado — A 3buk avalia compromisso, continuidade e atitude. Nem todos serão escolhidos.',
        ],
      },
    ],
  },
  regulamento: {
    title: 'Regulamento',
    intro:
      'Este é o regulamento geral da 3buk. Cada campanha pode ter regras próprias, que prevalecem sobre este texto.',
    sections: [
      {
        title: 'Participação',
        items: [
          'Maiores de 18 anos ou com autorização do responsável.',
          'Uma conta por pessoa.',
          'Dados verdadeiros.',
        ],
      },
      {
        title: 'Treinos e Bukys',
        items: ['GPS ativo.', 'Limites diários.', 'Treinos fora das regras podem ser invalidados.'],
      },
      {
        title: 'Campanhas e prêmios',
        items: [
          'Cada campanha define critérios e prêmios.',
          'Avaliação por atitude, comprometimento e continuidade.',
        ],
      },
      {
        title: 'Dados pessoais',
        items: [
          'Tratamento conforme a LGPD.',
          'Fotos e reconhecimento facial usados apenas para a busca de fotos do próprio atleta.',
        ],
      },
      { title: 'Contato', items: ['contato@3buk.com'] },
    ],
  },
  contato: {
    title: 'Fale conosco',
    intro: 'Escreva para contato@3buk.com.',
    sections: [
      {
        id: 'imprensa',
        title: 'Imprensa',
        items: ["Jornalistas e veículos: escrevam para contato@3buk.com com o assunto 'Imprensa'."],
      },
    ],
  },
} as const;
