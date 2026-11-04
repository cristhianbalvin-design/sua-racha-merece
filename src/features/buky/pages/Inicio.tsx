import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Play, Plus, Route as RouteIcon, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { haversineMeters } from "@/features/buky/engine";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import StartSheet from "../components/StartSheet";
import CouponList from "../components/CouponList";
import { ProfileAvatar, Sheet } from "../components/ui";
import { useBukyProfile, useCity, useRoutes, useSummary, useCouponsHere } from "../lib/hooks";
import { useGeolocation } from "../lib/useGeolocation";
import { training } from "../training/useTraining";

const NEAR_M = 1000;

export default function Inicio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useBukyProfile();
  const { data: city } = useCity(profile?.city_code);
  const { data: routes = [], isLoading: loadingRoutes } = useRoutes(profile?.city_code);
  const { data: summary } = useSummary();
  const { pos, error: geoError } = useGeolocation();
  const { coupons, away } = useCouponsHere(pos);
  const [routeId, setRouteIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("buky.route");
    } catch {
      return null;
    }
  });
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
  const official = routes.filter((r) => r.kind === "official");
  const mine = routes.filter((r) => r.kind === "athlete");

  // "N waypoints perto de você": de la ruta elegida, a menos de 1 km; sin ubicación, todos los de la ruta
  const nearCount = useMemo(() => {
    const pts = route?.points ?? [];
    if (!pos) return pts.length;
    return pts.filter((p) => haversineMeters(pos.lat, pos.lon, p.lat, p.lon) <= NEAR_M).length;
  }, [pos, route]);

  const routeCenter = useMemo(() => {
    const pts = route?.points ?? [];
    if (!pts.length) return null;
    return { lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lon: pts.reduce((a, p) => a + p.lon, 0) / pts.length };
  }, [route]);
  const center = (focusRoute && routeCenter) || pos || routeCenter || (city ? { lat: city.lat, lon: city.lon } : null);
  const zone = [profile?.neighborhood, city?.name].filter(Boolean).join(" · ");

  const start = async () => {
    if (!route || !user) return;
    setStarting(true);
    try {
      await training.start(user.id, route, city?.name ?? "");
      setAskStart(false);
      navigate("/app/treino");
    } catch (e) {
      toast.error(training.getSnapshot().error === "offline" ? pt.treino.semConexao : pt.comum.erro);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="relative h-[calc(100svh-0px)] min-h-[640px] overflow-hidden">
      <BukyMap
        center={center}
        zoom={13.4}
        points={route ? route.points.map((p) => ({ ...p, state: "idle" as const })) : []}
        path={route?.path}
        showPath
        user={pos}
        nearRadiusM={pos ? NEAR_M : undefined}
        className="absolute inset-x-0 top-0 h-[68%]"
      />
      {/* degradé del mapa al negro */}
      <div className="pointer-events-none absolute inset-x-0 top-[48%] h-[22%] bg-gradient-to-b from-transparent to-[var(--buky-bg)]" />

      {/* saldo + avatar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+28px)]">
        <Link to="/app/bolsa" className="flex items-baseline gap-2" aria-label="Ver bolsa">
          <span className="font-buky-xcond text-[44px] drop-shadow">{summary?.balance ?? 0}</span>
          <span className="buky-label text-[var(--buky-neon)]">{pt.inicio.bukys}</span>
        </Link>
        <ProfileAvatar />
      </div>

      <div className="absolute inset-x-0 bottom-[110px] px-6">
        {/* Botón Iniciar debajo del mapa, a la derecha del contador (no tapa el mapa) */}
        <div className="absolute right-6 top-0 z-10 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setAskStart(true)}
            disabled={!route}
            aria-label={pt.inicio.iniciar}
            className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[var(--buky-neon)] text-[#050505] shadow-[0_0_0_7px_rgba(57,255,20,0.14),0_10px_30px_rgba(0,0,0,0.6)] transition active:scale-95 disabled:opacity-40"
          >
            <Play size={26} fill="currentColor" />
          </button>
          <span className="font-buky mt-2 text-[13px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">{pt.inicio.iniciar}</span>
        </div>

        <div>
          <div className="min-w-0">
            {zone && <p className="buky-label truncate pr-28 text-[var(--buky-neon)]">{zone}</p>}
            {loadingRoutes ? null : routes.length === 0 ? (
              <div className="mt-2 max-w-[220px]">
                <p className="text-[15px] text-[var(--buky-muted)]">{pt.inicio.semRotas}</p>
                <Link to="/app/rotas/nova" className="mt-3 inline-flex items-center gap-1 font-semibold text-[var(--buky-neon)]">
                  <Plus size={16} /> {pt.inicio.criarRota}
                </Link>
              </div>
            ) : (
              <>
                <p className="font-buky-xcond mt-1 text-[96px]">{nearCount}</p>
                <p className="mt-2 text-[15px] text-[var(--buky-muted)]">{pt.inicio.pertoDeVoce(nearCount)}</p>
                <button
                  type="button"
                  onClick={() => setPickRoute(true)}
                  className="mt-3 flex max-w-full items-center gap-2 rounded-full border border-[var(--buky-line)] bg-[#0d0d0d] py-2 pl-3 pr-3 text-sm"
                  aria-label={`${pt.inicio.escolherRota}: ${route?.name ?? ""}`}
                >
                  <RouteIcon size={16} className="shrink-0 text-[var(--buky-neon)]" />
                  <span className="truncate font-semibold">{route?.name}</span>
                  <ChevronDown size={16} className="shrink-0 text-[var(--buky-muted)]" />
                </button>
              </>
            )}
            {geoError && <p className="mt-2 max-w-[220px] text-xs text-[var(--buky-faint)]">{pt.inicio.localizacao}</p>}
            {coupons.length > 0 && (
              <button type="button" onClick={() => setShowCoupons(true)} className="mt-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Ticket size={16} className="text-[var(--buky-neon)]" /> {away ? pt.treino.cuponsDigitais : pt.treino.cupons} · {coupons.length}
              </button>
            )}
          </div>
        </div>
      </div>

      <StartSheet open={askStart} onClose={() => setAskStart(false)} onStart={start} busy={starting} routeName={route?.name ?? ""} />
      <Sheet open={pickRoute} onClose={() => setPickRoute(false)} label={pt.inicio.escolherRota}>
        <div className="max-h-[60svh] overflow-auto">
          {[
            { title: pt.inicio.rotasOficiais, list: official },
            { title: pt.inicio.minhasRotas, list: mine },
          ].map(
            (g) =>
              g.list.length > 0 && (
                <div key={g.title} className="mb-4">
                  <p className="buky-label mb-1 text-[var(--buky-muted)]">{g.title}</p>
                  <ul className="-mx-2">
                    {g.list.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setRouteId(r.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left hover:bg-[#161616]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[16px] font-semibold">{r.name}</span>
                            <span className="block text-[13px] text-[var(--buky-muted)]">
                              {pt.rota.bukys(r.points.length)}
                              {r.length_m ? ` · ${(r.length_m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : ""}
                            </span>
                          </span>
                          {r.id === route?.id && <Check size={18} className="shrink-0 text-[var(--buky-neon)]" />}
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
      <Sheet open={showCoupons} onClose={() => setShowCoupons(false)} label={away ? pt.treino.cuponsDigitais : pt.treino.cupons}>
        <CouponList coupons={coupons} away={away} />
        <Link to="/app/bolsa/sorteios" className="buky-btn buky-btn-ghost mt-4">
          {pt.treino.verSorteios}
        </Link>
      </Sheet>
    </div>
  );
}
