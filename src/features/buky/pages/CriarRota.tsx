import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, LocateFixed, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import { fmtKm, Spinner } from "../components/ui";
import { BukyApiError, createAthleteRoute } from "../lib/api";
import { qk, useBukyProfile, useCity, useIsRouteTester, useRouteRules } from "../lib/hooks";
import { useGeolocation } from "../lib/useGeolocation";
import { checkDraft, type DraftPoint } from "../lib/routeDraft";

const R = pt.rota;

/**
 * Crear ruta propia (opción C del cliente). El atleta DIBUJA el recorrido por las calles: tocar el
 * mapa agrega un punto del trazo (pueden estar cerca, para las curvas) · arrastrar un punto lo mueve ·
 * tocar un punto lo elige para quitarlo o insertar otro después · Desfazer revierte cualquier cambio.
 * Los Bukys se ubican SOLOS a lo largo del trazo, cada N metros (Configurações), y se pintan en verde
 * con su zona de captura; los puntos del trazo son blancos.
 */
export default function CriarRota() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useBukyProfile();
  const { data: city } = useCity(profile?.city_code);
  const { data: rules } = useRouteRules();
  const { data: tester = false } = useIsRouteTester();
  const { pos } = useGeolocation();
  const [name, setName] = useState("");
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [history, setHistory] = useState<DraftPoint[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [recenter, setRecenter] = useState<{ n: number; at: DraftPoint } | null>(null);
  const dragStart = useRef<DraftPoint[] | null>(null);

  // El testador no tiene el límite de distancia a su ciudad (paso 19)
  const check = useMemo(() => (rules ? checkDraft(points, rules, tester ? null : city) : null), [points, rules, city, tester]);
  const center = useMemo(
    () => pos ?? (city ? { lat: city.lat, lon: city.lon } : null),
    [Boolean(pos), city], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!rules || !profile) return <Spinner label={pt.comum.carregando} />;

  const commit = (next: DraftPoint[]) => {
    setHistory((h) => [...h.slice(-49), points]);
    setPoints(next);
  };

  const onMapClick = (p: DraftPoint) => {
    if (points.length >= 400) return;
    if (selected !== null) {
      // Con un punto elegido, el nuevo va justo después de él
      const next = [...points.slice(0, selected + 1), p, ...points.slice(selected + 1)];
      commit(next);
      setSelected(selected + 1);
    } else {
      commit([...points, p]);
    }
  };

  const onDrag = (i: number, p: DraftPoint, done: boolean) => {
    if (!dragStart.current) dragStart.current = points;
    setPoints((ps) => ps.map((q, k) => (k === i ? p : q)));
    if (done) {
      const before = dragStart.current;
      dragStart.current = null;
      setHistory((h) => [...h.slice(-49), before]);
    }
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setPoints(prev);
    setSelected(null);
  };

  const removeSelected = () => {
    if (selected === null) return;
    commit(points.filter((_, k) => k !== selected));
    setSelected(null);
  };

  const clear = () => {
    if (!points.length || !window.confirm(R.confirmarLimpar)) return;
    commit([]);
    setSelected(null);
  };

  const save = async () => {
    if (!check?.ok || !profile.city_code) return;
    setSaving(true);
    try {
      const id = await createAthleteRoute(name.trim() || `Rota de ${profile.neighborhood ?? city?.name ?? ""}`.trim(), profile.city_code, points);
      try {
        localStorage.setItem("buky.route", id); // Início abre con la ruta recién creada
      } catch {
        /* sin almacenamiento */
      }
      await qc.invalidateQueries({ queryKey: qk.routes(profile.city_code) });
      toast.success(R.salva);
      navigate("/app", { replace: true });
    } catch (e) {
      toast.error(R.erros[(e as BukyApiError).code] ?? pt.comum.erro);
    } finally {
      setSaving(false);
    }
  };

  const bukys = check?.bukys ?? [];
  const chip = "flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm backdrop-blur disabled:opacity-40";

  return (
    <div className="relative flex min-h-svh flex-col">
      <div className="relative h-[60svh] min-h-[340px]">
        <BukyMap
          center={recenter?.at ?? center}
          recenterKey={recenter?.n}
          zoom={15}
          editable
          showRadius
          selected={selected}
          user={pos}
          vertices={points}
          points={bukys.map((b, i) => ({ id: `b${i}`, lat: b.lat, lon: b.lon, radiusM: rules.radiusM, state: "idle" as const }))}
          onMapClick={onMapClick}
          onPointTap={(i) => setSelected((s) => (s === i ? null : i))}
          onPointDrag={onDrag}
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
          <button type="button" onClick={() => navigate(-1)} aria-label={pt.comum.voltar} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/75">
            <ChevronLeft size={22} />
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={undo} disabled={!history.length} className={chip}>
              <Undo2 size={16} /> {R.desfazer}
            </button>
            <button type="button" onClick={clear} disabled={!points.length} className={chip} aria-label={R.limpar}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {pos && (
          <button
            type="button"
            onClick={() => setRecenter((r) => ({ n: (r?.n ?? 0) + 1, at: { lat: pos.lat, lon: pos.lon } }))}
            aria-label={R.minhaPosicao}
            className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/75"
          >
            <LocateFixed size={20} />
          </button>
        )}
        {selected !== null && points[selected] && (
          <div className="absolute inset-x-4 bottom-4 mr-14 rounded-2xl border border-[var(--buky-line)] bg-black/85 p-3 backdrop-blur" role="toolbar" aria-label={R.ponto(selected + 1)}>
            <div className="flex items-center justify-between gap-2">
              <b className="text-[15px]">{R.ponto(selected + 1)}</b>
              <div className="flex gap-2">
                <button type="button" onClick={removeSelected} className="flex items-center gap-1 rounded-full bg-[var(--buky-danger)]/15 px-3 py-1.5 text-sm font-semibold text-[var(--buky-danger)]">
                  <Trash2 size={14} /> {R.remover}
                </button>
                <button type="button" onClick={() => setSelected(null)} aria-label={R.fechar} className="rounded-full p-1.5 text-[var(--buky-muted)]">
                  <X size={18} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-[var(--buky-muted)]">{R.inserirDepois(selected + 1)}</p>
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-8 pt-5">
        <h1 className="font-buky text-[36px]">{R.titulo}</h1>
        {tester && <p className="mt-2 rounded-xl bg-[var(--buky-neon-soft)] px-3 py-2 text-xs font-semibold text-[var(--buky-neon)]">{R.modoTeste}</p>}
        <p className="mt-2 text-sm text-[var(--buky-muted)]">{R.instrucao}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[var(--buky-muted)]">
          {R.dicas.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--buky-faint)]">
          {R.regras(rules.minGapM, rules.minLengthM, rules.minPoints, rules.maxPoints)} {R.limiteDiario(rules.dailyCap)}
        </p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--buky-muted)]" aria-label={R.legenda}>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-[#050505] bg-white ring-1 ring-white/40" /> {R.legendaTrazo}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[var(--buky-neon)] shadow-[0_0_0_4px_rgba(57,255,20,0.2)]" /> {R.legendaBuky}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-4">
          <span className="font-buky text-[28px] text-[var(--buky-neon)]">{R.bukys(bukys.length)}</span>
          <span className="font-buky text-[28px]">{fmtKm(check?.lengthM ?? 0)}</span>
        </div>
        {points.length > 1 && check && !check.ok && (
          <ul className="mt-2 space-y-1 text-sm text-[#ffb020]" aria-live="polite">
            {check.problems.map((p) => (
              <li key={p}>{p === "route_too_long" ? R.longaDemais(rules.maxPoints) : R.erros[p]}</li>
            ))}
          </ul>
        )}

        <label className="buky-field mt-5">
          <span>{R.nome}</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={`Rota de ${profile.neighborhood ?? city?.name ?? ""}`.trim()} />
        </label>

        <button type="button" className="buky-btn mt-6" onClick={save} disabled={!check?.ok || saving}>
          {saving ? pt.comum.carregando : R.salvar}
        </button>
      </div>
    </div>
  );
}
