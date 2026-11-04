import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { haversineMeters } from "@/features/buky/engine";
import { useAuth } from "@/contexts/AuthContext";
import * as api from "./api";

export const qk = {
  profile: (id?: string) => ["buky", "profile", id] as const,
  summary: ["buky", "summary"] as const,
  city: (code?: number | null) => ["buky", "city", code] as const,
  routes: (city?: number | null) => ["buky", "routes", city] as const,
  coupons: (city?: number | null) => ["buky", "coupons", city] as const,
  sessions: (id?: string) => ["buky", "sessions", id] as const,
  states: ["buky", "states"] as const,
  routeRules: ["buky", "route-rules"] as const,
};

export function useBukyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.profile(user?.id),
    queryFn: () => api.getProfile(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
}

/**
 * Para jugar basta la ciudad del catálogo (decisión del cliente, 3/11/2026): barrio e Instagram
 * son obligatorios al crear cuenta nueva, pero opcionales para los atletas que ya existían.
 */
export function isProfileComplete(p?: api.BukyProfile | null): boolean {
  return Boolean(p?.city_code);
}

export function useUpdateProfile() {
  const { user, updateUserContext } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof api.updateProfile>[1]) => api.updateProfile(user!.id, patch),
    onSuccess: (p) => {
      qc.setQueryData(qk.profile(user?.id), p);
      updateUserContext({ name: p.name ?? undefined, city: p.city ?? "", country: p.country ?? "", avatar: p.avatar_url ?? "" });
      qc.invalidateQueries({ queryKey: ["buky", "coupons"] });
    },
  });
}

export function useCity(code?: number | null) {
  return useQuery({
    queryKey: qk.city(code),
    queryFn: () => api.getCity(code!),
    enabled: Boolean(code),
    staleTime: Infinity,
  });
}

/** Catálogo completo en memoria (se descarga una vez por sesión). */
export function useAllCities(enabled = true) {
  return useQuery({ queryKey: ["buky", "all-cities"], queryFn: api.listAllCities, staleTime: Infinity, gcTime: Infinity, enabled });
}

export function useStates() {
  return useQuery({ queryKey: qk.states, queryFn: api.listStates, staleTime: Infinity });
}

export function useSummary() {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.summary, queryFn: api.getSummary, enabled: Boolean(user), staleTime: 15_000 });
}

export function useRoutes(cityCode?: number | null) {
  return useQuery({
    queryKey: qk.routes(cityCode),
    queryFn: () => api.listRoutes(cityCode!),
    enabled: Boolean(cityCode),
    staleTime: 60_000,
  });
}

export function useZoneCoupons(cityCode?: number | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.coupons(cityCode),
    queryFn: () => api.getZoneCoupons(cityCode),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

export function useMySessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.sessions(user?.id),
    queryFn: () => api.listMySessions(user!.id),
    enabled: Boolean(user?.id),
  });
}

export interface RouteRules {
  minGapM: number;
  minLengthM: number;
  minPoints: number;
  maxPoints: number;
  dailyCap: number;
  maxCityKm: number;
}

export function useRouteRules() {
  return useQuery({
    queryKey: qk.routeRules,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RouteRules> => {
      const s = await api.getSettings([
        "buky_athlete_route_min_point_gap_m",
        "buky_athlete_route_min_length_m",
        "buky_athlete_route_min_points",
        "buky_athlete_route_max_points",
        "buky_athlete_route_daily_cap",
        "buky_athlete_route_max_city_km",
      ]);
      return {
        minGapM: s.buky_athlete_route_min_point_gap_m ?? 200,
        minLengthM: s.buky_athlete_route_min_length_m ?? 1000,
        minPoints: s.buky_athlete_route_min_points ?? 3,
        maxPoints: s.buky_athlete_route_max_points ?? 30,
        dailyCap: s.buky_athlete_route_daily_cap ?? 10,
        maxCityKm: s.buky_athlete_route_max_city_km ?? 60,
      };
    },
  });
}

export function useSendToRaffle() {
  const qc = useQueryClient();
  return useMutation({
    // La clave la genera la pantalla al confirmar: si la red falla y se reintenta, no se duplica el envío.
    mutationFn: (idempotencyKey: string) => api.sendToRaffle(idempotencyKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.summary }),
  });
}

export function useIsRouteTester() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["buky", "route-tester", user?.id], queryFn: api.isRouteTester, enabled: Boolean(user), staleTime: 5 * 60_000 });
}

/**
 * Cupones "en esta zona": los de la ciudad del atleta solo cuentan si está físicamente en ella
 * (dentro del radio de la ciudad). Lejos de su ciudad (p. ej. probando desde otro país) solo
 * quedan los digitales, que se usan en la app. Sin ubicación se muestran todos.
 */
export function useCouponsHere(pos?: { lat: number; lon: number } | null) {
  const { data: profile } = useBukyProfile();
  const { data: city } = useCity(profile?.city_code);
  const { data: rules } = useRouteRules();
  const { data: all = [] } = useZoneCoupons(profile?.city_code);
  const away = Boolean(pos && city && haversineMeters(pos.lat, pos.lon, city.lat, city.lon) > (rules?.maxCityKm ?? 60) * 1000);
  return { coupons: away ? all.filter((c) => c.kind === "digital") : all, away };
}
