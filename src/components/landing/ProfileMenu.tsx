import { MyPlanBadge } from "@/components/PlanBadge";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiGetMyWallet, brl } from "@/lib/walletApi";
import { useBukyProfile, useCity, useSummary } from "@/features/buky/lib/hooks";
import { OpenInApp } from "@/features/buky/components/OpenInApp";

function useAccount() {
  const { user, logout } = useAuth();
  const { data: profile } = useBukyProfile();
  const { data: city } = useCity(profile?.city_code);
  const { data: summary } = useSummary();
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet, enabled: Boolean(user), staleTime: 30000 });
  const name = profile?.name || user?.name || "Atleta";
  const plan = wallet?.premium?.active && wallet.premium.until
    ? `Premium até ${new Date(wallet.premium.until).toLocaleDateString("pt-BR")}`
    : "Freemium";
  return { user, logout, profile, city, summary, wallet, name, plan };
}

export function ProfileMenu() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", outside);
    root.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", outside); };
  }, [open]);
  const initials = account.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div ref={root} className="l-profile">
      <button ref={trigger} type="button" className="l-profile-trigger" aria-label="Abrir menu do perfil" aria-expanded={open} onClick={() => setOpen(!open)}>
        {account.profile?.avatar_url ? <img src={account.profile.avatar_url} alt="" /> : initials}
      </button>
      {open && <div className="l-profile-menu">
        <strong>{account.name}</strong>
        <p>{account.user?.email}</p>
        <p>{account.city?.name || account.profile?.city || ""}</p>
        <MyPlanBadge />
        <p>{brl(account.wallet?.balance_cents ?? 0)} · {account.summary?.balance ?? 0} Bukys</p>
        <Link to="/app/perfil" onClick={() => setOpen(false)}>Meu perfil</Link>
        <Link to="/app/perfil/saldo" onClick={() => setOpen(false)}>Saldo / Premium</Link>
        <OpenInApp compact />
        <button type="button" onClick={() => void account.logout()}>Sair</button>
      </div>}
    </div>
  );
}

export function WelcomeCard() {
  const account = useAccount();
  return <div className="l-login">
    <h2>Olá, {account.name.split(" ")[0]}</h2>
    <p>{account.summary?.balance ?? 0} Bukys · {brl(account.wallet?.balance_cents ?? 0)}</p>
    <p>{account.plan}</p>
    <OpenInApp compact />
    <Link className="l-button l-outline" to="/app/perfil">Ir para meu perfil</Link>
  </div>;
}
