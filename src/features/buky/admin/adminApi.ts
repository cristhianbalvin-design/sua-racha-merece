/**
 * Datos del panel de administración de Buky. Escribe directo en las tablas de configuración
 * (RLS: solo admin) y usa las funciones admin_buky_* para lo que mueve Bukys o sortea.
 */
import { supabase } from "@/lib/supabase";
import { haversineMeters } from "@/features/buky/engine";
import { BukyApiError } from "../lib/api";

function fail(error: { message?: string } | null): never {
  const msg = error?.message ?? "unknown_error";
  throw new BukyApiError(msg.split(":")[0].trim(), msg);
}

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

// ------------------------------------------------------------------ rutas

export interface AdminPoint {
  id?: string;
  seq: number;
  label: string;
  lat: number;
  lon: number;
  radius_m: number;
}

export interface AdminRoute {
  id: string;
  name: string;
  city_code: number;
  city_name: string;
  uf: string;
  kind: "official" | "athlete";
  owner_name: string | null;
  active: boolean;
  length_m: number | null;
  /** Trazo dibujado (paso 21/23); null en rutas antiguas por puntos. */
  path: { lat: number; lon: number }[] | null;
  /** Distancia entre Bukys guardada en la ruta (paso 23); null = valor de Configurações. */
  buky_every_m: number | null;
  points: AdminPoint[];
  created_at: string;
}

interface RouteRow {
  id: string;
  name: string;
  city_code: number;
  kind: "official" | "athlete";
  active: boolean;
  length_m: number | null;
  path: { lat: number; lon: number }[] | null;
  buky_every_m: number | null;
  created_at: string;
  br_cities: One<{ name: string; br_states: One<{ uf: string }> }>;
  users: One<{ name: string | null; email: string | null }>;
  buky_points: AdminPoint[] | null;
}

export async function listRoutes(filter: { cityCode?: number | null; kind?: "official" | "athlete" | "all" }): Promise<AdminRoute[]> {
  let q = supabase
    .from("buky_routes")
    .select("id, name, city_code, kind, active, length_m, path, buky_every_m, created_at, br_cities(name, br_states(uf)), users:owner_id(name, email), buky_points(id, seq, label, lat, lon, radius_m)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter.cityCode) q = q.eq("city_code", filter.cityCode);
  if (filter.kind && filter.kind !== "all") q = q.eq("kind", filter.kind);
  const { data, error } = await q;
  if (error) fail(error);
  return ((data ?? []) as unknown as RouteRow[]).map((r) => {
    const city = one(r.br_cities);
    const owner = one(r.users);
    return {
      id: r.id,
      name: r.name,
      city_code: r.city_code,
      city_name: city?.name ?? "",
      uf: one(city?.br_states ?? null)?.uf ?? "",
      kind: r.kind,
      owner_name: owner ? owner.name || owner.email : null,
      active: r.active,
      length_m: r.length_m,
      path: r.path ?? null,
      buky_every_m: r.buky_every_m ?? null,
      created_at: r.created_at,
      points: [...(r.buky_points ?? [])].sort((a, b) => a.seq - b.seq).map((p) => ({ ...p, label: p.label ?? "" })),
    };
  });
}

export function routeLength(points: { lat: number; lon: number }[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += haversineMeters(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  return Math.round(m);
}

/**
 * Guarda una ruta oficial dibujada como trazo, con sus Bukys ya calculados a lo largo del camino
 * (mismo cálculo que las rutas del atleta). Los puntos existentes se reutilizan en orden (se mueven
 * a su nuevo lugar), los que faltan se crean y los que sobran se borran. Si un punto que sobra ya
 * tiene pasadas registradas, la base no deja borrarlo: en ese caso conviene crear una ruta nueva.
 */
export async function saveOfficialRoute(input: {
  id?: string;
  name: string;
  city_code: number;
  active: boolean;
  path: { lat: number; lon: number }[];
  everyM: number;
  radiusM: number;
  bukys: { lat: number; lon: number }[];
  lengthM: number;
}): Promise<string> {
  const route = {
    name: input.name,
    city_code: input.city_code,
    active: input.active,
    length_m: Math.round(input.lengthM),
    path: input.path.map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) })),
    buky_every_m: Math.round(input.everyM),
  };
  let routeId = input.id;
  if (routeId) {
    const { error } = await supabase.from("buky_routes").update({ ...route, updated_at: new Date().toISOString() }).eq("id", routeId);
    if (error) fail(error);
  } else {
    const { data, error } = await supabase.from("buky_routes").insert({ ...route, kind: "official" }).select("id").single();
    if (error) fail(error);
    routeId = (data as { id: string }).id;
  }

  const { data: current, error: cErr } = await supabase.from("buky_points").select("id, seq").eq("route_id", routeId).order("seq");
  if (cErr) fail(cErr);
  const existing = (current ?? []) as { id: string; seq: number }[];
  const surplus = existing.slice(input.bukys.length).map((p) => p.id);
  if (surplus.length) {
    const { error } = await supabase.from("buky_points").delete().in("id", surplus);
    if (error) fail(error);
  }
  // seq es único por ruta: primero los existentes pasan a valores temporales
  const reused = existing.slice(0, input.bukys.length);
  for (const p of reused) {
    const { error } = await supabase.from("buky_points").update({ seq: 1000 + p.seq }).eq("id", p.id);
    if (error) fail(error);
  }
  for (const [i, b] of input.bukys.entries()) {
    const row = { route_id: routeId, seq: i, label: `Buky ${i + 1}`, lat: +b.lat.toFixed(6), lon: +b.lon.toFixed(6), radius_m: Math.round(input.radiusM) };
    const { error } = reused[i]
      ? await supabase.from("buky_points").update(row).eq("id", reused[i].id)
      : await supabase.from("buky_points").insert(row);
    if (error) fail(error);
  }
  return routeId!;
}

