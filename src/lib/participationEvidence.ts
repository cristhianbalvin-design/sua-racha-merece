import type { Participation } from '@/data/mockData';
import { apiSaveOwnParticipationEvidence, apiUploadEvidence } from '@/lib/mockApi';

export interface SubmitParticipationEvidenceInput {
  participationId: string;
  userId: string;
  expectedStatus: 'Em curso' | 'Concluído';
  photos: File[];
  existingPhotoUrls?: string[];
  instagram: boolean;
  instagramScreenshot?: File | null;
  existingInstagramScreenshotUrl?: string | null;
  comment: string;
}

export const submitParticipationEvidence = async ({
  participationId,
  userId,
  expectedStatus,
  photos,
  existingPhotoUrls = [],
  instagram,
  instagramScreenshot,
  existingInstagramScreenshotUrl,
  comment,
}: SubmitParticipationEvidenceInput): Promise<Participation> => {
  const [mediaUrls, instagramUrlResult] = await Promise.all([
    Promise.all(photos.map((file) => apiUploadEvidence(file, userId))),
    instagram && instagramScreenshot
      ? apiUploadEvidence(instagramScreenshot, userId)
      : Promise.resolve(undefined),
  ]);

  const uploadedUrls = mediaUrls.filter((url): url is string => url !== null);
  const instagramUrl = instagramUrlResult || undefined;

  if (photos.length > 0 && uploadedUrls.length !== photos.length) {
    throw new Error('Erro ao enviar a foto. Tente novamente.');
  }
  if (instagram && instagramScreenshot && !instagramUrl) {
    throw new Error('Erro ao enviar a captura do Instagram. Tente novamente.');
  }

  return apiSaveOwnParticipationEvidence(participationId, userId, expectedStatus, {
    comment,
    instagram,
    photo: [...existingPhotoUrls, ...uploadedUrls],
    instagramPhoto: instagram
      ? (instagramUrl || existingInstagramScreenshotUrl || undefined)
      : undefined,
  });
};
