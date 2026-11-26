import { Link } from "react-router-dom";

export default function PlanSeal({ premium, size = "md" }: { premium: boolean; size?: "md" | "sm" }) {
  const small = size === "sm";
  return (
    <Link
      to="/app/perfil/saldo"
      aria-label={premium ? "3buk Premium · ver plano" : "3buk Freemium · seja Premium"}
      className={`inline-flex shrink-0 items-stretch overflow-hidden rounded-full border-[3px] border-[#39ff14] bg-[#050505] shadow-[0_6px_20px_rgba(0,0,0,0.5)] ${small ? "h-[30px]" : "h-[44px]"}`}
    >
      <span className={`font-buky-xcond flex items-center leading-none text-white ${small ? "pl-3 pr-2 text-[19px]" : "pl-[18px] pr-[14px] text-[28px]"}`}><span className="text-[#39ff14]">3</span>buk</span>
      <span className={`-mr-[14px] flex skew-x-[-14deg] items-center ${small ? "pl-3 pr-6" : "pl-[18px] pr-[26px]"} ${premium ? "bg-[#39ff14] text-[#050505]" : "border-l-[3px] border-[#39ff14] text-[#39ff14]"}`}>
        <span className={`font-buky block skew-x-[14deg] font-bold italic tracking-[0.04em] ${small ? "text-[10px]" : "text-[15px]"}`}>{premium ? "PREMIUM" : "FREEMIUM"}</span>
      </span>
    </Link>
  );
}
