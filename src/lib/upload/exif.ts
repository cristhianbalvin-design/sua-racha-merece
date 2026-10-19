/**
 * Leitor mínimo de EXIF para JPEG, sem dependências.
 *
 * Só extrai a data de captura (DateTimeOriginal, com CreateDate e DateTime como
 * alternativas) e devolve no formato YYYY-MM-DD. Lê apenas o início do arquivo:
 * o bloco APP1/EXIF fica sempre antes dos dados da imagem.
 */

const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_CREATE_DATE = 0x9004;
const TYPE_ASCII = 2;

/** Bytes lidos do começo do arquivo para procurar o EXIF. */
export const EXIF_SCAN_BYTES = 256 * 1024;

const isPlausibleDate = (y: number, m: number, d: number): boolean => {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Converte "YYYY:MM:DD HH:MM:SS" (formato EXIF) em "YYYY-MM-DD". */
export const parseExifDateString = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const m = /^\s*(\d{4})[:-](\d{2})[:-](\d{2})/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isPlausibleDate(y, mo, d)) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

interface IfdContext {
  view: DataView;
  tiffStart: number;
  little: boolean;
}

const readAscii = (ctx: IfdContext, entryOffset: number): string | null => {
  const { view, tiffStart, little } = ctx;
  const type = view.getUint16(entryOffset + 2, little);
  if (type !== TYPE_ASCII) return null;
  const count = view.getUint32(entryOffset + 4, little);
  if (count === 0 || count > 64) return null;
  const valueOffset = count <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, little);
  if (valueOffset < 0 || valueOffset + count > view.byteLength) return null;
  let out = '';
  for (let i = 0; i < count; i++) {
    const c = view.getUint8(valueOffset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
};

/** Lê as entradas de um IFD e devolve os valores das tags pedidas. */
const readIfd = (ctx: IfdContext, ifdOffset: number, wanted: number[]): Map<number, number> => {
  const { view, little } = ctx;
  const found = new Map<number, number>();
  if (ifdOffset < 0 || ifdOffset + 2 > view.byteLength) return found;
  const entries = view.getUint16(ifdOffset, little);
  for (let i = 0; i < entries; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    if (wanted.includes(tag)) found.set(tag, entry);
  }
  return found;
};

const readTiffDate = (view: DataView, tiffStart: number): string | null => {
  if (tiffStart + 8 > view.byteLength) return null;
  const order = view.getUint16(tiffStart, false);
  let little: boolean;
  if (order === 0x4949) little = true; // "II"
  else if (order === 0x4d4d) little = false; // "MM"
  else return null;
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return null;
  const ctx: IfdContext = { view, tiffStart, little };

  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  const ifd0Tags = readIfd(ctx, ifd0, [TAG_EXIF_IFD_POINTER, TAG_DATETIME]);

  const exifPtrEntry = ifd0Tags.get(TAG_EXIF_IFD_POINTER);
  if (exifPtrEntry !== undefined) {
    const exifIfd = tiffStart + view.getUint32(exifPtrEntry + 8, little);
    const exifTags = readIfd(ctx, exifIfd, [TAG_DATETIME_ORIGINAL, TAG_CREATE_DATE]);
    for (const tag of [TAG_DATETIME_ORIGINAL, TAG_CREATE_DATE]) {
      const entry = exifTags.get(tag);
      if (entry !== undefined) {
        const date = parseExifDateString(readAscii(ctx, entry));
        if (date) return date;
      }
    }
  }

  const dtEntry = ifd0Tags.get(TAG_DATETIME);
  if (dtEntry !== undefined) return parseExifDateString(readAscii(ctx, dtEntry));
  return null;
};

/**
 * Procura o segmento APP1 "Exif" num JPEG e devolve a data de captura (YYYY-MM-DD)
 * ou null quando não há EXIF, o arquivo não é JPEG ou a data é inválida.
 */
export const readExifDateFromBuffer = (buffer: ArrayBuffer): string | null => {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);
      // Marcadores sem tamanho (RSTn, TEM) e preenchimento 0xFF.
      if (marker === 0xff) { offset += 1; continue; }
      if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
      // SOS ou EOI: começaram os dados da imagem, não há mais metadados.
      if (marker === 0xda || marker === 0xd9) return null;
      const size = view.getUint16(offset + 2, false);
      if (size < 2) return null;
      if (marker === 0xe1 && offset + 10 <= view.byteLength) {
        const isExif =
          view.getUint32(offset + 4, false) === 0x45786966 && // "Exif"
          view.getUint16(offset + 8, false) === 0x0000;
        if (isExif) {
          const date = readTiffDate(view, offset + 10);
          if (date) return date;
        }
      }
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
};

const isJpeg = (file: File): boolean =>
  file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);

/** Lê a data EXIF de um arquivo. PNG/WEBP e fotos sem EXIF devolvem null. */
export const readExifDate = async (file: File): Promise<string | null> => {
  if (!isJpeg(file)) return null;
  try {
    const buffer = await file.slice(0, EXIF_SCAN_BYTES).arrayBuffer();
    return readExifDateFromBuffer(buffer);
  } catch {
    return null;
  }
};
