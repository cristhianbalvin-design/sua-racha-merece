/**
 * Guarda el entrenamiento en el dispositivo para que no se pierda si la app se recarga,
 * se cierra o no hay internet al terminar:
 *  - las lecturas GPS van a IndexedDB (una fila por lectura, en lotes);
 *  - los datos del entrenamiento en curso o pendiente de envío, a localStorage.
 */
import type { CompactReading } from "../lib/api";
import type { RoutePoint } from "../lib/api";

const DB_NAME = "buky-training";
const STORE = "readings";
const META_KEY = "buky.training.v1";

export interface TrainingMeta {
  sessionId: string;
  userId: string;
  routeId: string;
  routeName: string;
  routeKind: "official" | "athlete";
  cityName: string;
  points: RoutePoint[];
  startedAt: number;
  /** running: registrando; pending: terminado, falta enviarlo al servidor. */
  phase: "running" | "pending";
  endedAt?: number;
}

export function loadMeta(): TrainingMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as TrainingMeta) : null;
  } catch {
    return null;
  }
}

export function saveMeta(meta: TrainingMeta | null): void {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {
    /* almacenamiento lleno o bloqueado: el entrenamiento sigue en memoria */
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // clave: [sessionId, seq]
        db.createObjectStore(STORE, { keyPath: ["s", "q"] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** Guarda un lote de lecturas compactas de una sesión. */
export async function appendReadings(sessionId: string, readings: CompactReading[]): Promise<void> {
  if (readings.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const r of readings) store.put({ s: sessionId, q: r[0], r });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function readReadings(sessionId: string): Promise<CompactReading[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const range = IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity]);
    const req = tx.objectStore(STORE).getAll(range);
    req.onsuccess = () => resolve((req.result as { r: CompactReading }[]).map((x) => x.r).sort((a, b) => a[0] - b[0]));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReadings(sessionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity]));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
