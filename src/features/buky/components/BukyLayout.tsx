import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, Camera, House, ShoppingBag, Star, UserRound } from "lucide-react";
import "../theme.css";
import { pt } from "../i18n";
import { isProfileComplete, useBukyProfile } from "../lib/hooks";
import { useAvisos } from "../lib/avisosApi";
import { useTraining } from "../training/useTraining";

const TABS = [
  { to: "/app", label: pt.tabs.inicio, icon: House, end: true },
  { to: "/app/bolsa", label: pt.tabs.bolsa, icon: ShoppingBag },
  { to: "/app/fotos", label: pt.tabs.fotos, icon: Camera },
  { to: "/app/patrocinio", label: pt.tabs.patrocinio, icon: Star },
  { to: "/app/perfil", label: pt.tabs.perfil, icon: UserRound },
];

/** Barra flotante de 5 pestañas del mockup. */
export function TabBar() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 z-40 mx-auto flex h-[62px] max-w-[318px] items-center justify-around rounded-[31px] border border-[var(--buky-line)] bg-[#141414]/95 backdrop-blur"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 26px)" }}
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            `relative flex h-full w-14 flex-col items-center justify-center ${isActive ? "text-[var(--buky-neon)]" : "text-[#a3a3a3]"}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={1.8} />
              {isActive && <span className="absolute bottom-[10px] h-1 w-1 rounded-full bg-[var(--buky-neon)]" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Contenedor de la app del atleta: tema oscuro, ancho de teléfono centrado en pantallas
 * grandes y barra de pestañas. Si falta la ciudad, manda a completar el perfil.
 */
export default function BukyLayout() {
  const location = useLocation();
  const { data: profile, isLoading } = useBukyProfile();
  const training = useTraining();
  const { data: notices = [] } = useAvisos();
  const unread = notices.filter((n) => !n.read).length;

  if (
    !isLoading &&
    profile &&
    !isProfileComplete(profile) &&
    location.pathname !== "/app/completar"
  ) {
    return (
      <Navigate
        to="/app/completar"
        replace
        state={{ from: location.pathname }}
      />
    );
  }
  // Con un entrenamiento en curso, Início muestra la pantalla del entrenamiento.
  if (training.status === "running" && location.pathname === "/app") {
    return <Navigate to="/app/treino" replace />;
  }

  // La campana va solo en Início y Perfil, donde la cabecera le deja lugar (en las demás pantallas tapaba el saldo).
  const showBell = location.pathname === "/app" || location.pathname === "/app/perfil";
  const hideTabs =
    location.pathname.startsWith("/app/completar") ||
    location.pathname.startsWith("/app/rotas/nova") ||
    /^\/app\/patrocinio\/.+/.test(location.pathname);

  return (
    <div className="buky">
      <div className="relative mx-auto min-h-svh w-full max-w-[480px] overflow-x-hidden">
        {showBell && (
          <Link
            to="/app/avisos"
            aria-label={`Avisos, ${unread} não lidos`}
            className={`absolute ${location.pathname === "/app" ? "right-[84px]" : "right-16"} top-[calc(env(safe-area-inset-top,0px)+28px)] z-20 rounded-full bg-[#111] p-2`}
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-[var(--buky-neon)] px-1 text-xs text-black">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        )}
        <Outlet />
        {!hideTabs && <div className="h-[110px]" aria-hidden />}
      </div>
      {!hideTabs && <TabBar />}
    </div>
  );
}
