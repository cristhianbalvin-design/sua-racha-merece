import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Device } from "@capacitor/device";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Share } from "@capacitor/share";
import { openAppSettings, startBackgroundTracking, type TrackerHandle } from "../gps/backgroundTracker";
import {
  createSessionFile,
  deleteSession,
  listSessions,
  readSession,
  SessionWriter,
  upsertSession,
  writeExportFile,
  type SessionMeta,
} from "../gps/readingStore";
import { toGpx } from "../gps/exportFormats";
import type { BukyPoint, GpsReading } from "../gps/types";
import { CollectionEngine, replayPasses, type PassEvent } from "../engine/collectionEngine";
import { computeCoverage, type CoverageReport } from "../engine/coverage";

/**
 * Pantalla de PRUEBA del GPS en segundo plano (Android). Es desechable: lo que se
 * reutiliza está en ../gps y ../engine. Solo se carga dentro de la app nativa.
 */

const SPIKE_VERSION = "0.1";
const POINTS_KEY = "buky-spike-points";
const ACTIVE_KEY = "buky-spike-active-session";

const SCENARIOS: { id: string; label: string }[] = [
  { id: "A", label: "A · 30 min pantalla apagada, en el bolsillo" },
  { id: "B", label: "B · Usando otras apps (música, WhatsApp)" },
  { id: "C", label: "C · Con ahorro de batería activado" },
  { id: "D", label: "D · Quieto 5 min y luego moverse" },
  { id: "E", label: "E · Cerrar la app desde recientes" },
  { id: "F", label: "F · Modo avión unos minutos" },
  { id: "X", label: "Otro / prueba libre" },
];

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeSet = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: no es crítico */
  }
};

const loadPoints = (): BukyPoint[] => {
  try {
    return JSON.parse(safeGet(POINTS_KEY) ?? "[]") as BukyPoint[];
  } catch {
    return [];
  }
};

