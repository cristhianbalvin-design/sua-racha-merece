/**
 * Controlador del entrenamiento (un solo entrenamiento a la vez en el dispositivo).
 *
 * Flujo: start → (lecturas GPS → motor en vivo → "+1 Buky") → finish → la Edge Function
 * buky-close-session decide y acredita. El conteo en vivo es solo una guía: los Bukys
 * los confirma el servidor.
 *
 * Robustez:
 *  - cada lectura se guarda en el dispositivo (IndexedDB) en lotes;
 *  - si la app se recarga a mitad del entrenamiento, restore() reconstruye el motor con las
 *    lecturas guardadas y vuelve a encender el GPS;
 *  - si al terminar no hay internet, queda "pendiente" y se reenvía al volver la conexión
 *    (el servidor es idempotente: reenviar no duplica Bukys).
 *
 * Reglas del paso 24 (también las aplica el servidor):
 *  - el entrenamiento se cierra solo al cumplir rules.session_max_min (1 h);
 *  - bicicleta: avisos con BikeDetector (velocidad + podómetro si lo hay); al 3.º se corta;
 *  - en vivo solo se cuenta "+1" si el punto no superó 2 Bukys en el entrenamiento y pasaron 3 min.
 */
import { BikeDetector, CollectionEngine, type GpsReading } from "@/features/buky/engine";
import * as api from "../lib/api";
import type { BukyRoute, CloseResult, CompactReading, StopReason } from "../lib/api";
import { DEFAULT_TRAINING_RULES, type TrainingRules } from "./rules";
import { startStepCounter, type StepCounter } from "./stepSource";
import { LiveStats } from "./liveStats";
import { getGpsSource, keepScreenOn, type RawFix } from "./gpsSource";
import * as storage from "./storage";

export type TrainingStatus = "idle" | "starting" | "running" | "closing" | "pending" | "done" | "error";

export interface LivePass {
  pointId: string;
  label: string;
  at: number;
}

export interface TrainingState {
  status: TrainingStatus;
  sessionId: string | null;
  routeId: string | null;
  routeName: string;
  routeKind: "official" | "athlete" | null;
  cityName: string;
  points: api.RoutePoint[];
  path: { lat: number; lon: number }[] | null;
  /** Recorrido hecho, distancia y velocidad en vivo (informativos). */
  track: { lat: number; lon: number }[];
  distanceM: number;
  speedKmh: number | null;
  startedAt: number | null;
  passes: LivePass[];
  /** Puntos visitados en este entrenamiento (para pintar el mapa). */
  visited: string[];
  lastFix: { lat: number; lon: number; accuracy: number; at: number } | null;
  /** Precisión mala o sin lecturas en los últimos 20 s. */
  weakGps: boolean;
  readings: number;
  /** El GPS sigue con la pantalla apagada (app nativa). */
  background: boolean;
  /** Reglas vigentes (límite de tiempo y bicicleta). */
  rules: TrainingRules;
  /** Avisos de bicicleta en este entrenamiento. */
  bikeWarnings: number;
  /** true si hay podómetro (app con permiso); false sin él; null mientras se averigua. */
  steps: boolean | null;
  /** Motivo del cierre automático, si lo hubo. */
  stopReason: StopReason | null;
  result: CloseResult | null;
  error: string | null;
}

const INITIAL: TrainingState = {
  status: "idle",
  sessionId: null,
  routeId: null,
  routeName: "",
  routeKind: null,
  cityName: "",
  points: [],
  path: null,
  track: [],
  distanceM: 0,
  speedKmh: null,
  startedAt: null,
  passes: [],
  visited: [],
  lastFix: null,
  weakGps: false,
  readings: 0,
  background: false,
  rules: DEFAULT_TRAINING_RULES,
  bikeWarnings: 0,
  steps: null,
  stopReason: null,
  result: null,
  error: null,
};

const HEARTBEAT_MS = 30_000;
const FLUSH_EVERY = 10;

function isNetworkError(e: unknown): boolean {
  if (!navigator.onLine) return true;
  const msg = String((e as Error)?.message ?? e).toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed") || msg.includes("fetch");
}