export async function setRouteActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("buky_routes").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) fail(error);
}

// ------------------------------------------------------------------ patrocinadores

export interface Sponsor {
  id: string;
  name: string;
  logo_url: string | null;
  instagram: string | null;
  website: string | null;
  city_code: number | null;
  active: boolean;
}

export async function listSponsors(): Promise<Sponsor[]> {
  const { data, error } = await supabase.from("buky_sponsors").select("id, name, logo_url, instagram, website, city_code, active").order("name");
  if (error) fail(error);
  return (data ?? []) as Sponsor[];
}

export async function saveSponsor(s: Partial<Sponsor> & { name: string }): Promise<void> {
  const row = { name: s.name, logo_url: s.logo_url || null, instagram: s.instagram || null, website: s.website || null, city_code: s.city_code ?? null, active: s.active ?? true };
  const { error } = s.id ? await supabase.from("buky_sponsors").update(row).eq("id", s.id) : await supabase.from("buky_sponsors").insert(row);
  if (error) fail(error);
}

// ------------------------------------------------------------------ sorteos

export interface Period {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  cadence: "weekly" | "biweekly" | "monthly" | "none";
  status: "scheduled" | "open" | "closed" | "drawn" | "cancelled" | "merged";
  drawn_at: string | null;
  /** Paso 25: ciudades del sorteo (null = todo Brasil), mínimo, plazo de canje y reglamento. */
  city_codes: number[] | null;
  city_names: string[];
  min_participants: number;
  redeem_days: number;
  rules_text: string | null;
  rules_version: number;
  needs_review: boolean;
  review_note: string | null;
  merged_into: string | null;
  entries: number;
  bukys: number;
  athletes: number;
  /** Premios del periodo (sus cupones), para la lista. */
  prizes: { title: string; winners: number }[];
}

