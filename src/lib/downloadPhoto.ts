/** Baixa uma imagem remota como arquivo local (via blob, para forçar o download). */
export const downloadPhotoFile = async (imageUrl: string, photoId: string): Promise<void> => {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Falha ao baixar imagem');
  const blob = await response.blob();
  const localUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = localUrl;
  link.download = `foto_${photoId}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(localUrl);
};
