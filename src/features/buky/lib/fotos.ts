import { supabase } from "@/lib/supabase";
import { apiRegisterDownload, type DownloadPermission } from "@/lib/libraryApi";

/**
 * Fotos del atleta (mockup 3): mismo motor de 3BUK (reconocimiento facial `match-face` y
 * descarga con `check_and_register_download`), presentado como "un evento + una selfie".
 */

export interface FilterRow {
  region_id?: string | null;
  region_name?: string | null;
  sport_id?: string | null;
  sport_name?: string | null;
  event_date?: string | null;
  city_name?: string | null;
}

export interface FotoEvent {
  key: string;
  regionId: string;
  sportId: string;
  date: string; // yyyy-mm-dd
  city: string | null;
  title: string; // "Corrida de rua · Niterói"
  subtitle: string; // "19/10/2026 · Río de Janeiro"
}

export interface FotoMatch {
  id: string;
  image_url: string;
  similarity: number;
  event_label?: string;
  photographer_name?: string | null;
}

const fmtDay = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

/** Un evento = deporte + región + fecha + ciudad. Los más recientes primero. */
export function buildEvents(rows: FilterRow[]): FotoEvent[] {
  const out = new Map<string, FotoEvent>();
  for (const r of rows) {
    if (!r.region_id || !r.sport_id || !r.event_date) continue;
    const city = r.city_name?.trim() || null;
    const key = [r.region_id, r.sport_id, r.event_date, city ?? ""].join("|");
    if (out.has(key)) continue;
    out.set(key, {
      key,
      regionId: r.region_id,
      sportId: r.sport_id,
      date: r.event_date,
      city,
      title: [r.sport_name, city].filter(Boolean).join(" · "),
      subtitle: [fmtDay(r.event_date), r.region_name].filter(Boolean).join(" · "),
    });
  }
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export async function listFotoEvents(): Promise<FotoEvent[]> {
  const { data, error } = await supabase.rpc("get_search_filters");
  if (error) throw error;
  return buildEvents((data ?? []) as FilterRow[]);
}

export async function searchMyPhotos(selfie: File, ev: FotoEvent): Promise<FotoMatch[]> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("Faça login para buscar suas fotos.");
  const form = new FormData();
  form.append("file", selfie);
  form.append("filter_region_id", ev.regionId);
  form.append("filter_sport_id", ev.sportId);
  form.append("filter_event_date", ev.date);
  if (ev.city) form.append("filter_city", ev.city);
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-face`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || "Erro ao buscar fotos.");
  return (json.matches ?? []) as FotoMatch[];
}

/**
 * ok: descargada · needsParticipation: hay que participar del Kit 3buk · purchase: no quedan fotos
 * gratis y la foto cuesta R$10 del saldo (hay que confirmar) · message: otro bloqueo.
 */
export interface DownloadResult {
  ok: boolean;
  needsParticipation?: boolean;
  purchase?: { priceCents: number; balanceCents: number; insufficient: boolean };
  message?: string;
}

export function blockedMessage(p: DownloadPermission): string | null {
  switch (p.reason) {
    case "photo_not_available":
      return "Esta foto não está mais disponível.";
    case "not_authenticated":
      return "Faça login para baixar a foto.";
    default:
      return null;
  }
}

/** Registra y baja la foto. Sin fotos gratis devuelve `purchase`; con confirm = true paga del saldo. */
export async function downloadPhoto(m: FotoMatch, confirm = false): Promise<DownloadResult> {
  const perm = await apiRegisterDownload(m.id, confirm);
  if (!perm.allowed) {
    if (perm.reason === "purchase_required" || perm.reason === "insufficient_balance") {
      return {
        ok: false,
        purchase: {
          priceCents: perm.priceCents || perm.status?.priceCents || 1000,
          balanceCents: perm.status?.balanceCents ?? 0,
          insufficient: perm.reason === "insufficient_balance" || (perm.status?.balanceCents ?? 0) < (perm.priceCents || 1000),
        },
      };
    }
    const msg = blockedMessage(perm);
    return msg ? { ok: false, message: msg } : { ok: false, needsParticipation: true };
  }
  const res = await fetch(m.image_url);
  if (!res.ok) throw new Error("download");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `3buk_${m.id}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