export async function listPeriods(): Promise<Period[]> {
  const { data, error } = await supabase
    .from("buky_raffle_periods")
    .select("id, name, starts_at, ends_at, draw_at, cadence, status, drawn_at, city_codes, min_participants, redeem_days, rules_text, rules_version, needs_review, review_note, merged_into")
    .order("starts_at", { ascending: false })
    .limit(80);
  if (error) fail(error);
  const raw = (data ?? []) as Omit<Period, "entries" | "bukys" | "athletes" | "prizes" | "city_names">[];
  const codes = [...new Set(raw.flatMap((p) => p.city_codes ?? []))];
  const names = new Map<number, string>();
  if (codes.length) {
    const { data: cs, error: csErr } = await supabase.from("br_cities").select("code, name").in("code", codes);
    if (csErr) fail(csErr);
    for (const c of (cs ?? []) as { code: number; name: string }[]) names.set(c.code, c.name);
  }
  const periods = raw.map((p) => ({ ...p, city_names: (p.city_codes ?? []).map((c) => names.get(c) ?? String(c)) }));
  const ids = periods.map((p) => p.id);
  const stats = new Map<string, { entries: number; bukys: number; athletes: Set<string> }>();
  const prizes = new Map<string, Period["prizes"]>();
  if (ids.length) {
    const { data: c, error: cErr } = await supabase
      .from("buky_coupons")
      .select("period_id, title, winners_count, draw_order, discount_pct")
      .in("period_id", ids)
      .order("discount_pct", { ascending: false, nullsFirst: false })
      .order("draw_order");
    if (cErr) fail(cErr);
    for (const row of (c ?? []) as { period_id: string; title: string; winners_count: number }[]) {
      prizes.set(row.period_id, [...(prizes.get(row.period_id) ?? []), { title: row.title, winners: row.winners_count }]);
    }
    const { data: e, error: eErr } = await supabase.from("buky_entries").select("period_id, user_id, amount").in("period_id", ids);
    if (eErr) fail(eErr);
    for (const row of (e ?? []) as { period_id: string; user_id: string; amount: number }[]) {
      const s = stats.get(row.period_id) ?? { entries: 0, bukys: 0, athletes: new Set<string>() };
      s.entries++;
      s.bukys += row.amount;
      s.athletes.add(row.user_id);
      stats.set(row.period_id, s);
    }
  }
  return periods.map((p) => {
    const s = stats.get(p.id);
    return { ...p, entries: s?.entries ?? 0, bukys: s?.bukys ?? 0, athletes: s?.athletes.size ?? 0, prizes: prizes.get(p.id) ?? [] };
  });
}

export type PeriodInput = {
  name: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  cadence: Period["cadence"];
  city_codes: number[] | null;
  min_participants: number;
  redeem_days: number;
  rules_text: string | null;
};

export async function createPeriod(p: PeriodInput): Promise<string> {
  const { data, error } = await supabase.from("buky_raffle_periods").insert(p).select("id").single();
  if (error) fail(error);
  return (data as { id: string }).id;
}

export async function updatePeriod(id: string, p: Partial<PeriodInput>): Promise<void> {
  const { error } = await supabase.from("buky_raffle_periods").update(p).eq("id", id);
  if (error) fail(error);
}

export interface Coupon {
  id: string;
  period_id: string;
  sponsor_id: string;
  sponsor_name?: string;
  title: string;
  description: string | null;
  benefit: string | null;
  image_url: string | null;
  kind: "physical" | "digital";
  scope: "raffle" | "city" | "state" | "national";
  /** % de descuento: se sortea de mayor a menor (paso 25). */
  discount_pct: number | null;
  city_code: number | null;
  city_name?: string | null;
  state_code: number | null;
  winners_count: number;
  draw_order: number;
  redeem_instructions: string | null;
  valid_until: string | null;
  repeat_next: boolean;
  codes_total?: number;
  codes_free?: number;
}

export async function listCoupons(periodId: string): Promise<Coupon[]> {
  const { data, error } = await supabase
    .from("buky_coupons")
    .select("*, buky_sponsors(name), br_cities(name), buky_coupon_codes(assigned)")
    .eq("period_id", periodId)
    .order("discount_pct", { ascending: false, nullsFirst: false })
    .order("draw_order")
    .order("created_at");
  if (error) fail(error);
  return ((data ?? []) as unknown as (Coupon & { buky_sponsors: One<{ name: string }>; br_cities: One<{ name: string }>; buky_coupon_codes: { assigned: boolean }[] })[]).map((c) => ({
    ...c,
    sponsor_name: one(c.buky_sponsors)?.name,
    city_name: one(c.br_cities)?.name ?? null,
    codes_total: c.buky_coupon_codes?.length ?? 0,
    codes_free: c.buky_coupon_codes?.filter((x) => !x.assigned).length ?? 0,
  }));
}

