/**
 * Capa de datos de Buky: todas las llamadas a Supabase de la app del atleta.
 * Las reglas viven en el servidor (SQL 15–17 y la Edge Function buky-close-session);
 * aquí solo se leen datos y se llaman funciones.
 */
import { supabase } from "@/lib/supabase";
import type { BukyPoint } from "@/features/buky/engine";
import { normalizeName } from "./validation";

// ------------------------------------------------------------------ tipos

export interface BukyProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  city_code: number | null;
  state_code: number | null;
  instagram: string | null;
  neighborhood: string | null;
  campaigns_participated: number | null;
}

export interface City {
  code: number;
  name: string;
  state_code: number;
  uf: string;
  lat: number;
  lon: number;
}

export interface BrState {
  code: number;
  uf: string;
  name: string;
}

export interface RoutePoint extends BukyPoint {
  seq: number;
}

export interface BukyRoute {
  id: string;
  name: string;
  city_code: number;
  kind: "official" | "athlete";
  owner_id: string | null;
  active: boolean;
  length_m: number | null;
  /** Trazo dibujado (rutas del atleta, paso 21); null en rutas por puntos. */
  path?: { lat: number; lon: number }[] | null;
  points: RoutePoint[];
}

export interface LastSession {
  id: string;
  status: "valid" | "invalid";
  ended_at: string | null;
  bukys: number;
  passes: number;
  route: string;
  city: string;
  invalid_reason: string | null;
}

export interface OpenPeriod {
  id: string;
  name: string;
  ends_at: string;
  draw_at: string;
  my_bukys: number;
  my_tickets: string[];
}

export interface Win {
  period: string;
  coupon: string;
  benefit: string | null;
  sponsor: string;
  kind: "physical" | "digital";
  ticket: string | null;
  redeem_code: string | null;
  redeem_instructions: string | null;
  valid_until: string | null;
  delivery_status: string;
  drawn_at: string;
}

export interface BukySummary {
  balance: number;
  found_total: number;
  gift_total: number;
  sent_total: number;
  passes_valid_total: number;
  sessions_total: number;
  last_session: LastSession | null;
  open_period: OpenPeriod | null;
  wins: Win[];
}

export interface ZoneCoupon {
  coupon_id: string;
  period_id: string;
  period_name: string;
  period_status: "open" | "scheduled";
  ends_at: string;
  title: string;
  description: string | null;
  benefit: string | null;
  image_url: string | null;
  kind: "physical" | "digital";
  scope: "city" | "state" | "national";
  winners_count: number;
  valid_until: string | null;
  sponsor_name: string;
  sponsor_logo_url: string | null;
  sponsor_instagram: string | null;
}

export interface SessionHistoryItem {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  bukys_awarded: number;
  passes_valid: number;
  distance_m: number | null;
  invalid_reason: string | null;
  route_name: string;
  city_name: string | null;
}

export interface CloseResult {
  status: "valid" | "invalid";
  reason: string | null;
  bukys: number;
  balance: number;
  passes_valid?: number;
  passes_rejected?: number;
  duplicate?: boolean;
  passes?: { point_id: string; at: string; speed_kmh: number | null; valid: boolean; awarded?: boolean; reject_reason: string | null }[];
  stats?: { distanceM: number; durationS: number; maxSpeedKmh: number; avgSpeedKmh: number; bikeWarnings?: number };
  /** Por qué terminó: el atleta, el límite de tiempo o la bicicleta (paso 24). */
  stop_reason?: StopReason | null;
}

export type StopReason = "user" | "time_limit" | "bike";

import { DEFAULT_TRAINING_RULES, type TrainingRules } from "../training/rules";
export { DEFAULT_TRAINING_RULES, type TrainingRules };

export interface MyStatus {
  found_total: number;
  gift_total: number;
  sponsorship_min: number;
  free_photo_min: number;
  tester: boolean;
  bike_stops_today: number;
  blocked_today: boolean;
  rules: TrainingRules;
}

