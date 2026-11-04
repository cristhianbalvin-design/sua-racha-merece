import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { haversineMeters } from "@/features/buky/engine";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import StartSheet from "../components/StartSheet";
import CouponList from "../components/CouponList";
import { ProfileAvatar, Sheet } from "../components/ui";
import { useBukyProfile, useCity, useRoutes, useSummary, useZoneCoupons } from "../lib/hooks";
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
  const { data: coupons = [] } = useZoneCoupons(profile?.city_code);
  const { pos, error: geoError } = useGeolocation();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [askStart, setAskStart] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);
  const [starting, setStarting] = useState(false);

  const route = routes.find((r) => r.id === routeId) ?? routes[0] ?? null;
  const allPoints = useMemo(() => routes.flatMap((r) => r.points), [routes]);

  // "N waypoints perto de você": a menos de 1 km; sin ubicación, los de la ruta elegida
  const nearCount = useMemo(() => {
    if (!pos) return route?.points.length ?? 0;
    return allPoints.filter((p) => haversineMeters(pos.lat, pos.lon, p.lat, p.lon) <= NEAR_M).length;
  }, [pos, allPoints, route]);

  const center = pos ?? (route?.points[0] ? { lat: route.points[0].lat, lon: route.points[0].lon } : city ? { lat: city.lat, lon: city.lon } : null);
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
        points={(route ? routes.flatMap((r) => r.points.map((p) => ({ ...p, state: "idle" as const }))) : [])}
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
        {/* Botón Iniciar flotando sobre el mapa, siempre encima del bloque de datos */}
        <div className="absolute bottom-full right-6 z-10 mb-5 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setAskStart(true)}
            disabled={!route}
            aria-label={pt.inicio.iniciar}
            className="flex h-[124px] w-[124px] items-center justify-center rounded-full bg-[var(--buky-neon)] text-[#050505] shadow-[0_0_0_10px_rgba(57,255,20,0.14),0_12px_40px_rgba(0,0,0,0.6)] transition active:scale-95 disabled:opacity-40"
          >
            <Play size={30} fill="currentColor" />
          </button>
          <span className="font-buky mt-3 text-[15px] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">{pt.inicio.iniciar}</span>
        </div>

        {/* selector de ruta */}
        {routes.length > 1 && (
          <div className="-mx-6 mb-5 flex gap-2 overflow-x-auto px-6 pb-1" role="radiogroup" aria-label={pt.inicio.escolherRota}>
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={r.id === route?.id}
                onClick={() => setRouteId(r.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                  r.id === route?.id ? "border-[var(--buky-neon)] text-[var(--buky-neon)]" : "border-[var(--buky-line)] text-[var(--buky-muted)]"
                }`}
              >
                {r.name}
                {r.kind === "athlete" && " · minha"}
              </button>
            ))}
            <Link to="/app/rotas/nova" className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--buky-line)] px-4 py-2 text-sm text-[var(--buky-muted)]">
              <Plus size={14} /> {pt.inicio.criarRota}
            </Link>
          </div>
        )}

        <div>
          <div className="min-w-0">
            {zone && <p className="buky-label truncate text-[var(--buky-neon)]">{zone}</p>}
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
              </>
            )}
            {geoError && <p className="mt-2 max-w-[220px] text-xs text-[var(--buky-faint)]">{pt.inicio.localizacao}</p>}
            {coupons.length > 0 && (
              <button type="button" onClick={() => setShowCoupons(true)} className="mt-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Ticket size={16} className="text-[var(--buky-neon)]" /> {pt.treino.cupons} · {coupons.length}
              </button>
            )}
          </div>
        </div>
      </div>

      <StartSheet open={askStart} onClose={() => setAskStart(false)} onStart={start} busy={starting} routeName={route?.name ?? ""} />
      <Sheet open={showCoupons} onClose={() => setShowCoupons(false)} label={pt.treino.cupons}>
        <CouponList coupons={coupons} />
      </Sheet>
    </div>
  );
}