export async function saveCoupon(c: Omit<Coupon, "id" | "sponsor_name" | "city_name" | "codes_total" | "codes_free"> & { id?: string }): Promise<string> {
  const row = {
    period_id: c.period_id,
    sponsor_id: c.sponsor_id,
    title: c.title,
    description: c.description || null,
    benefit: c.benefit || null,
    image_url: c.image_url || null,
    kind: c.kind,
    scope: c.scope,
    city_code: c.scope === "city" ? c.city_code : null,
    state_code: c.scope === "state" ? c.state_code : c.scope === "city" ? c.state_code : null,
    winners_count: c.winners_count,
    draw_order: c.draw_order,
    discount_pct: c.discount_pct ?? null,
    redeem_instructions: c.redeem_instructions || null,
    valid_until: c.valid_until || null,
    repeat_next: c.repeat_next,
  };
  if (c.id) {
    const { error } = await supabase.from("buky_coupons").update(row).eq("id", c.id);
    if (error) fail(error);
    return c.id;
  }
  const { data, error } = await supabase.from("buky_coupons").insert(row).select("id").single();
  if (error) fail(error);
  return (data as { id: string }).id;
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await supabase.from("buky_coupons").delete().eq("id", id);
  if (error) fail(error);
}

/** Agrega códigos de canje (uno por línea); ignora repetidos. Devuelve cuántos se agregaron. */
export async function addCodes(couponId: string, text: string): Promise<number> {
  const codes = [...new Set(text.split(/\r?\n|,|;/).map((c) => c.trim()).filter(Boolean))];
  if (!codes.length) return 0;
  const { data, error } = await supabase
    .from("buky_coupon_codes")
    .upsert(codes.map((code) => ({ coupon_id: couponId, code })), { onConflict: "coupon_id,code", ignoreDuplicates: true })
    .select("id");
  if (error) fail(error);
  return data?.length ?? 0;
}

export async function drawPeriod(id: string): Promise<{ status: string; results?: number; duplicate: boolean }> {
  const { data, error } = await supabase.rpc("admin_buky_draw_period", { p_period_id: id });
  if (error) fail(error);
  return data;
}

export async function cancelPeriod(id: string, reason: string): Promise<{ changed: boolean; bukys_refunded?: number }> {
  const { data, error } = await supabase.rpc("admin_buky_cancel_period", { p_period_id: id, p_reason: reason });
  if (error) fail(error);
  return data;
}

export interface RaffleResult {
  id: string;
  coupon_id: string;
  coupon_title: string;
  sponsor_name: string;
  rank: number;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_instagram: string | null;
  user_phone: string | null;
  winning_ticket: string | null;
  redeem_code: string | null;
  total_weight: number;
  winning_number: number | null;
  candidates: { user_id: string; weight: number }[];
  candidates_sha256: string;
  drawn_at: string;
  delivery_status: "pending" | "notified" | "delivered" | "unclaimed" | "standby" | "expired";
  delivery_note: string | null;
  redeemed_at: string | null;
  redeemed_channel: string | null;
  /** Paso 25: ganador o suplente, plazo de canje y a qué sorteo se llevó si nadie canjeó. */
  role: "winner" | "substitute";
  redeem_deadline: string | null;
  activated_at: string | null;
  republished_to: string | null;
}

export async function listResults(periodId: string): Promise<RaffleResult[]> {
  const { data, error } = await supabase
    .from("buky_raffle_results")
    .select("*, buky_coupons(title, draw_order, buky_sponsors(name)), users(name, email, instagram, phone)")
    .eq("period_id", periodId)
    .order("drawn_at")
    .order("role", { ascending: false });
  if (error) fail(error);
  type Row = RaffleResult & {
    buky_coupons: One<{ title: string; draw_order: number; buky_sponsors: One<{ name: string }> }>;
    users: One<{ name: string | null; email: string | null; instagram: string | null; phone: string | null }>;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const c = one(r.buky_coupons);
    const u = one(r.users);
    return {
      ...r,
      coupon_title: c?.title ?? "",
      sponsor_name: one(c?.buky_sponsors ?? null)?.name ?? "",
      user_name: u?.name ?? null,
      user_email: u?.email ?? null,
      user_instagram: u?.instagram ?? null,
      user_phone: u?.phone ?? null,
    };
  });
}