export async function getMyStatus(): Promise<MyStatus> {
  const { data, error } = await supabase.rpc("buky_my_status");
  if (error) fail(error);
  const s = data as MyStatus;
  return { ...s, rules: { ...DEFAULT_TRAINING_RULES, ...(s?.rules ?? {}) } };
}

/** Error con el código que devuelve el SQL (p. ej. "no_open_period"). */
export class BukyApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

// Filas tal como las devuelve PostgREST (con las relaciones embebidas)
type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
interface CityRow { code: number; name: string; state_code: number; lat: number; lon: number; br_states: One<{ uf: string }> }
interface PointRow { id: string; seq: number; label: string | null; lat: number; lon: number; radius_m: number }
interface RouteRow { id: string; name: string; city_code: number; kind: "official" | "athlete"; owner_id: string | null; active: boolean; length_m: number | null; path: { lat: number; lon: number }[] | null; buky_points: PointRow[] | null }
interface SessionRow {
  id: string; status: string; started_at: string; ended_at: string | null; bukys_awarded: number; passes_valid: number;
  distance_m: number | null; invalid_reason: string | null;
  buky_routes: One<{ name: string; br_cities: One<{ name: string }> }>;
}
const toCity = (c: CityRow): City => ({ code: c.code, name: c.name, state_code: c.state_code, lat: c.lat, lon: c.lon, uf: one(c.br_states)?.uf ?? "" });

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "unknown_error";
  throw new BukyApiError(msg.split(":")[0].trim(), msg);
}

// ------------------------------------------------------------------ perfil y ciudades

const PROFILE_COLUMNS =
  "id, name, email, avatar_url, city, country, city_code, state_code, instagram, neighborhood, campaigns_participated";

export async function getProfile(userId: string): Promise<BukyProfile> {
  const { data, error } = await supabase.from("users").select(PROFILE_COLUMNS).eq("id", userId).single();
  if (error) fail(error);
  return data as BukyProfile;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<BukyProfile, "name" | "city_code" | "instagram" | "neighborhood" | "avatar_url">>,
): Promise<BukyProfile> {
  const { data, error } = await supabase.from("users").update(patch).eq("id", userId).select(PROFILE_COLUMNS).single();
  if (error) fail(error);
  return data as BukyProfile;
}

export { normalizeName };

export async function searchCities(query: string, stateCode?: number | null, limit = 12): Promise<City[]> {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  let req = supabase
    .from("br_cities")
    .select("code, name, state_code, lat, lon, br_states!inner(uf)")
    .like("name_norm", `${q}%`)
    .order("is_capital", { ascending: false })
    .order("name")
    .limit(limit);
  if (stateCode) req = req.eq("state_code", stateCode);
  const { data, error } = await req;
  if (error) fail(error);
  return ((data ?? []) as unknown as CityRow[]).map(toCity);
}

/** Catálogo completo de ciudades (5.571) para el buscador del dispositivo. Se pide una vez. */
export async function listAllCities(): Promise<import("./citySearch").CatalogCity[]> {
  const page = 1000; // límite de filas por respuesta de la API
  const out: import("./citySearch").CatalogCity[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("br_cities")
      .select("code, name, state_code, lat, lon, is_capital, br_states!inner(uf)")
      .order("code")
      .range(from, from + page - 1);
    if (error) fail(error);
    const rows = (data ?? []) as unknown as (CityRow & { is_capital: boolean })[];
    for (const c of rows) out.push({ ...toCity(c), is_capital: c.is_capital, norm: normalizeName(c.name) });
    if (rows.length < page) break;
  }
  return out;
}

export async function getCity(code: number): Promise<City | null> {
  const { data, error } = await supabase
    .from("br_cities")
    .select("code, name, state_code, lat, lon, br_states!inner(uf)")
    .eq("code", code)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return toCity(data as unknown as CityRow);
}

export async function listStates(): Promise<BrState[]> {
  const { data, error } = await supabase.from("br_states").select("code, uf, name").order("uf");
  if (error) fail(error);
  return (data ?? []) as BrState[];
}

