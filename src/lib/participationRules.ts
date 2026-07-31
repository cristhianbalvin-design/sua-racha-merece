import type { ParticipationStatus } from '@/data/mockData';

export const canEditParticipationEvidence = (status: ParticipationStatus): boolean =>
  status === 'Concluído';

export const shouldShowIncompleteEmailLink = (status: ParticipationStatus): boolean =>
  status === 'Não concluído';