export async function setDelivery(id: string, status: RaffleResult["delivery_status"], note: string | null): Promise<void> {
  const { error } = await supabase
    .from("buky_raffle_results")
    .update({ delivery_status: status, delivery_note: note, delivered_at: status === "delivered" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) fail(error);
}

// ------------------------------------------------------------------ entrenamientos y atletas

/** Une un sorteo sin el mínimo de participantes a otro (se sortean juntos). */
export async function mergePeriod(sourceId: string, targetId: string): Promise<{ merged: boolean; participants: number }> {
  const { data, error } = await supabase.rpc("admin_buky_merge_period", { p_source: sourceId, p_target: targetId });
  if (error) fail(error);
  return data;
}

/** Lleva un premio que nadie canjeó (ganador y suplente vencidos) a otro sorteo programado. */
export async function republishPrize(resultId: string, targetId: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_buky_republish_prize", { p_result_id: resultId, p_target: targetId });
  if (error) fail(error);
  return data as string;
}

export interface AdminSession {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  distance_m: number | null;
  duration_s: number | null;
  max_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  passes_valid: number;
  passes_rejected: number;
  bukys_awarded: number;
  invalid_reason: string | null;
  route_name: string;
  route_kind: string;
  city_name: string | null;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
}

export async function listSessions(filter: { status?: string; since?: string }): Promise<AdminSession[]> {
  let q = supabase
    .from("buky_sessions")
    .select("id, status, started_at, ended_at, distance_m, duration_s, max_speed_kmh, avg_speed_kmh, passes_valid, passes_rejected, bukys_awarded, invalid_reason, user_id, buky_routes(name, kind, br_cities(name)), users(name, email)")
    .order("started_at", { ascending: false })
    .limit(200);
  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter.since) q = q.gte("started_at", filter.since);
  const { data, error } = await q;
  if (error) fail(error);
  type Row = Omit<AdminSession, "route_name" | "route_kind" | "city_name" | "user_name" | "user_email"> & {
    buky_routes: One<{ name: string; kind: string; br_cities: One<{ name: string }> }>;
    users: One<{ name: string | null; email: string | null }>;
  };
  return ((data ?? []) as unknown as Row[]).map((s) => {
    const r = one(s.buky_routes);
    const u = one(s.users);
    return {
      ...s,
      route_name: r?.name ?? "",
      route_kind: r?.kind ?? "",
      city_name: one(r?.br_cities ?? null)?.name ?? null,
      user_name: u?.name ?? null,
      user_email: u?.email ?? null,
    };
  });
}

export async function sessionPasses(sessionId: string) {
  const { data, error } = await supabase
    .from("buky_passes")
    .select("passed_at, distance_m, accuracy_m, speed_kmh, valid, awarded, reject_reason, buky_points(label, seq)")
    .eq("session_id", sessionId)
    .order("passed_at");
  if (error) fail(error);
  return (data ?? []) as unknown as {
    passed_at: string;
    distance_m: number | null;
    accuracy_m: number | null;
    speed_kmh: number | null;
    valid: boolean;
    awarded: boolean;
    reject_reason: string | null;
    buky_points: One<{ label: string | null; seq: number }>;
  }[];
}

export async function invalidateSession(id: string, reason: string) {
  const { data, error } = await supabase.rpc("admin_buky_invalidate_session", { p_session_id: id, p_reason: reason });
  if (error) fail(error);
  return data as { changed: boolean; bukys_removed?: number; bukys_not_recovered?: number };
}

export interface AthleteHit {
  id: string;
  name: string | null;
  email: string | null;
  instagram: string | null;
  city: string | null;
  balance: number;
}

export async function searchAthletes(q: string): Promise<AthleteHit[]> {
  const term = q.trim().replace(/[%,()]/g, "");
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, instagram, city, buky_balances(balance)")
    .or(`name.ilike.%${term}%,email.ilike.%${term}%,instagram.ilike.%${term}%`)
    .limit(10);
  if (error) fail(error);
  return ((data ?? []) as unknown as (Omit<AthleteHit, "balance"> & { buky_balances: One<{ balance: number }> })[]).map((u) => ({
    ...u,
    balance: one(u.buky_balances)?.balance ?? 0,
  }));
}