const fmtDuration = (ms: number | null | undefined) => {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};
const fmtTime = (t: number) => new Date(t).toLocaleTimeString("es-PE", { hour12: false });
const fmtDate = (t: number) => new Date(t).toLocaleString("es-PE", { hour12: false });
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)} %`);

async function batteryLevel(): Promise<number | null> {
  try {
    const info = await Device.getBatteryInfo();
    return info.batteryLevel != null ? Math.round(info.batteryLevel * 100) : null;
  } catch {
    return null;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" | "warn" }) {
  const color =
    tone === "ok" ? "text-primary" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function ReportView({ report }: { report: CoverageReport }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Cobertura (meta ≥ 95 %)" value={pct(report.coveragePct)} tone={report.coveragePct >= 95 ? "ok" : "bad"} />
      <Stat label="Hueco máximo (meta ≤ 20 s)" value={fmtDuration(report.maxGapMs)} tone={report.maxGapMs <= 20_000 ? "ok" : "bad"} />
      <Stat label="Lecturas" value={String(report.readings)} />
      <Stat label="Huecos > 20 s" value={String(report.gaps.length)} tone={report.gaps.length ? "bad" : "ok"} />
      <Stat label="Arranque del GPS" value={fmtDuration(report.timeToFirstFixMs)} />
      <Stat label="Duración medida" value={fmtDuration(report.durationMs)} />
      <Stat label="Lecturas precisas (≤ 25 m)" value={pct(report.accurateReadingsPct)} />
      <Stat label="Precisión mediana" value={report.medianAccuracyM == null ? "—" : `${report.medianAccuracyM.toFixed(0)} m`} />
      <Stat label="Retraso de entrega p95" value={fmtDuration(report.deliveryDelayMs.p95)} />
      <Stat
        label="Ubicaciones simuladas"
        value={String(report.simulatedReadings)}
        tone={report.simulatedReadings ? "warn" : undefined}
      />
    </div>
  );
}

interface SessionResult {
  report: CoverageReport;
  passes: PassEvent[];
  events: { at: number; name: string; detail?: string }[];
}

export default function SpikeApp() {
  const [points, setPoints] = useState<BukyPoint[]>(loadPoints);
  const [scenario, setScenario] = useState("A");
  const [note, setNote] = useState("");
  const [radius, setRadius] = useState(50);
  const [manualPoints, setManualPoints] = useState("");

  const [active, setActive] = useState<SessionMeta | null>(null);
  const [readings, setReadings] = useState<GpsReading[]>([]);
  const [passes, setPasses] = useState<PassEvent[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [results, setResults] = useState<Record<string, SessionResult>>({});
  const [message, setMessage] = useState<string | null>(null);

  const trackerRef = useRef<TrackerHandle | null>(null);
  const writerRef = useRef<SessionWriter | null>(null);
  const engineRef = useRef<CollectionEngine | null>(null);
  const seqRef = useRef(0);
  const activeRef = useRef<SessionMeta | null>(null);

  useEffect(() => {
    safeSet(POINTS_KEY, JSON.stringify(points));
    engineRef.current = new CollectionEngine(points);
  }, [points]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshSessions = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

  // Al abrir: si había una sesión sin cerrar, la app se cerró a mitad (escenario E).
  useEffect(() => {
    (async () => {
      const all = await listSessions();
      const dangling = all.filter((s) => s.stoppedAt == null);
      for (const s of dangling) {
        const { readings: rs } = await readSession(s.id);
        const last = rs.length ? rs[rs.length - 1].fixTime : s.startedAt;
        await upsertSession({ ...s, stoppedAt: last, interrupted: true });
      }
      if (dangling.length) {
        setMessage(
          `La app se cerró durante ${dangling.length === 1 ? "una sesión" : `${dangling.length} sesiones`}. ` +
            "Quedó marcada como interrumpida; revisa su resultado abajo.",
        );
      }
      safeSet(ACTIVE_KEY, null);
      await refreshSessions();
    })();
  }, [refreshSessions]);

  // Registrar cuándo la app pasa a segundo plano y vuelve.
  useEffect(() => {
    const onVis = () => {
      const w = writerRef.current;
      if (!w) return;
      w.push({ kind: "event", at: Date.now(), name: document.hidden ? "app_hidden" : "app_visible" });
      if (document.hidden) void w.flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const start = async () => {
    setBusy(true);
    setLastError(null);
    setMessage(null);
    try {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") await LocalNotifications.requestPermissions();
      } catch {
        /* sin permiso de notificaciones el GPS sigue, pero la notificación no se ve */
      }
      const id = crypto.randomUUID();
      let device: Record<string, unknown> = {};
      try {
        const info = await Device.getInfo();
        device = {
          manufacturer: info.manufacturer,
          model: info.model,
          osVersion: info.osVersion,
          webViewVersion: info.webViewVersion,
        };
      } catch {
        /* opcional */
      }
      const meta: SessionMeta = {
        id,
        scenario,
        note,
        startedAt: Date.now(),
        stoppedAt: null,
        interrupted: false,
        batteryStart: await batteryLevel(),
        batteryEnd: null,
        points,
        device,
        appVersion: SPIKE_VERSION,
      };
      await createSessionFile(id);
      await upsertSession(meta);
      safeSet(ACTIVE_KEY, id);

      const writer = new SessionWriter(id);
      writer.push({ kind: "event", at: meta.startedAt, name: "session_start" });
      writerRef.current = writer;
      engineRef.current = new CollectionEngine(points);
      seqRef.current = 0;
      activeRef.current = meta;
      setReadings([]);
      setPasses([]);
      setActive(meta);

      trackerRef.current = await startBackgroundTracking(
        (fix) => {
          const reading: GpsReading = { id: crypto.randomUUID(), sessionId: id, seq: seqRef.current++, ...fix };
          writer.push({ kind: "reading", reading });
          const res = engineRef.current?.process(reading);
          if (res?.passes.length) {
            setPasses((p) => [...p, ...res.passes]);
            for (const pass of res.passes) writer.push({ kind: "event", at: pass.at, name: "pass", detail: pass.pointId });
          }
          setReadings((rs) => [...rs, reading]);
        },
        (error) => {
          setLastError(`${error.code ?? "ERROR"}: ${error.message}`);
          writer.push({ kind: "event", at: Date.now(), name: "error", detail: `${error.code ?? ""} ${error.message}` });
          if (error.code === "NOT_AUTHORIZED") {
            setMessage("Falta el permiso de ubicación. Ábrelo en Ajustes y elige \"Permitir siempre\" o \"Mientras se usa\".");
          }
        },
      );
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await trackerRef.current?.stop();
      trackerRef.current = null;
      const meta = activeRef.current;
      const writer = writerRef.current;
      if (meta && writer) {
        const stoppedAt = Date.now();
        writer.push({ kind: "event", at: stoppedAt, name: "session_stop" });
        await writer.flush();
        await upsertSession({ ...meta, points, stoppedAt, batteryEnd: await batteryLevel() });
        await loadResult(meta.id);
      }
      writerRef.current = null;
      activeRef.current = null;
      safeSet(ACTIVE_KEY, null);
      setActive(null);
      await refreshSessions();
    } finally {
      setBusy(false);
    }
  };

  const loadResult = async (id: string) => {
    const meta = (await listSessions()).find((s) => s.id === id);
    if (!meta) return;
    const { readings: rs, events } = await readSession(id);
    const end = meta.stoppedAt ?? (rs.length ? rs[rs.length - 1].fixTime : meta.startedAt);
    const report = computeCoverage(rs, meta.startedAt, end);
    const { passes: ps } = replayPasses(meta.points, rs);
    setResults((r) => ({ ...r, [id]: { report, passes: ps, events } }));
  };

  const exportSession = async (meta: SessionMeta) => {
    try {
      const { readings: rs, events } = await readSession(meta.id);
      const end = meta.stoppedAt ?? (rs.length ? rs[rs.length - 1].fixTime : meta.startedAt);
      const report = computeCoverage(rs, meta.startedAt, end);
      const replay = replayPasses(meta.points, rs);
      const stamp = new Date(meta.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const base = `buky-gps-${meta.scenario}-${stamp}`;
      const json = JSON.stringify({ meta, report, passes: replay.passes, rejected: replay.rejected, events, readings: rs }, null, 1);
      const jsonUri = await writeExportFile(`${base}.json`, json);
      const gpxUri = await writeExportFile(`${base}.gpx`, toGpx(base, rs));
      await Share.share({ title: base, text: `Prueba GPS Buky · escenario ${meta.scenario}`, files: [jsonUri, gpxUri] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(msg)) setMessage(`No se pudo exportar: ${msg}`);
    }
  };

  const removeSession = async (id: string) => {
    await deleteSession(id);
    setResults((r) => {
      const copy = { ...r };
      delete copy[id];
      return copy;
    });
    await refreshSessions();
  };

  const last = readings.length ? readings[readings.length - 1] : null;
  const live = useMemo(
    () => (active ? computeCoverage(readings, active.startedAt, now) : null),
    [active, readings, now],
  );

  const markHere = () => {
    if (!last) {
      setMessage("Todavía no hay lecturas. Inicia el registro y espera la primera posición.");
      return;
    }
    if (last.accuracy > 25 || now - last.fixTime > 30_000) {
      setMessage(`La última lectura no es fiable (precisión ${last.accuracy.toFixed(0)} m). Espera una mejor señal.`);
      return;
    }
    const n = points.length + 1;
    setPoints((ps) => [...ps, { id: `P${n}`, label: `Punto ${n}`, lat: last.lat, lon: last.lon, radiusM: radius }]);
    setMessage(`Punto ${n} marcado (precisión ${last.accuracy.toFixed(0)} m).`);
  };

  const addManual = () => {
    const parsed: BukyPoint[] = [];
    for (const line of manualPoints.split("\n")) {
      const m = line.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
      if (!m) continue;
      const n = points.length + parsed.length + 1;
      parsed.push({ id: `P${n}`, label: `Punto ${n}`, lat: Number(m[1]), lon: Number(m[2]), radiusM: radius });
    }
    if (!parsed.length) {
      setMessage("Escribe un punto por línea con el formato: latitud, longitud");
      return;
    }
    setPoints((ps) => [...ps, ...parsed]);
    setManualPoints("");
  };

  const passesByPoint = (ps: PassEvent[]) =>
    ps.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.pointId]: (acc[p.pointId] ?? 0) + 1 }), {});
  const livePassCount = passesByPoint(passes);

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-4 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <header>
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">3BUK · Buky</div>
        <h1 className="text-2xl font-bold">Prueba de GPS en segundo plano</h1>
        <p className="text-xs text-muted-foreground">Versión de prueba {SPIKE_VERSION}. No envía nada a internet.</p>
      </header>

      {message && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}

      <Card title="Registro">
        {!active ? (
          <div className="space-y-3">
            <label className="block text-sm">
              Escenario
              <select
                className="mt-1 w-full rounded-lg border border-border bg-muted p-2 text-sm"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Nota (opcional)
              <input
                className="mt-1 w-full rounded-lg border border-border bg-muted p-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej.: trote por la costanera, Buky nativo también encendido"
              />
            </label>
            <button
              disabled={busy}
              onClick={start}
              className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              INICIAR REGISTRO
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-primary">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" /> REGISTRANDO · {active.scenario}
              </span>
              <span className="tabular-nums">{fmtDuration(now - active.startedAt)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Lecturas" value={String(readings.length)} />
              <Stat
                label="Última lectura hace"
                value={last ? fmtDuration(now - last.fixTime) : "esperando señal…"}
                tone={last && now - last.fixTime > 20_000 ? "bad" : undefined}
              />
              <Stat
                label="Precisión actual"
                value={last ? `${last.accuracy.toFixed(0)} m` : "—"}
                tone={last ? (last.accuracy <= 25 ? "ok" : "warn") : undefined}
              />
              <Stat label="Pasadas detectadas" value={String(passes.length)} tone={passes.length ? "ok" : undefined} />
              <Stat label="Cobertura en vivo" value={pct(live?.coveragePct)} />
              <Stat label="Hueco máximo" value={fmtDuration(live?.maxGapMs)} tone={live && live.maxGapMs > 20_000 ? "bad" : undefined} />
            </div>
            {lastError && <p className="text-sm text-destructive">{lastError}</p>}
            <p className="text-xs text-muted-foreground">
              Ya puedes apagar la pantalla y guardar el celular. Al volver, toca Detener.
            </p>
            <button
              disabled={busy}
              onClick={stop}
              className="w-full rounded-xl bg-destructive py-4 text-lg font-bold text-destructive-foreground disabled:opacity-50"
            >
              DETENER
            </button>
          </div>
        )}
      </Card>

      <Card title={`Puntos de prueba (${points.length})`}>
        <p className="mb-3 text-xs text-muted-foreground">
          Opcional. Sirven para comprobar que se detectan las pasadas igual que en Buky (2 lecturas dentro del radio;
          para volver a contar hay que alejarse a más de radio + 10 m).
        </p>
        <div className="mb-3 flex items-center gap-2 text-sm">
          Radio
          <input
            type="number"
            min={20}
            max={200}
            value={radius}
            onChange={(e) => setRadius(Math.min(200, Math.max(20, Number(e.target.value) || 50)))}
            className="w-20 rounded-lg border border-border bg-muted p-2"
          />
          m
          <button onClick={markHere} className="ml-auto rounded-lg border border-primary px-3 py-2 text-primary">
            Marcar punto aquí
          </button>
        </div>
        <textarea
          value={manualPoints}
          onChange={(e) => setManualPoints(e.target.value)}
          rows={2}
          placeholder={"O pega puntos, uno por línea:\n-22.9035, -43.1153"}
          className="w-full rounded-lg border border-border bg-muted p-2 text-sm"
        />
        <button onClick={addManual} className="mt-2 rounded-lg border border-border px-3 py-2 text-sm">
          Añadir puntos
        </button>
        {points.length > 0 && (
          <ul className="mt-3 divide-y divide-border text-sm">
            {points.map((p) => {
              const st = engineRef.current?.stateOf(p.id);
              return (
                <li key={p.id} className="flex items-center gap-2 py-2">
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.lat.toFixed(5)}, {p.lon.toFixed(5)} · {p.radiusM} m
                  </span>
                  {active && (
                    <span className="ml-auto text-xs">
                      {st?.state === "VISITED" ? "Dentro ✓" : st?.state === "CONFIRMING" ? "Entrando…" : "Fuera"}
                      {st?.distanceM != null && ` · ${st.distanceM.toFixed(0)} m`} · {livePassCount[p.id] ?? 0}
                    </span>
                  )}
                  {!active && (
                    <button
                      className="ml-auto text-xs text-destructive"
                      onClick={() => setPoints((ps) => ps.filter((x) => x.id !== p.id))}
                    >
                      Quitar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Preparar el teléfono">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Permiso de ubicación: elige “Mientras se usa la app” (o “Permitir siempre”) y ubicación precisa.</li>
          <li>Permite las notificaciones: la notificación fija es la que mantiene vivo el GPS.</li>
          <li>Ajustes › Aplicaciones › 3BUK › Batería › “Sin restricciones”.</li>
          <li>Desactiva el ahorro de energía (salvo en el escenario C).</li>
        </ol>
        <button onClick={() => void openAppSettings()} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">
          Abrir ajustes de la app
        </button>
      </Card>

      <Card title={`Sesiones guardadas (${sessions.length})`}>
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay sesiones.</p>}
        <ul className="space-y-3">
          {sessions
            .filter((s) => s.id !== active?.id)
            .map((s) => {
              const res = results[s.id];
              const passCounts = res ? passesByPoint(res.passes) : {};
              return (
                <li key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        Escenario {s.scenario}
                        {s.interrupted && <span className="ml-2 text-xs text-accent">interrumpida</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(s.startedAt)} · {fmtDuration((s.stoppedAt ?? s.startedAt) - s.startedAt)}
                        {s.batteryStart != null && s.batteryEnd != null && ` · batería ${s.batteryStart}% → ${s.batteryEnd}%`}
                      </div>
                      {s.note && <div className="text-xs">{s.note}</div>}
                    </div>
                    {res && (
                      <span
                        className={`rounded px-2 py-1 text-xs font-bold ${
                          res.report.passesCriteria ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                        }`}
                      >
                        {res.report.passesCriteria ? "PASA" : "NO PASA"}
                      </span>
                    )}
                  </div>
                  {res && (
                    <div className="mt-3 space-y-2">
                      <ReportView report={res.report} />
                      {s.points.length > 0 && (
                        <div className="text-xs">
                          Pasadas: {res.passes.length} ·{" "}
                          {s.points.map((p) => `${p.label}: ${passCounts[p.id] ?? 0}`).join(" · ")}
                        </div>
                      )}
                      {res.report.gaps.length > 0 && (
                        <div className="text-xs text-destructive">
                          Huecos: {res.report.gaps.map((g) => `${fmtTime(g.fromMs)} (${fmtDuration(g.durationMs)})`).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {!res && (
                      <button onClick={() => void loadResult(s.id)} className="rounded-lg border border-border px-3 py-2 text-sm">
                        Ver resultado
                      </button>
                    )}
                    <button
                      onClick={() => void exportSession(s)}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Exportar
                    </button>
                    <button onClick={() => void removeSession(s.id)} className="ml-auto px-2 text-xs text-destructive">
                      Borrar
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      </Card>
    </div>
  );
}