class TrainingController {
  private state: TrainingState = INITIAL;
  private listeners = new Set<() => void>();
  private engine: CollectionEngine | null = null;
  private stopGps: (() => Promise<void>) | null = null;
  private releaseScreen: (() => void) | null = null;
  private buffer: CompactReading[] = [];
  private live = new LiveStats();
  private seq = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private weakTimer: ReturnType<typeof setInterval> | null = null;
  private userId: string | null = null;
  private restored = false;
  private onPass: ((p: LivePass) => void) | null = null;
  private onBike: ((n: number) => void) | null = null;
  private bike: BikeDetector | null = null;
  private steps: StepCounter | null = null;
  /** Bukys contados en vivo por punto (para no mostrar "+1" que el servidor no va a dar). */
  private livePerPoint = new Map<string, number[]>();
  private finishing = false;

  // ---------------------------------------------------------------- store
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;
  private set(patch: Partial<TrainingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /** Avisa a la pantalla en cada pasada nueva (animación "+1 Buky", vibración). */
  setPassListener(fn: ((p: LivePass) => void) | null) {
    this.onPass = fn;
  }

  /** Avisa a la pantalla en cada aviso de bicicleta (n = avisos acumulados). */
  setBikeListener(fn: ((n: number) => void) | null) {
    this.onBike = fn;
  }

  // ---------------------------------------------------------------- ciclo de vida
  async start(userId: string, route: BukyRoute, cityName: string, rules: TrainingRules = DEFAULT_TRAINING_RULES): Promise<void> {
    if (this.state.status === "running" || this.state.status === "starting") return;
    if (route.points.length === 0) throw new Error("route_without_points");
    this.userId = userId;
    const sessionId = crypto.randomUUID();
    this.set({ ...INITIAL, status: "starting", routeName: route.name, cityName });

    try {
      await api.startSession(sessionId, route.id, {
        platform: getGpsSource().kind,
        ua: navigator.userAgent.slice(0, 200),
        app: "buky-web-1",
      });
    } catch (e) {
      this.set({ ...INITIAL, status: "error", error: isNetworkError(e) ? "offline" : (e as Error).message });
      throw e;
    }

    const meta: storage.TrainingMeta = {
      sessionId,
      userId,
      routeId: route.id,
      routeName: route.name,
      routeKind: route.kind,
      cityName,
      points: route.points,
      path: route.path ?? null,
      startedAt: Date.now(),
      phase: "running",
      rules,
    };
    storage.saveMeta(meta);
    await this.beginTracking(meta, []);
  }

  /** Reanuda tras recargar la app: entrenamiento en curso o envío pendiente. */
  async restore(userId: string): Promise<void> {
    if (this.restored) return;
    this.restored = true;
    const meta = storage.loadMeta();
    if (!meta || meta.userId !== userId) return;
    this.userId = userId;
    if (meta.phase === "pending") {
      this.set({
        ...INITIAL,
        status: "pending",
        sessionId: meta.sessionId,
        routeId: meta.routeId,
        routeName: meta.routeName,
        routeKind: meta.routeKind,
        cityName: meta.cityName,
        points: meta.points,
        path: meta.path ?? null,
        startedAt: meta.startedAt,
        rules: meta.rules ?? DEFAULT_TRAINING_RULES,
        bikeWarnings: meta.bikeWarnings ?? 0,
        stopReason: meta.stopReason ?? null,
      });
      void this.sendPending();
      return;
    }
    const readings = await storage.readReadings(meta.sessionId).catch(() => [] as CompactReading[]);
    await this.beginTracking(meta, readings);
  }

  private async beginTracking(meta: storage.TrainingMeta, previous: CompactReading[]) {
    const rules = meta.rules ?? DEFAULT_TRAINING_RULES;
    this.engine = new CollectionEngine(meta.points);
    const labels = new Map(meta.points.map((p) => [p.id, p.label]));
    const passes: LivePass[] = [];
    this.live = new LiveStats();
    this.livePerPoint = new Map();
    this.bike = new BikeDetector({ speedKmh: rules.bike_speed_kmh, windowS: rules.bike_window_s, windowNoStepsS: rules.bike_window_nosteps_s });
    this.bike.warnings = meta.bikeWarnings ?? 0;
    // Reconstruye el estado del motor y el recorrido con lo ya registrado
    for (const r of previous) {
      const res = this.engine.process(toReading(meta.sessionId, r), r[2]);
      if (res.accepted) this.live.add(r[3], r[4], r[1]);
      for (const p of res.passes) {
        if (this.countsLive(p.pointId, p.at, rules)) passes.push({ pointId: p.pointId, label: labels.get(p.pointId) ?? "", at: p.at });
      }
    }
    this.seq = previous.length ? previous[previous.length - 1][0] + 1 : 0;
    this.buffer = [];
    const source = getGpsSource();
    this.set({
      ...INITIAL,
      status: "running",
      sessionId: meta.sessionId,
      routeId: meta.routeId,
      routeName: meta.routeName,
      routeKind: meta.routeKind,
      cityName: meta.cityName,
      points: meta.points,
      path: meta.path ?? null,
      startedAt: meta.startedAt,
      passes,
      visited: [...new Set(passes.map((p) => p.pointId))],
      readings: previous.length,
      background: source.background,
      rules,
      bikeWarnings: this.bike.warnings,
      steps: null,
      ...this.live.snapshot(),
    });

    this.stopGps = await source.start(
      (fix) => this.handleFix(fix, labels),
      (err) => this.set({ error: err, weakGps: true }),
    );
    if (!source.background) this.releaseScreen = await keepScreenOn();
    void startStepCounter().then((c) => {
      if (this.state.status !== "running" || this.state.sessionId !== meta.sessionId) {
        void c?.stop();
        return;
      }
      this.steps = c;
      this.set({ steps: Boolean(c) });
    });

    this.heartbeatTimer = setInterval(() => void this.sendHeartbeat(), HEARTBEAT_MS);
    this.weakTimer = setInterval(() => {
      const f = this.state.lastFix;
      const weak = !f || Date.now() - f.at > 20_000 || f.accuracy > 25;
      if (weak !== this.state.weakGps) this.set({ weakGps: weak });
      // Límite de tiempo: se cierra solo y conserva los Bukys
      if (this.state.status === "running" && this.state.startedAt && Date.now() - this.state.startedAt >= rules.session_max_min * 60_000) {
        void this.finish("time_limit");
      }
    }, 5_000);
  }

  /** Igual que el servidor: máx. N Bukys por punto y M minutos entre ellos (dentro de este entrenamiento). */
  private countsLive(pointId: string, at: number, rules: TrainingRules): boolean {
    const times = this.livePerPoint.get(pointId) ?? [];
    if (times.length >= rules.point_max_per_day) return false;
    const last = times[times.length - 1];
    if (last !== undefined && at - last < rules.point_min_gap_min * 60_000) return false;
    this.livePerPoint.set(pointId, [...times, at]);
    return true;
  }

  private handleFix(fix: RawFix, labels: Map<string, string>) {
    const sessionId = this.state.sessionId;
    if (!sessionId || !this.engine || this.state.status !== "running") return;
    const compact: CompactReading = [
      this.seq++,
      Math.round(fix.fixTime),
      Math.round(fix.receivedAt),
      round6(fix.lat),
      round6(fix.lon),
      Math.round(fix.accuracy * 10) / 10,
      fix.simulated ? 1 : 0,
    ];
    this.buffer.push(compact);
    if (this.buffer.length >= FLUSH_EVERY) void this.flush();

    const res = this.engine.process(toReading(sessionId, compact), fix.receivedAt);
    let snap: ReturnType<LiveStats["snapshot"]> | null = null;
    let warned = false;
    if (res.accepted) {
      this.live.add(fix.lat, fix.lon, fix.fixTime);
      snap = this.live.snapshot();
      warned = this.bike?.update(fix.fixTime, snap.speedKmh, this.steps?.current() ?? null) ?? false;
    }
    const patch: Partial<TrainingState> = {
      ...(snap ?? {}),
      ...(warned ? { bikeWarnings: this.bike!.warnings } : {}),
      lastFix: { lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy, at: fix.receivedAt },
      readings: this.state.readings + 1,
      weakGps: fix.accuracy > 25,
      error: null,
    };
    const rules = this.state.rules;
    const counted = res.passes.filter((p) => this.countsLive(p.pointId, p.at, rules));
    if (counted.length) {
      const newPasses = counted.map((p) => ({ pointId: p.pointId, label: labels.get(p.pointId) ?? "", at: p.at }));
      patch.passes = [...this.state.passes, ...newPasses];
      patch.visited = [...new Set([...this.state.visited, ...newPasses.map((p) => p.pointId)])];
      newPasses.forEach((p) => this.onPass?.(p));
    }
    this.set(patch);
    if (warned) {
      const n = this.bike!.warnings;
      const meta = storage.loadMeta();
      if (meta) storage.saveMeta({ ...meta, bikeWarnings: n });
      this.onBike?.(n);
      if (n >= rules.bike_warnings_to_stop) void this.finish("bike");
    }
  }

  private async flush() {
    const sessionId = this.state.sessionId;
    if (!sessionId || this.buffer.length === 0) return;
    const chunk = this.buffer;
    this.buffer = [];
    try {
      await storage.appendReadings(sessionId, chunk);
    } catch {
      this.buffer = chunk.concat(this.buffer); // reintenta en el próximo lote
    }
  }

  private async sendHeartbeat() {
    const s = this.state;
    if (s.status !== "running" || !s.sessionId) return;
    try {
      await api.heartbeat(s.sessionId, s.passes.length, s.passes.at(-1)?.pointId ?? null);
    } catch {
      /* sin conexión: el latido es informativo */
    }
  }

  private async stopTracking() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.weakTimer) clearInterval(this.weakTimer);
    this.heartbeatTimer = this.weakTimer = null;
    await this.stopGps?.().catch(() => {});
    this.stopGps = null;
    this.releaseScreen?.();
    this.releaseScreen = null;
    await this.steps?.stop().catch(() => {});
    this.steps = null;
    await this.flush();
  }

  /** Terminar (el atleta, el límite de tiempo o la bicicleta): detiene el GPS y envía el recorrido. */
  async finish(reason: StopReason = "user"): Promise<CloseResult | null> {
    if (this.state.status !== "running" || this.finishing) return null;
    this.finishing = true;
    this.set({ stopReason: reason });
    try {
      await this.stopTracking();
    } finally {
      this.finishing = false;
    }
    const meta = storage.loadMeta();
    if (meta) storage.saveMeta({ ...meta, phase: "pending", endedAt: Date.now(), stopReason: reason, bikeWarnings: this.state.bikeWarnings });
    this.set({ status: "pending" });
    return this.sendPending();
  }

  /** Envía el entrenamiento pendiente. Si falla por red, lo deja pendiente y reintenta. */
  async sendPending(): Promise<CloseResult | null> {
    const sessionId = this.state.sessionId;
    if (!sessionId || this.state.status === "closing") return null;
    this.set({ status: "closing", error: null });
    try {
      const readings = await storage.readReadings(sessionId);
      const result = await api.closeSession(sessionId, readings, {
        stop_reason: this.state.stopReason ?? "user",
        bike_warnings: this.state.bikeWarnings,
      });
      storage.saveMeta(null);
      await storage.deleteReadings(sessionId).catch(() => {});
      this.set({ status: "done", result });
      return result;
    } catch (e) {
      const offline = isNetworkError(e);
      this.set({ status: "pending", error: offline ? "offline" : (e as api.BukyApiError).code ?? "close_failed" });
      if (offline) window.addEventListener("online", () => void this.sendPending(), { once: true });
      return null;
    }
  }

  /** Vuelve al estado inicial después de ver el resumen. */
  reset() {
    if (this.state.status === "done" || this.state.status === "error") this.set(INITIAL);
  }
}

function round6(x: number) {
  return Math.round(x * 1e6) / 1e6;
}

function toReading(sessionId: string, r: CompactReading): GpsReading {
  return {
    id: `${sessionId}:${r[0]}`,
    sessionId,
    seq: r[0],
    fixTime: r[1],
    receivedAt: r[2],
    lat: r[3],
    lon: r[4],
    accuracy: r[5],
    speed: null,
    altitude: null,
    bearing: null,
    simulated: r[6] === 1,
  };
}

export const training = new TrainingController();
