import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getKpis } from "./adminApi";
import { card } from "./ui";
import AdminRotas from "./AdminRotas";
import AdminSorteios from "./AdminSorteios";
import AdminPatrocinadores from "./AdminPatrocinadores";
import AdminTreinos from "./AdminTreinos";
import AdminConfig from "./AdminConfig";

const TABS = [
  { to: "rotas", label: "Rotas" },
  { to: "sorteios", label: "Sorteios" },
  { to: "patrocinadores", label: "Patrocinadores" },
  { to: "treinos", label: "Treinos e atletas" },
  { to: "config", label: "Configurações" },
];

function Kpis() {
  const { data: k } = useQuery({ queryKey: ["admin-buky", "kpis"], queryFn: getKpis, staleTime: 60_000 });
  const items = [
    { label: "Atletas (7 dias)", value: k?.athletes7d },
    { label: "Treinos (7 dias)", value: k?.sessions7d, sub: k ? `${k.invalid7d} não validados` : "" },
    { label: "Bukys encontrados", value: k?.bukysFound },
    { label: "Enviados a sorteios", value: k?.bukysSent },
    { label: "Presentes", value: k?.bukysGift },
    { label: "Rotas ativas", value: k ? k.officialRoutes + k.athleteRoutes : undefined, sub: k ? `${k.officialRoutes} oficiais · ${k.athleteRoutes} de atletas` : "" },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className={`${card} p-4`}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{i.label}</p>
          <p className="mt-1 text-2xl font-bold italic text-foreground">{i.value ?? "—"}</p>
          {i.sub && <p className="text-[11px] text-muted-foreground">{i.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/** Sección Buky del admin de 3BUK: /admin/buky/* */
export default function AdminBuky() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold italic text-foreground">BUKY</h1>
      <Kpis />
      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`
            }
          >
            {t.label.toUpperCase()}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="rotas" replace />} />
        <Route path="rotas" element={<AdminRotas />} />
        <Route path="sorteios" element={<AdminSorteios />} />
        <Route path="patrocinadores" element={<AdminPatrocinadores />} />
        <Route path="treinos" element={<AdminTreinos />} />
        <Route path="config" element={<AdminConfig />} />
      </Routes>
    </div>
  );
}
