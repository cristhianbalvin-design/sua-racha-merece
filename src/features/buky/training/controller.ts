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
 */
import { CollectionEngine, type GpsReading } from "@/features/buky/engine";
import * as api from "../lib/api";
import type { BukyRoute, CloseResult, CompactReading } from "../lib/api";
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
  startedAt: null,
  passes: [],
  visited: [],
  lastFix: null,
  weakGps: false,
  readings: 0,
  background: false,
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
  private seq = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private weakTimer: ReturnType<typeof setInterval> | null = null;
  private userId: string | null = null;
  private restored = false;
  private onPass: ((p: LivePass) => void) | null = null;

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

  // ---------------------------------------------------------------- ciclo de vida
  async start(userId: string, route: BukyRoute, cityName: string): Promise<void> {
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
      startedAt: Date.now(),
      phase: "running",
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
        startedAt: meta.startedAt,
      });
      void this.sendPending();
      return;
    }
    const readings = await storage.readReadings(meta.sessionId).catch(() => [] as CompactReading[]);
    await this.beginTracking(meta, readings);
  }

  private async beginTracking(meta: storage.TrainingMeta, previous: CompactReading[]) {
    this.engine = new CollectionEngine(meta.points);
    const labels = new Map(meta.points.map((p) => [p.id, p.label]));
    const passes: LivePass[] = [];
    // Reconstruye el estado del motor con lo ya registrado
    for (const r of previous) {
      for (const p of this.engine.process(toReading(meta.sessionId, r), r[2]).passes) {
        passes.push({ pointId: p.pointId, label: labels.get(p.pointId) ?? "", at: p.at });
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
      startedAt: meta.startedAt,
      passes,
      visited: [...new Set(passes.map((p) => p.pointId))],
      readings: previous.length,
      background: source.background,
    });

    this.stopGps = await source.start(
      (fix) => this.handleFix(fix, labels),
      (err) => this.set({ error: err, weakGps: true }),
    );
    if (!source.background) this.releaseScreen = await keepScreenOn();

    this.heartbeatTimer = setInterval(() => void this.sendHeartbeat(), HEARTBEAT_MS);
    this.weakTimer = setInterval(() => {
      const f = this.state.lastFix;
      const weak = !f || Date.now() - f.at > 20_000 || f.accuracy > 25;
      if (weak !== this.state.weakGps) this.set({ weakGps: weak });
    }, 5_000);
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
    const patch: Partial<TrainingState> = {
      lastFix: { lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy, at: fix.receivedAt },
      readings: this.state.readings + 1,
      weakGps: fix.accuracy > 25,
      error: null,
    };
    if (res.passes.length) {
      const newPasses = res.passes.map((p) => ({ pointId: p.pointId, label: labels.get(p.pointId) ?? "", at: p.at }));
      patch.passes = [...this.state.passes, ...newPasses];
      patch.visited = [...new Set([...this.state.visited, ...newPasses.map((p) => p.pointId)])];
      newPasses.forEach((p) => this.onPass?.(p));
    }
    this.set(patch);
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
    await this.flush();
  }

  /** Terminar: detiene el GPS y envía el recorrido al servidor. */
  async finish(): Promise<CloseResult | null> {
    if (this.state.status !== "running") return null;
    await this.stopTracking();
    const meta = storage.loadMeta();
    if (meta) storage.saveMeta({ ...meta, phase: "pending", endedAt: Date.now() });
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
      const result = await api.closeSession(sessionId, readings);
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
