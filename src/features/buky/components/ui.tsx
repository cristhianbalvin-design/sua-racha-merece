import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { useBukyProfile } from "../lib/hooks";

/** Foto del atleta (o sus iniciales) que lleva al perfil, arriba a la derecha. */
export function ProfileAvatar({ size = 44, to = "/app/perfil" }: { size?: number; to?: string | null }) {
  const { data: p } = useBukyProfile();
  const initials = (p?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const inner = p?.avatar_url ? (
    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-[#1f6b2a] text-sm font-bold">
      {initials || <UserRound size={size * 0.5} />}
    </span>
  );
  const cls = "block shrink-0 overflow-hidden rounded-full";
  if (!to) return <span className={cls} style={{ width: size, height: size }}>{inner}</span>;
  return (
    <Link to={to} aria-label="Meu perfil" className={cls} style={{ width: size, height: size }}>
      {inner}
    </Link>
  );
}

/** Encabezado de pestaña: título grande en Archivo + avatar. */
export function ScreenHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+26px)]">
      <h1 className="font-buky text-[36px]">{title}</h1>
      {right ?? <ProfileAvatar />}
    </header>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--buky-muted)]" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--buky-neon)] border-t-transparent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-6 my-6 rounded-2xl border border-[var(--buky-line)] p-4 text-sm text-[var(--buky-muted)]">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 font-semibold text-[var(--buky-neon)]">
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/** Hoja inferior modal sencilla (aviso antes de iniciar, confirmaciones). */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-[28px] border-t border-[var(--buky-line)] bg-[#0d0d0d] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#333]" />
        {children}
      </div>
    </div>
  );
}

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" }) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(new Date(iso)) : "";

export const isToday = (iso: string | null | undefined) =>
  Boolean(iso) && fmtDate(iso, { dateStyle: "short" }) === fmtDate(new Date().toISOString(), { dateStyle: "short" });

export const fmtKm = (m: number | null | undefined) =>
  m == null ? "—" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;

export const fmtDuration = (s: number | null | undefined) => {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
