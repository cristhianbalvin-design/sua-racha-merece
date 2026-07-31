import { describe, expect, it } from 'vitest';
import type { User } from '@/data/mockData';
import { buildUsersCsv } from '@/lib/csv';
import { canEditParticipationEvidence, shouldShowIncompleteEmailLink } from '@/lib/participationRules';

const user: User = {
  id: 'user-1',
  athleteNumber: 12,
  name: 'Ana "Runner" Silva',
  email: 'ana@example.com',
  city: 'São Paulo',
  country: 'SP',
  sport: 'Corrida',
  plan: 'Freemium',
  avatar: '',
  campaignsParticipated: 1,
  campaignsWon: 0,
  userStatus: 'Ativo',
  photos: [],
  createdAt: '2026-07-31T12:00:00.000Z',
};

describe('platform improvements', () => {
  it('exports the expected user fields and escapes CSV values', () => {
    const csv = buildUsersCsv([user]);
    expect(csv).toContain('"Nome","Email","Cidade","Estado","Data de registro"');
    expect(csv).toContain('"Ana ""Runner"" Silva","ana@example.com","São Paulo","SP"');
  });

  it('only allows evidence editing while participation is concluded', () => {
    expect(canEditParticipationEvidence('Concluído')).toBe(true);
    expect(canEditParticipationEvidence('Qualificado')).toBe(false);
    expect(canEditParticipationEvidence('Ganhador')).toBe(false);
  });

  it('only shows the email shortcut for incomplete participations', () => {
    expect(shouldShowIncompleteEmailLink('Não concluído')).toBe(true);
    expect(shouldShowIncompleteEmailLink('Em curso')).toBe(false);
  });
});
