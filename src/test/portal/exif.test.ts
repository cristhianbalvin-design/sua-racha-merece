import { describe, expect, it } from 'vitest';
import { parseExifDateString, readExifDate, readExifDateFromBuffer } from '@/lib/upload/exif';

type Tag = { tag: number; type: number; ascii?: string; long?: number };

/** Monta um JPEG mínimo com um bloco APP1/EXIF. */
const buildJpeg = (opts: { little: boolean; ifd0?: Tag[]; exif?: Tag[]; prefixApp0?: boolean }): ArrayBuffer => {
  const { little } = opts;
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff]);
  const u32 = (v: number) =>
    little
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
      : [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];

  const ifd0Tags = [...(opts.ifd0 ?? [])];
  const exifTags = opts.exif ?? [];
  if (exifTags.length) ifd0Tags.push({ tag: 0x8769, type: 4, long: 0 });

  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0Offset = 8;
  const exifOffset = ifd0Offset + ifdSize(ifd0Tags.length);
  let dataOffset = exifOffset + (exifTags.length ? ifdSize(exifTags.length) : 0);
  const data: number[] = [];

  const writeIfd = (tags: Tag[]) => {
    const out: number[] = [...u16(tags.length)];
    for (const t of tags) {
      out.push(...u16(t.tag), ...u16(t.type));
      if (t.ascii !== undefined) {
        const bytes = [...t.ascii].map((c) => c.charCodeAt(0)).concat([0]);
        out.push(...u32(bytes.length));
        if (bytes.length <= 4) {
          out.push(...bytes, ...new Array(4 - bytes.length).fill(0));
        } else {
          out.push(...u32(dataOffset));
          data.push(...bytes);
          dataOffset += bytes.length;
        }
      } else {
        out.push(...u32(1), ...u32(t.tag === 0x8769 ? exifOffset : t.long ?? 0));
      }
    }
    out.push(...u32(0));
    return out;
  };

  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0Offset));
  tiff.push(...writeIfd(ifd0Tags));
  if (exifTags.length) tiff.push(...writeIfd(exifTags));
  tiff.push(...data);

  const app1Payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1Payload.length + 2;
  const bytes: number[] = [0xff, 0xd8];
  if (opts.prefixApp0) bytes.push(0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46);
  bytes.push(0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...app1Payload);
  bytes.push(0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9);
  return new Uint8Array(bytes).buffer;
};

describe('parseExifDateString', () => {
  it('converte o formato EXIF em YYYY-MM-DD', () => {
    expect(parseExifDateString('2026:09:14 08:15:30')).toBe('2026-09-14');
  });
  it('rejeita datas zeradas ou impossíveis', () => {
    expect(parseExifDateString('0000:00:00 00:00:00')).toBeNull();
    expect(parseExifDateString('2026:02:30 10:00:00')).toBeNull();
    expect(parseExifDateString('')).toBeNull();
    expect(parseExifDateString(null)).toBeNull();
  });
});

describe('readExifDateFromBuffer', () => {
  it('lê DateTimeOriginal em little-endian (II)', () => {
    const buf = buildJpeg({ little: true, exif: [{ tag: 0x9003, type: 2, ascii: '2026:09:14 08:15:30' }] });
    expect(readExifDateFromBuffer(buf)).toBe('2026-09-14');
  });

  it('lê DateTimeOriginal em big-endian (MM) depois de um APP0', () => {
    const buf = buildJpeg({ little: false, prefixApp0: true, exif: [{ tag: 0x9003, type: 2, ascii: '2025:12:31 23:59:59' }] });
    expect(readExifDateFromBuffer(buf)).toBe('2025-12-31');
  });

  it('prefere DateTimeOriginal ao DateTime do IFD0', () => {
    const buf = buildJpeg({
      little: true,
      ifd0: [{ tag: 0x0132, type: 2, ascii: '2026:10:01 10:00:00' }],
      exif: [{ tag: 0x9003, type: 2, ascii: '2026:09:14 08:15:30' }],
    });
    expect(readExifDateFromBuffer(buf)).toBe('2026-09-14');
  });

  it('usa DateTime do IFD0 quando não há bloco EXIF', () => {
    const buf = buildJpeg({ little: true, ifd0: [{ tag: 0x0132, type: 2, ascii: '2026:10:01 10:00:00' }] });
    expect(readExifDateFromBuffer(buf)).toBe('2026-10-01');
  });

  it('devolve null para JPEG sem data, PNG e lixo', () => {
    expect(readExifDateFromBuffer(buildJpeg({ little: true }))).toBeNull();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(readExifDateFromBuffer(png)).toBeNull();
    expect(readExifDateFromBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]).buffer)).toBeNull();
    expect(readExifDateFromBuffer(new ArrayBuffer(0))).toBeNull();
  });

  it('readExifDate ignora arquivos que não são JPEG', async () => {
    const buf = buildJpeg({ little: true, exif: [{ tag: 0x9003, type: 2, ascii: '2026:09:14 08:15:30' }] });
    const png = new File([buf], 'foto.png', { type: 'image/png' });
    expect(await readExifDate(png)).toBeNull();
  });
});
