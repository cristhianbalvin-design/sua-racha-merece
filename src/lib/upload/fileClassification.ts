/**
 * Classificação de arquivos antes do envio para a Edge Function upload-event-photo.
 * Para fotógrafos a função aceita apenas JPEG, PNG e WEBP com até 20 MB.
 */

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export type FileClass = 'valid' | 'unsupported' | 'too_large';

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Extensões de imagem reconhecidas ao filtrar uma pasta (incluindo as não suportadas). */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff', 'avif', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'];

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

const extensionOf = (name: string): string => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
};

/** Tipo MIME efetivo: o do navegador ou, se vier vazio, o deduzido da extensão. */
export const effectiveMimeType = (file: FileLike): string => {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpg' || type === 'image/pjpeg') return 'image/jpeg';
  if (type) return type;
  return EXTENSION_MIME[extensionOf(file.name)] || '';
};

/** Arquivos ocultos/de sistema que aparecem ao escolher uma pasta. */
export const isSystemFile = (file: FileLike): boolean => {
  const n = file.name;
  return n.startsWith('.') || n === 'Thumbs.db' || n === 'desktop.ini';
};

/** Verdadeiro para qualquer imagem (suportada ou não). Usado para filtrar pastas. */
export const isImageFile = (file: FileLike): boolean => {
  if (isSystemFile(file)) return false;
  if ((file.type || '').toLowerCase().startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.includes(extensionOf(file.name));
};

export const classifyFile = (file: FileLike): FileClass => {
  const mime = effectiveMimeType(file);
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(mime)) return 'unsupported';
  if (file.size > MAX_PHOTO_BYTES) return 'too_large';
  return 'valid';
};

export interface ClassificationSummary<T extends FileLike> {
  valid: T[];
  unsupported: T[];
  tooLarge: T[];
}

export const classifyFiles = <T extends FileLike>(files: T[]): ClassificationSummary<T> => {
  const summary: ClassificationSummary<T> = { valid: [], unsupported: [], tooLarge: [] };
  for (const f of files) {
    const c = classifyFile(f);
    if (c === 'valid') summary.valid.push(f);
    else if (c === 'unsupported') summary.unsupported.push(f);
    else summary.tooLarge.push(f);
  }
  return summary;
};

/** Chave usada para "pular fotos já enviadas" (mesmo nome e tamanho). */
export const fileKey = (file: FileLike): string => `${file.name}|${file.size}`;

export const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace('.', ',')} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};
