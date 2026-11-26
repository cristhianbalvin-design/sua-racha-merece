import { isPremiumActive } from "@/components/PlanBadge";
import { useQuery } from "@tanstack/react-query";
import { apiGetMyWallet } from "@/lib/walletApi";
import { IS_NATIVE } from "@/lib/platform";
import { OpenInApp } from "../components/OpenInApp";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Play,
  Plus,
  Route as RouteIcon,
  Smartphone,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { haversineMeters } from "@/features/buky/engine";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import PlanSeal from "../components/PlanSeal";
import StartSheet from "../components/StartSheet";
import CouponList from "../components/CouponList";
import HomeExtras from "../components/HomeExtras";
import { ProfileAvatar, Sheet } from "../components/ui";
import {
  useBukyProfile,
  useCity,
  useMyStatus,
  useMyPassedPointsToday,
  useRoutes,
  useSummary,
  useCouponsHere,
} from "../lib/hooks";
import type { BukyApiError } from "../lib/api";
import { useGeolocation } from "../lib/useGeolocation";
import { training } from "../training/useTraining";
import { getGpsSource } from "../training/gpsSource";
import { useShopEnabled } from "../components/loja/shared";

const NEAR_M = 1000;

export default function Inicio() {
  const shop = useShopEnabled();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet, enabled: Boolean(user), staleTime: 30_000 });
  const { data: profile } = useBukyProfile();
  const { data: city } = useCity(profile?.city_code);
  const { data: routes = [], isLoading: loadingRoutes } = useRoutes(
    profile?.city_code,
  );
  const { data: summary } = useSummary();
  const { data: status, refetch: refetchStatus } = useMyStatus();
  const { pos, error: geoError } = useGeolocation();
  // Ronda 3: solo la app instalada recolecta; en la web se ve todo menos el botón de iniciar (los testadores sí)
  const sessionsFull = Boolean(status && !status.tester && status.sessions_today >= status.sessions_max);
  const canTrain = IS_NATIVE && getGpsSource().kind === "native";
  const [appOnly, setAppOnly] = useState(false);
  const { coupons, away } = useCouponsHere(pos);
  const [routeId, setRouteIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("buky.route");
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState<"route" | "free">("route");
  useEffect(() => {
    if (status && !status.free_enabled) setMode("route");
  }, [status]);
  const [pickRoute, setPickRoute] = useState(false);
  // Al elegir una ruta a mano, el mapa va a ella (aunque estés lejos, p. ej. probando desde otro país)
  const [focusRoute, setFocusRoute] = useState(false);
  const setRouteId = (id: string) => {
    setRouteIdState(id);
    setFocusRoute(true);
    setPickRoute(false);
    try {
      localStorage.setItem("buky.route", id);
    } catch {
      /* sin almacenamiento: solo dura esta visita */
    }
  };
  const [askStart, setAskStart] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);
  const [starting, setStarting] = useState(false);

  const route = routes.find((r) => r.id === routeId) ?? routes[0] ?? null;
  const { data: passedPoints = [] } = useMyPassedPointsToday(route?.id);
  const passedPointIds = useMemo(() => new Set(passedPoints), [passedPoints]);
  const official = routes.filter((r) => r.kind === "official");
  const mine = routes.filter((r) => r.kind === "athlete");

  // "N waypoints perto de você": de la ruta elegida, a menos de 1 km; sin ubicación, todos los de la ruta
  const nearCount = useMemo(() => {
    const pts = route?.points ?? [];
    if (!pos) return pts.length;
    return pts.filter(
      (p) => haversineMeters(pos.lat, pos.lon, p.lat, p.lon) <= NEAR_M,
    ).length;
  }, [pos, route]);

  const routeCenter = useMemo(() => {
    const pts = route?.points ?? [];
    if (!pts.length) return null;
    return {
      lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length,
      lon: pts.reduce((a, p) => a + p.lon, 0) / pts.length,
    };
  }, [route]);
  const center =
    (focusRoute && routeCenter) ||
    pos ||
    routeCenter ||
    (city ? { lat: city.lat, lon: city.lon } : null);
  const zone = [profile?.neighborhood, city?.name].filter(Boolean).join(" · ");

  const start = async () => {
    if (!user || (mode === "route" && !route)) return;
    if (status?.blocked_today) {
      setAskStart(false);
      toast.error(pt.treino.bloqueado, { duration: 8000 });
      return;
    }
    setStarting(true);
    try {
      await training.start(user.id, mode === "free" ? null : route, city?.name ?? "", status ? { ...status.rules, sessions_limited: !status.tester, daily_cap: status.bukys_max, bukys_today: status.bukys_today } : undefined);
      setAskStart(false);
      navigate("/app/treino");
    } catch (e) {
      const code = (e as BukyApiError).code;
      if (code === "app_required") {
        setAskStart(false);
        setAppOnly(true);
      } else if (code === "daily_sessions_limit") {
        setAskStart(false);
        void refetchStatus();
        toast.error("Você atingiu o limite de treinos de hoje.");
      } else if (code === "free_not_enabled") {
        setAskStart(false);
        setMode("route");
        void refetchStatus();
        toast.error("O treino livre ainda não está disponível na sua cidade.");
      } else if (code === "blocked_today") {
        setAskStart(false);
        void refetchStatus();
        toast.error(pt.treino.bloqueado, { duration: 8000 });
      } else
        toast.error(
          training.getSnapshot().error === "offline"
            ? pt.treino.semConexao
            : pt.comum.erro,
        );
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <div className="relative h-[calc(100svh-24px)] min-h-[600px] overflow-hidden">
        <BukyMap
          center={center}
          zoom={13.4}
          points={
            mode === "route" && route
              ? route.points.map((p) => ({ ...p, state: passedPointIds.has(p.id) ? "collected" as const : "idle" as const }))
              : []
          }
          path={mode === "route" ? route?.path : null}
          showPath
          user={pos}
          nearRadiusM={pos ? NEAR_M : undefined}
          className="absolute inset-x-0 top-0 h-[68%]"
        />
        {/* degradé del mapa al negro */}
        <div className="pointer-events-none absolute inset-x-0 top-[48%] h-[22%] bg-gradient-to-b from-transparent to-[var(--buky-bg)]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-[230px] bg-gradient-to-b from-[rgba(5,5,5,0.94)] via-[rgba(5,5,5,0.6)] to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+28px)]">
          <div>
            <PlanSeal premium={isPremiumActive(wallet?.premium?.active, wallet?.premium?.until)} />
            <Link to="/app/bolsa" className="mt-6 flex items-end gap-2.5 text-white" aria-label={`Ver bolsa: ${summary?.balance ?? 0} Bukys`}>
              <span className="font-buky-xcond text-[104px] leading-[0.82] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">{summary?.balance ?? 0}</span>
              <span className="flex flex-col gap-1 pb-1.5">
                <span className="buky-label text-[var(--buky-neon)]">{pt.inicio.bukys}</span>
                {status?.bukys_today != null && <span className="text-[13px] font-medium text-[#e6e6e6]">+{status.bukys_today} hoje</span>}
              </span>
            </Link>
          </div>
          <ProfileAvatar />
        </div>

        {IS_NATIVE ? <div className="absolute inset-x-0 bottom-[118px] px-6">
          {/* Botón Iniciar debajo del mapa, a la derecha del contador (no tapa el mapa) */}
          <div className="absolute right-6 top-0 z-10 flex flex-col items-center">
            <button
              type="button"
              onClick={() => (canTrain ? setAskStart(true) : setAppOnly(true))}
              disabled={(mode === "route" && !route) || sessionsFull}
              aria-label={pt.inicio.iniciar}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--buky-neon)] text-[#050505] shadow-[0_0_0_7px_rgba(57,255,20,0.14),0_10px_30px_rgba(0,0,0,0.6)] transition active:scale-95 disabled:opacity-40"
            >
              {canTrain ? (
                <Play size={26} fill="currentColor" />
              ) : (
                <Smartphone size={26} />
              )}
            </button>
            <span className="font-buky mt-2 text-[13px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {sessionsFull ? "Limite de treinos atingido" : pt.inicio.iniciar}
            </span>
          </div>

          <div>
            {status?.free_enabled && <div className="mb-3 inline-flex rounded-full border border-[var(--buky-line)] bg-[#0d0d0d] p-1" role="group" aria-label="Modo de treino">
              {(["route", "free"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${mode === m ? "bg-[var(--buky-neon)] text-[#050505]" : "text-[var(--buky-muted)]"}`}
                >
                  {m === "route" ? "Rota" : "Livre"}
                </button>
              ))}
            </div>}
            {status && <p className="mb-2 max-w-[210px] text-xs text-white">Treinos hoje {status.sessions_today}/{status.sessions_max} · Bukys hoje {status.bukys_today}/{status.bukys_max}</p>}
            <div className="min-w-0">
              {zone && (
                <p className="buky-label truncate pr-28 text-[var(--buky-neon)]">
                  {zone}
                </p>
              )}
              {mode === "free" ? (
                <div className="mt-1 max-w-[230px]">
                  <p className="font-buky-xcond text-[clamp(52px,16vw,64px)] leading-none">
                    {(status?.rules.free_km_per_buky ?? 1.5).toLocaleString("pt-BR")} km
                  </p>
                  <p className="mt-2 text-[15px] text-[var(--buky-muted)]">
                    = 1 Buky. Corra por onde quiser, sem rota.
                  </p>
                </div>
              ) : loadingRoutes ? null : routes.length === 0 ? (
                <div className="mt-2 max-w-[220px]">
                  <p className="text-[15px] text-[var(--buky-muted)]">
                    {pt.inicio.semRotas}
                  </p>
                  <Link
                    to="/app/rotas/nova"
                    className="mt-3 inline-flex items-center gap-1 font-semibold text-[var(--buky-neon)]"
                  >
                    <Plus size={16} /> {pt.inicio.criarRota}
                  </Link>
                </div>
              ) : (
                <>
                  <p className="font-buky-xcond mt-1 text-[clamp(64px,20vw,80px)] leading-none">
                    {nearCount}
                  </p>
                  <p className="mt-2 text-[15px] text-[var(--buky-muted)]">
                    {pt.inicio.pertoDeVoce(nearCount)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPickRoute(true)}
                    className="mt-3 flex max-w-full items-center gap-2 rounded-full border border-[var(--buky-line)] bg-[#0d0d0d] py-2 pl-3 pr-3 text-sm"
                    aria-label={`${pt.inicio.escolherRota}: ${route?.name ?? ""}`}
                  >
                    <RouteIcon
                      size={16}
                      className="shrink-0 text-[var(--buky-neon)]"
                    />
                    <span className="truncate font-semibold">
                      {route?.name}
                    </span>
                    <ChevronDown
                      size={16}
                      className="shrink-0 text-[var(--buky-muted)]"
                    />
                  </button>
                </>
              )}
              {geoError && (
                <p className="mt-2 max-w-[220px] text-xs text-[var(--buky-faint)]">
                  {pt.inicio.localizacao}
                </p>
              )}
              {coupons.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCoupons(true)}
                  className="mt-3 flex items-center gap-2 text-sm font-semibold text-white"
                >
                  <Ticket size={16} className="text-[var(--buky-neon)]" />{" "}
                  {away ? pt.treino.cuponsDigitais : pt.treino.cupons} ·{" "}
                  {coupons.length}
                </button>
              )}
            </div>
          </div>
        </div> : <div className="absolute inset-x-0 bottom-[100px] px-6"><OpenInApp path="/app/treino" /></div>}
      </div>
      {shop.data && <Link to="/app/loja" className="mx-6 mb-5 block rounded-2xl border border-[var(--buky-line)] bg-[#111] p-5 text-lg font-semibold">Loja 3buk →</Link>}
      <HomeExtras cityCode={profile?.city_code} />

      <Sheet
        open={appOnly}
        onClose={() => setAppOnly(false)}
        label={pt.inicio.soApp}
      >
        <Smartphone size={34} className="text-[var(--buky-neon)]" />
        <h2 className="font-buky mt-3 text-[28px] leading-none">
          {pt.inicio.soApp}
        </h2>
        <p className="mt-3 text-[15px] leading-snug text-[var(--buky-muted)]">
          {pt.inicio.soAppTexto}
        </p>
        <button
          type="button"
          className="buky-btn mt-5"
          onClick={() => setAppOnly(false)}
        >
          {pt.comum.entendi}
        </button>
      </Sheet>
      <StartSheet
        open={askStart}
        onClose={() => setAskStart(false)}
        onStart={start}
        busy={starting}
        routeName={mode === "free" ? "Treino livre" : route?.name ?? ""}
      />
      <Sheet
        open={pickRoute}
        onClose={() => setPickRoute(false)}
        label={pt.inicio.escolherRota}
      >
        <div className="max-h-[60svh] overflow-auto">
          {[
            { title: pt.inicio.rotasOficiais, list: official },
            { title: pt.inicio.minhasRotas, list: mine },
          ].map(
            (g) =>
              g.list.length > 0 && (
                <div key={g.title} className="mb-4">
                  <p className="buky-label mb-1 text-[var(--buky-muted)]">
                    {g.title}
                  </p>
                  <ul className="-mx-2">
                    {g.list.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setRouteId(r.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left hover:bg-[#161616]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[16px] font-semibold">
                              {r.name}
                            </span>
                            <span className="block text-[13px] text-[var(--buky-muted)]">
                              {pt.rota.bukys(r.points.length)}
                              {r.length_m
                                ? ` · ${(r.length_m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`
                                : ""}
                            </span>
                          </span>
                          {r.id === route?.id && (
                            <Check
                              size={18}
                              className="shrink-0 text-[var(--buky-neon)]"
                            />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </div>
        <Link to="/app/rotas/nova" className="buky-btn buky-btn-ghost mt-2">
          <Plus size={18} /> {pt.inicio.criarRota}
        </Link>
      </Sheet>
      <Sheet
        open={showCoupons}
        onClose={() => setShowCoupons(false)}
        label={away ? pt.treino.cuponsDigitais : pt.treino.cupons}
      >
        <CouponList coupons={coupons} away={away} />
        <Link to="/app/bolsa/sorteios" className="buky-btn buky-btn-ghost mt-4">
          {pt.treino.verSorteios}
        </Link>
      </Sheet>
    </div>
  );
}
