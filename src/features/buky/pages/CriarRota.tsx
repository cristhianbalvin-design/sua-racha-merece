import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import { fmtKm, Spinner } from "../components/ui";
import { BukyApiError, createAthleteRoute } from "../lib/api";
import { qk, useBukyProfile, useCity, useRouteRules } from "../lib/hooks";
import { useGeolocation } from "../lib/useGeolocation";
import { checkDraft, type DraftPoint } from "../lib/routeDraft";

/** Crear ruta propia (opción C del cliente): el atleta marca los puntos tocando el mapa. */
export default function CriarRota() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useBukyProfile();
  const { data: city } = useCity(profile?.city_code);
  const { data: rules } = useRouteRules();
  const { pos } = useGeolocation();
  const [name, setName] = useState("");
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [saving, setSaving] = useState(false);

  const check = useMemo(() => (rules ? checkDraft(points, rules, city) : null), [points, rules, city]);
  const center = useMemo(() => pos ?? (city ? { lat: city.lat, lon: city.lon } : null), [Boolean(pos), city]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rules || !profile) return <Spinner label={pt.comum.carregando} />;

  const save = async () => {
    if (!check?.ok || !profile.city_code) return;
    setSaving(true);
    try {
      await createAthleteRoute(name.trim() || `Rota de ${profile.neighborhood ?? city?.name ?? ""}`.trim(), profile.city_code, points);
      await qc.invalidateQueries({ queryKey: qk.routes(profile.city_code) });
      toast.success(pt.rota.salva);
      navigate("/app", { replace: true });
    } catch (e) {
      toast.error(pt.rota.erros[(e as BukyApiError).code] ?? pt.comum.erro);
    } finally {
      setSaving(false);
    }
  };

  const flagged = new Set([...(check?.tooClose ?? []), ...(check?.outside ?? [])]);

  return (
    <div className="relative flex min-h-svh flex-col">
      <div className="relative h-[56svh] min-h-[320px]">
        <BukyMap
          center={center}
          zoom={15}
          showPath
          user={pos}
          points={points.map((p, i) => ({ id: String(i), lat: p.lat, lon: p.lon, state: flagged.has(i) ? "pending" : "visited" }))}
          onMapClick={(p) => setPoints((ps) => (ps.length >= rules.maxPoints ? ps : [...ps, p]))}
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+18px)]">
          <button type="button" onClick={() => navigate(-1)} aria-label={pt.comum.voltar} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70">
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={() => setPoints((ps) => ps.slice(0, -1))}
            disabled={!points.length}
            className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm disabled:opacity-40"
          >
            <Undo2 size={16} /> {pt.rota.desfazer}
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-8 pt-5">
        <h1 className="font-buky text-[36px]">{pt.rota.titulo}</h1>
        <p className="mt-2 text-sm text-[var(--buky-muted)]">{pt.rota.instrucao}</p>
        <p className="mt-1 text-xs text-[var(--buky-faint)]">
          {pt.rota.regras(rules.minGapM, rules.minLengthM, rules.minPoints)} {pt.rota.limiteDiario(rules.dailyCap)}
        </p>

        <div className="mt-4 flex items-baseline gap-4">
          <span className="font-buky text-[28px] text-[var(--buky-neon)]">{pt.rota.pontos(points.length)}</span>
          <span className="font-buky text-[28px]">{fmtKm(check?.lengthM ?? 0)}</span>
        </div>
        {points.length > 0 && check && !check.ok && (
          <ul className="mt-2 space-y-1 text-sm text-[#ffb020]" aria-live="polite">
            {check.problems.map((p) => (
              <li key={p}>{pt.rota.erros[p]}</li>
            ))}
          </ul>
        )}

        <label className="buky-field mt-5">
          <span>{pt.rota.nome}</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={`Rota de ${profile.neighborhood ?? ""}`} />
        </label>

        <button type="button" className="buky-btn mt-6" onClick={save} disabled={!check?.ok || saving}>
          {saving ? pt.comum.carregando : pt.rota.salvar}
        </button>
      </div>
    </div>
  );
}