export async function giftBukys(userId: string, amount: number, note: string) {
  const { data, error } = await supabase.rpc("admin_buky_gift", { p_user_id: userId, p_amount: amount, p_note: note });
  if (error) fail(error);
  return data as { balance: number };
}

// ------------------------------------------------------------------ parámetros e indicadores

export interface Setting {
  key: string;
  value: unknown;
  description: string | null;
}

export async function listBukySettings(): Promise<Setting[]> {
  const { data, error } = await supabase.from("app_settings").select("key, value, description").like("key", "buky_%").order("key");
  if (error) fail(error);
  return (data ?? []) as Setting[];
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) fail(error);
}

export interface Kpis {
  athletes7d: number;
  sessions7d: number;
  invalid7d: number;
  bukysFound: number;
  bukysSent: number;
  bukysGift: number;
  officialRoutes: number;
  athleteRoutes: number;
}

export async function getKpis(): Promise<Kpis> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [s7, routes, balances] = await Promise.all([
    supabase.from("buky_sessions").select("user_id, status").gte("started_at", since).in("status", ["valid", "invalid"]).limit(5000),
    supabase.from("buky_routes").select("kind").eq("active", true),
    supabase.from("buky_balances").select("found_total, sent_total, gift_total").limit(10000),
  ]);
  for (const r of [s7, routes, balances]) if (r.error) fail(r.error);
  const sessions = (s7.data ?? []) as { user_id: string; status: string }[];
  const b = (balances.data ?? []) as { found_total: number; sent_total: number; gift_total: number }[];
  const rk = (routes.data ?? []) as { kind: string }[];
  return {
    athletes7d: new Set(sessions.map((x) => x.user_id)).size,
    sessions7d: sessions.length,
    invalid7d: sessions.filter((x) => x.status === "invalid").length,
    bukysFound: b.reduce((a, x) => a + x.found_total, 0),
    bukysSent: b.reduce((a, x) => a + x.sent_total, 0),
    bukysGift: b.reduce((a, x) => a + x.gift_total, 0),
    officialRoutes: rk.filter((x) => x.kind === "official").length,
    athleteRoutes: rk.filter((x) => x.kind === "athlete").length,
  };
}

// ------------------------------------------------------------------ testadores de rutas (paso 19)

export interface RouteTester {
  user_id: string;
  note: string | null;
  added_at: string;
  name: string | null;
  email: string | null;
}

export async function listRouteTesters(): Promise<RouteTester[]> {
  const { data, error } = await supabase
    .from("buky_route_testers")
    .select("user_id, note, added_at, users!buky_route_testers_user_id_fkey(name, email)")
    .order("added_at", { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as unknown as (Omit<RouteTester, "name" | "email"> & { users: One<{ name: string | null; email: string | null }> })[]).map((t) => ({
    user_id: t.user_id,
    note: t.note,
    added_at: t.added_at,
    name: one(t.users)?.name ?? null,
    email: one(t.users)?.email ?? null,
  }));
}

export async function addRouteTester(userId: string, note: string | null): Promise<void> {
  const { error } = await supabase.from("buky_route_testers").upsert({ user_id: userId, note }, { onConflict: "user_id" });
  if (error) fail(error);
}

export async function removeRouteTester(userId: string): Promise<void> {
  const { error } = await supabase.from("buky_route_testers").delete().eq("user_id", userId);
  if (error) fail(error);
}

/** Códigos únicos de canje, p. ej. "NIT-7K4M-Q9XA". Sin 0/O/1/I para que no se confundan al leerlos. */
export function generateCodes(n: number, prefix: string): string[] {
  const abc = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const out = new Set<string>();
  const p = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "3BUK";
  while (out.size < n) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const s = Array.from(bytes, (b) => abc[b % abc.length]).join("");
    out.add(`${p}-${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return [...out];
}

export async function listCodes(couponId: string): Promise<{ code: string; assigned: boolean }[]> {
  const { data, error } = await supabase.from("buky_coupon_codes").select("code, assigned").eq("coupon_id", couponId).order("created_at");
  if (error) fail(error);
  return (data ?? []) as { code: string; assigned: boolean }[];
}