// ------------------------------------------------------------------ rutas

export async function listRoutes(cityCode: number): Promise<BukyRoute[]> {
  const { data, error } = await supabase
    .from("buky_routes")
    .select("id, name, city_code, kind, owner_id, active, length_m, path, buky_points(id, seq, label, lat, lon, radius_m)")
    .eq("city_code", cityCode)
    .eq("active", true)
    .order("kind")
    .order("name");
  if (error) fail(error);
  return ((data ?? []) as unknown as RouteRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    city_code: r.city_code,
    kind: r.kind,
    owner_id: r.owner_id,
    active: r.active,
    length_m: r.length_m,
    path: r.path ?? null,
    points: (r.buky_points ?? [])
      .sort((a, b) => a.seq - b.seq)
      .map((p) => ({ id: p.id, seq: p.seq, label: p.label ?? `BUKY_${String(p.seq + 1).padStart(2, "0")}`, lat: p.lat, lon: p.lon, radiusM: p.radius_m })),
  }));
}

export async function createAthleteRoute(
  name: string,
  cityCode: number,
  points: { lat: number; lon: number; label?: string }[],
): Promise<string> {
  const { data, error } = await supabase.rpc("buky_create_athlete_route", {
    p_name: name,
    p_city_code: cityCode,
    p_points: points,
  });
  if (error) fail(error);
  return data as string;
}

export async function setMyRouteActive(routeId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("buky_set_my_route_active", { p_route_id: routeId, p_active: active });
  if (error) fail(error);
}

export async function getSettings(keys: string[]): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("app_settings").select("key, value").in("key", keys);
  if (error) fail(error);
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    const v = Number(row.value);
    if (Number.isFinite(v)) out[row.key] = v;
  }
  return out;
}

// ------------------------------------------------------------------ entrenamiento

export async function startSession(sessionId: string, routeId: string, client: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc("buky_start_session", {
    p_session_id: sessionId,
    p_route_id: routeId,
    p_client: client,
  });
  if (error) fail(error);
}

export async function heartbeat(sessionId: string, livePasses: number, lastPointId: string | null): Promise<void> {
  const { error } = await supabase.rpc("buky_heartbeat", {
    p_session_id: sessionId,
    p_live_passes: livePasses,
    p_last_point_id: lastPointId,
  });
  if (error) fail(error);
}

/** Lectura compacta: [seq, fixTime, receivedAt, lat, lon, accuracy, simulated]. */
export type CompactReading = [number, number, number, number, number, number, number];

export async function closeSession(
  sessionId: string,
  readings: CompactReading[],
  info: { stop_reason?: StopReason; bike_warnings?: number } = {},
): Promise<CloseResult> {
  const { data, error } = await supabase.functions.invoke("buky-close-session", {
    body: { session_id: sessionId, readings, ...info },
  });
  if (error) {
    // FunctionsHttpError trae la respuesta: se extrae el código de error del cuerpo
    let code = "close_failed";
    try {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (body?.error) code = body.error;
    } catch {
      /* sin cuerpo */
    }
    throw new BukyApiError(code, error.message);
  }
  return data as CloseResult;
}

export async function listMySessions(userId: string, limit = 20): Promise<SessionHistoryItem[]> {
  const { data, error } = await supabase
    .from("buky_sessions")
    .select("id, status, started_at, ended_at, bukys_awarded, passes_valid, distance_m, invalid_reason, buky_routes(name, br_cities(name))")
    .eq("user_id", userId)
    .in("status", ["valid", "invalid"])
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return ((data ?? []) as unknown as SessionRow[]).map((s) => ({
    id: s.id,
    status: s.status,
    started_at: s.started_at,
    ended_at: s.ended_at,
    bukys_awarded: s.bukys_awarded,
    passes_valid: s.passes_valid,
    distance_m: s.distance_m,
    invalid_reason: s.invalid_reason,
    route_name: one(s.buky_routes)?.name ?? "",
    city_name: one(one(s.buky_routes)?.br_cities ?? null)?.name ?? null,
  }));
}

