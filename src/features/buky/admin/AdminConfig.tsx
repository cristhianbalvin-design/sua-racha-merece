import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { listBukySettings, saveSetting, type Setting } from "./adminApi";
import { btnPrimary, card, inputCls } from "./ui";
import AdminTesters from "./AdminTesters";

const TESTERS = "Testadores";

// Orden y agrupación de las claves buky_* para el admin
const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Velocidade e antifraude", keys: ["buky_speed_min_kmh", "buky_speed_max_kmh", "buky_vehicle_window_s", "buky_speed_window_s", "buky_max_accuracy_m", "buky_mock_max_ratio"] },
  { title: "Rotas dos atletas", keys: ["buky_athlete_route_min_point_gap_m", "buky_athlete_route_min_length_m", "buky_athlete_route_min_points", "buky_athlete_route_max_points", "buky_athlete_route_max_active", "buky_athlete_route_daily_cap", "buky_athlete_route_max_city_km", "buky_point_radius_default_m"] },
  { title: "Sorteios e horário", keys: ["buky_raffle_draw_delay_min", "buky_timezone"] },
];

const LABELS: Record<string, string> = {
  buky_speed_min_kmh: "Velocidade mínima para a passagem contar (km/h) — caminhar não conta",
  buky_speed_max_kmh: "Velocidade máxima para a passagem contar (km/h)",
  buky_vehicle_window_s: "Segundos seguidos acima da máxima que anulam o treino (veículo)",
  buky_speed_window_s: "Janela para medir a velocidade ao passar pelo ponto (s)",
  buky_max_accuracy_m: "Precisão mínima do GPS para usar uma leitura (m)",
  buky_mock_max_ratio: "Proporção de leituras com localização simulada que anula o treino (0,05 = 5%)",
  buky_athlete_route_min_point_gap_m: "Distância mínima entre pontos (m)",
  buky_athlete_route_min_length_m: "Extensão mínima da rota (m)",
  buky_athlete_route_min_points: "Mínimo de pontos",
  buky_athlete_route_max_points: "Máximo de pontos",
  buky_athlete_route_max_active: "Rotas ativas por atleta",
  buky_athlete_route_daily_cap: "Limite diário de Bukys em rotas próprias",
  buky_athlete_route_max_city_km: "Distância máxima de cada ponto ao centro da cidade (km)",
  buky_point_radius_default_m: "Raio padrão dos pontos das rotas de atletas (m)",
  buky_raffle_draw_delay_min: "Minutos entre o encerramento e o sorteio automático",
  buky_timezone: "Fuso horário que define o \"dia\" dos limites",
};

export default function AdminConfig() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-buky", "settings"], queryFn: listBukySettings });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(GROUPS[0].title);
  const byKey = new Map(data.map((s) => [s.key, s]));
  const known = new Set(GROUPS.flatMap((g) => g.keys));
  const others = data.filter((s) => !known.has(s.key));

  const save = async (s: Setting) => {
    const raw = draft[s.key];
    if (raw === undefined) return;
    const value = typeof s.value === "number" ? Number(raw) : raw;
    if (typeof s.value === "number" && !Number.isFinite(value as number)) return toast.error("Valor inválido.");
    try {
      await saveSetting(s.key, value);
      toast.success("Salvo. Vale para os próximos treinos.");
      setDraft(({ [s.key]: _, ...rest }) => rest);
      await qc.invalidateQueries({ queryKey: ["admin-buky", "settings"] });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const row = (s?: Setting) =>
    s && (
      <div key={s.key} className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{LABELS[s.key] ?? s.description ?? s.key}</p>
          {/* "notranslate": el traductor del navegador no debe cambiar el nombre técnico */}
          <p className="notranslate font-mono text-[11px] text-muted-foreground" translate="no">{s.key}</p>
        </div>
        <input
          className={inputCls.replace("w-full", "") + " w-36 shrink-0"}
          value={draft[s.key] ?? String(s.value ?? "")}
          onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
          aria-label={s.key}
        />
        <button type="button" className={btnPrimary} disabled={draft[s.key] === undefined} onClick={() => save(s)} aria-label="Salvar">
          <Save size={14} />
        </button>
      </div>
    );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        As regras são lidas no servidor a cada treino: mudar um valor aqui vale imediatamente para os próximos treinos, sem publicar o app.
      </p>
      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Grupos de configurações">
        {[...GROUPS.map((g) => g.title), TESTERS, ...(others.length ? ["Outros"] : [])].map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-xs font-bold ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      <div className={`${card} divide-y divide-border`} role="tabpanel">
        {tab === TESTERS ? <AdminTesters /> : tab === "Outros" ? others.map((s) => row(s)) : GROUPS.find((g) => g.title === tab)?.keys.map((k) => row(byKey.get(k)))}
      </div>
    </div>
  );
}
