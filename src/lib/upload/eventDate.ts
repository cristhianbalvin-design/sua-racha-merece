/**
 * Data enviada em event_date para cada foto.
 *
 * Decisão: por padrão vale a data EXIF (DateTimeOriginal) de cada foto, porque a
 * função recebe event_date por foto e um lote pode cobrir mais de um dia. Fotos sem
 * EXIF (PNG/WEBP ou sem metadados), ou com data EXIF no futuro, usam a data do
 * formulário. O fotógrafo pode marcar "usar a data do formulário para todas" quando
 * o relógio da câmera estiver errado.
 */
export const resolvePhotoDate = (
  exifDate: string | null | undefined,
  formDate: string,
  useFormDateForAll: boolean,
  today: string,
): string => {
  if (useFormDateForAll || !exifDate || exifDate > today) return formDate;
  return exifDate;
};

export interface ExifDateSummary {
  total: number;
  /** Fotos cuja leitura terminou. */
  checked: number;
  /** Fotos com data EXIF válida. */
  withDate: number;
  /** Datas encontradas, da mais frequente para a menos frequente. */
  byDate: Array<{ date: string; count: number }>;
  mostCommon: string | null;
}

/** undefined = ainda lendo; null = sem data. */
export const summarizeExifDates = (dates: Array<string | null | undefined>): ExifDateSummary => {
  const counts = new Map<string, number>();
  let checked = 0;
  for (const d of dates) {
    if (d === undefined) continue;
    checked++;
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const byDate = Array.from(counts, ([date, count]) => ({ date, count })).sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));
  const withDate = byDate.reduce((s, x) => s + x.count, 0);
  return { total: dates.length, checked, withDate, byDate, mostCommon: byDate[0]?.date ?? null };
};