// ------------------------------------------------------------------ bolsa y sorteos

export async function getSummary(): Promise<BukySummary> {
  const { data, error } = await supabase.rpc("buky_my_summary");
  if (error) fail(error);
  return data as BukySummary;
}

export async function getZoneCoupons(cityCode?: number | null): Promise<ZoneCoupon[]> {
  const { data, error } = await supabase.rpc("buky_zone_coupons", cityCode ? { p_city_code: cityCode } : {});
  if (error) fail(error);
  return (data ?? []) as ZoneCoupon[];
}

/** Envía Bukys a un sorteo elegido (paso 25): desde donde está el atleta y con el reglamento aceptado. */
export async function sendToRaffle(input: {
  periodId: string;
  amount: number;
  lat: number | null;
  lon: number | null;
  rulesVersion: number;
  idempotencyKey: string;
}): Promise<{ ticket: string; amount: number; period_name?: string; ends_at?: string; balance?: number; duplicate: boolean }> {
  const { data, error } = await supabase.rpc("buky_send_to_raffle_v2", {
    p_period_id: input.periodId,
    p_amount: input.amount,
    p_lat: input.lat,
    p_lon: input.lon,
    p_rules_version: input.rulesVersion,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) fail(error);
  return data;
}

/** Testador de rutas o admin (paso 19): puede crear rutas propias fuera de su ciudad. */
export async function isRouteTester(): Promise<boolean> {
  const { data, error } = await supabase.rpc("buky_is_route_tester");
  if (error) return false; // si el paso 19 aún no está aplicado, se comporta como atleta común
  return data === true;
}

// ------------------------------------------------------------------ pantalla Sorteios (paso 20)

export interface Prize {
  id: string;
  title: string;
  description: string | null;
  benefit: string | null;
  image_url: string | null;
  kind: "physical" | "digital";
  scope: "raffle" | "city" | "state" | "national";
  /** % de descuento (paso 25): los premios se sortean de mayor a menor %. */
  discount_pct?: number | null;
  city: string | null;
  uf: string | null;
  winners_count: number;
  valid_until: string | null;
  redeem_instructions: string | null;
  sponsor: { name: string; logo_url: string | null; instagram: string | null; website: string | null };
}

export interface RafflePeriod {
  id: string;
  name: string;
  status: "scheduled" | "open" | "closed" | "drawn" | "cancelled" | "merged";
  cadence?: "weekly" | "biweekly" | "monthly" | "none";
  starts_at: string;
  ends_at: string;
  draw_at: string;
  drawn_at: string | null;
  /** Ciudades del sorteo; national = todo Brasil. */
  national?: boolean;
  cities?: string[];
  /** Vale para la ciudad donde está el atleta ahora (puede enviar). */
  available_here?: boolean;
  participants?: number;
  min_participants?: number;
  redeem_days?: number;
  rules?: { version: number; text: string; provisional: boolean; accepted: boolean };
  my_bukys: number;
  my_tickets: string[];
  prizes: Prize[];
}

/** Resultado anónimo de un premio: cuántos ganaron y en qué ciudades, nunca quiénes. */
export interface PrizeResult {
  prize_id: string;
  title: string;
  benefit: string | null;
  image_url: string | null;
  discount_pct?: number | null;
  sponsor: string;
  winners: number;
  cities: string[];
  mine: boolean;
}

export interface PastRaffle extends RafflePeriod {
  my_wins: number;
  participants: number;
  results: PrizeResult[];
}

export interface MyPrize extends Prize {
  result_id: string;
  period: string;
  ticket: string | null;
  redeem_code: string | null;
  delivery_status: "pending" | "notified" | "delivered" | "unclaimed" | "standby" | "expired";
  /** winner = ganador; substitute = suplente (recibe el premio si el ganador no canjea a tiempo). */
  role?: "winner" | "substitute";
  redeem_deadline?: string | null;
  drawn_at: string;
}

export interface MyRaffles {
  /** Ciudad donde está el atleta ahora (null sin ubicación o fuera de Brasil). */
  here: { code: number; name: string } | null;
  /** Sorteos abiertos (y cerrados esperando el sorteo), primero los que valen donde está. */
  open: RafflePeriod[];
  upcoming: RafflePeriod[];
  past: PastRaffle[];
  my_prizes: MyPrize[];
}

export async function getMyRaffles(pos?: { lat: number; lon: number } | null): Promise<MyRaffles> {
  const { data, error } = await supabase.rpc("buky_my_raffles", { p_lat: pos?.lat ?? null, p_lon: pos?.lon ?? null });
  if (error) fail(error);
  return (data ?? { here: null, open: [], upcoming: [], past: [], my_prizes: [] }) as MyRaffles;
}

/** Premio por canjear: ganador (o suplente activado) con el plazo corriendo. */
export const isToRedeem = (p: Pick<MyPrize, "delivery_status">) => p.delivery_status === "pending" || p.delivery_status === "notified";

// ------------------------------------------------------------------ historial de un entrenamiento

export interface SessionPass {
  point_id: string;
  passed_at: string;
  speed_kmh: number | null;
  valid: boolean;
  awarded: boolean;
  reject_reason: string | null;
}

export interface SessionDetail {
  id: string;
  status: "running" | "valid" | "invalid" | "abandoned";
  started_at: string;
  ended_at: string | null;
  distance_m: number | null;
  duration_s: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  passes_valid: number;
  passes_rejected: number;
  bukys_awarded: number;
  invalid_reason: string | null;
  track_path: string | null;
  route: { id: string; name: string; kind: "official" | "athlete"; path: { lat: number; lon: number }[] | null; city: string | null; points: RoutePoint[] } | null;
  passes: SessionPass[];
}

export async function getSessionDetail(id: string): Promise<SessionDetail> {
  const { data, error } = await supabase
    .from("buky_sessions")
    .select(
      "id, status, started_at, ended_at, distance_m, duration_s, avg_speed_kmh, max_speed_kmh, passes_valid, passes_rejected, bukys_awarded, invalid_reason, track_path, " +
        "buky_routes(id, name, kind, path, br_cities(name), buky_points(id, seq, label, lat, lon, radius_m)), " +
        "buky_passes(point_id, passed_at, speed_kmh, valid, awarded, reject_reason)",
    )
    .eq("id", id)
    .single();
  if (error) fail(error);
  type Row = Omit<SessionDetail, "route" | "passes"> & {
    buky_routes: One<RouteRow & { br_cities: One<{ name: string }> }>;
    buky_passes: SessionPass[] | null;
  };
  const r = data as unknown as Row;
  const route = one(r.buky_routes);
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    ...r,
    avg_speed_kmh: num(r.avg_speed_kmh),
    max_speed_kmh: num(r.max_speed_kmh),
    route: route
      ? {
          id: route.id,
          name: route.name,
          kind: route.kind,
          path: route.path ?? null,
          city: one(route.br_cities)?.name ?? null,
          points: (route.buky_points ?? [])
            .sort((a, b) => a.seq - b.seq)
            .map((p) => ({ id: p.id, seq: p.seq, label: p.label ?? `BUKY_${String(p.seq + 1).padStart(2, "0")}`, lat: p.lat, lon: p.lon, radiusM: p.radius_m })),
        }
      : null,
    passes: (r.buky_passes ?? []).sort((a, b) => a.passed_at.localeCompare(b.passed_at)),
  };
}

/** Lecturas GPS del recorrido guardado (archivo .json.gz privado del atleta, paso 22). */
export async function getSessionTrack(trackPath: string): Promise<{ lat: number; lon: number; t: number; acc: number }[]> {
  const { data, error } = await supabase.storage.from("buky-tracks").download(trackPath);
  if (error || !data) throw new BukyApiError("track_unavailable", error?.message ?? "track_unavailable");
  const { parseTrackFile } = await import("./trackFile");
  return parseTrackFile(data);
}
