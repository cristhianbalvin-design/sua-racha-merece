import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTO_BYTES,
  classifyFile,
  classifyFiles,
  effectiveMimeType,
  fileKey,
  isImageFile,
} from '@/lib/upload/fileClassification';

const f = (name: string, size: number, type = '') => ({ name, size, type });

describe('classificação de arquivos', () => {
  it('aceita JPEG, PNG e WEBP até 20 MB', () => {
    expect(classifyFile(f('a.jpg', 5_000_000, 'image/jpeg'))).toBe('valid');
    expect(classifyFile(f('b.png', 1000, 'image/png'))).toBe('valid');
    expect(classifyFile(f('c.webp', 1000, 'image/webp'))).toBe('valid');
    expect(classifyFile(f('d.jpg', MAX_PHOTO_BYTES, 'image/jpeg'))).toBe('valid');
  });

  it('marca formato não suportado (HEIC, RAW, GIF)', () => {
    expect(classifyFile(f('IMG_0733.heic', 3_400_000, 'image/heic'))).toBe('unsupported');
    expect(classifyFile(f('x.CR2', 30_000_000))).toBe('unsupported');
    expect(classifyFile(f('x.gif', 100, 'image/gif'))).toBe('unsupported');
  });

  it('marca acima de 20 MB', () => {
    expect(classifyFile(f('IMG_1021.jpg', MAX_PHOTO_BYTES + 1, 'image/jpeg'))).toBe('too_large');
  });

  it('deduz o tipo pela extensão quando o navegador não informa', () => {
    expect(effectiveMimeType(f('A.JPEG', 1))).toBe('image/jpeg');
    expect(classifyFile(f('A.JPEG', 1))).toBe('valid');
  });

  it('filtra pastas: só imagens, sem arquivos de sistema', () => {
    expect(isImageFile(f('notas.txt', 10, 'text/plain'))).toBe(false);
    expect(isImageFile(f('.DS_Store', 10))).toBe(false);
    expect(isImageFile(f('Thumbs.db', 10))).toBe(false);
    expect(isImageFile(f('IMG_1.heic', 10))).toBe(true);
    expect(isImageFile(f('IMG_2.jpg', 10, 'image/jpeg'))).toBe(true);
  });

  it('resume a classificação de um lote', () => {
    const s = classifyFiles([
      f('1.jpg', 10, 'image/jpeg'),
      f('2.heic', 10, 'image/heic'),
      f('3.jpg', MAX_PHOTO_BYTES * 2, 'image/jpeg'),
      f('4.png', 10, 'image/png'),
    ]);
    expect(s.valid.map((x) => x.name)).toEqual(['1.jpg', '4.png']);
    expect(s.unsupported.map((x) => x.name)).toEqual(['2.heic']);
    expect(s.tooLarge.map((x) => x.name)).toEqual(['3.jpg']);
  });

  it('a chave de "já enviada" usa nome e tamanho', () => {
    expect(fileKey(f('IMG_1.jpg', 123))).toBe('IMG_1.jpg|123');
  });
});

import { resolvePhotoDate, summarizeExifDates } from '@/lib/upload/eventDate';

describe('data enviada por foto', () => {
  const today = '2026-10-17';
  it('usa o EXIF quando existe e o formulário como alternativa', () => {
    expect(resolvePhotoDate('2026-09-14', '2026-09-13', false, today)).toBe('2026-09-14');
    expect(resolvePhotoDate(null, '2026-09-13', false, today)).toBe('2026-09-13');
    expect(resolvePhotoDate(undefined, '2026-09-13', false, today)).toBe('2026-09-13');
  });
  it('ignora EXIF no futuro e respeita "usar a data do formulário para todas"', () => {
    expect(resolvePhotoDate('2030-01-01', '2026-09-13', false, today)).toBe('2026-09-13');
    expect(resolvePhotoDate('2026-09-14', '2026-09-13', true, today)).toBe('2026-09-13');
  });
  it('resume as datas lidas', () => {
    const s = summarizeExifDates(['2026-09-14', '2026-09-14', null, '2026-09-15', undefined]);
    expect(s).toMatchObject({ total: 5, checked: 4, withDate: 3, mostCommon: '2026-09-14' });
    expect(s.byDate).toEqual([{ date: '2026-09-14', count: 2 }, { date: '2026-09-15', count: 1 }]);
  });
});

describe('MIME normalizado', () => {
  it('trata image/jpg como JPEG', () => {
    expect(effectiveMimeType({ name: 'a.jpg', size: 1, type: 'image/jpg' })).toBe('image/jpeg');
    expect(classifyFile({ name: 'a.jpg', size: 1, type: 'image/jpg' })).toBe('valid');
  });
});
