import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { BukyPoint, GpsReading } from "./types";

/**
 * Guarda las lecturas en un archivo del teléfono, fuera de la interfaz, para que
 * no se pierdan aunque la pantalla esté apagada o la app se cierre.
 * Formato: una línea JSON por registro (JSONL).
 */

const DIR = "buky-gps";
const INDEX = `${DIR}/sessions.json`;

export type LogEntry =
  | { kind: "reading"; reading: GpsReading }
  | { kind: "event"; at: number; name: string; detail?: string };

export interface SessionMeta {
  id: string;
  scenario: string;
  note: string;
  startedAt: number;
  stoppedAt: number | null;
  /** true si la app se cerró sin tocar Detener. */
  interrupted: boolean;
  batteryStart: number | null;
  batteryEnd: number | null;
  points: BukyPoint[];
  /** Intervalo pedido al GPS (ms). Ausente en sesiones de la versión 0.1 (= 1000). */
  intervalMs?: number;
  device: Record<string, unknown>;
  appVersion: string;
}

const sessionFile = (id: string) => `${DIR}/${id}.jsonl`;

async function readText(path: string): Promise<string | null> {
  try {
    const res = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
    return typeof res.data === "string" ? res.data : await (res.data as Blob).text();
  } catch {
    return null;
  }
}

async function writeText(path: string, data: string): Promise<void> {
  await Filesystem.writeFile({ path, data, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
}

export async function listSessions(): Promise<SessionMeta[]> {
  const raw = await readText(INDEX);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SessionMeta[];
  } catch {
    return [];
  }
}

async function saveIndex(sessions: SessionMeta[]): Promise<void> {
  await writeText(INDEX, JSON.stringify(sessions));
}

export async function upsertSession(meta: SessionMeta): Promise<void> {
  const all = await listSessions();
  const i = all.findIndex((s) => s.id === meta.id);
  if (i >= 0) all[i] = meta;
  else all.unshift(meta);
  await saveIndex(all);
}

export async function createSessionFile(id: string): Promise<void> {
  await writeText(sessionFile(id), "");
}

/** Buffer en memoria que se vuelca al archivo por lotes. */
export class SessionWriter {
  private buffer: string[] = [];
  private flushing: Promise<void> = Promise.resolve();

  constructor(private readonly sessionId: string, private readonly batchSize = 5) {}

  push(entry: LogEntry): void {
    this.buffer.push(JSON.stringify(entry));
    if (this.buffer.length >= this.batchSize) void this.flush();
  }

  flush(): Promise<void> {
    if (this.buffer.length === 0) return this.flushing;
    const chunk = this.buffer.join("\n") + "\n";
    this.buffer = [];
    this.flushing = this.flushing.then(() =>
      Filesystem.appendFile({
        path: sessionFile(this.sessionId),
        data: chunk,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      }).catch((err) => console.error("[buky] no se pudo guardar el lote", err)),
    );
    return this.flushing;
  }
}

export async function readSession(id: string): Promise<{ readings: GpsReading[]; events: Extract<LogEntry, { kind: "event" }>[] }> {
  const raw = (await readText(sessionFile(id))) ?? "";
  const readings: GpsReading[] = [];
  const events: Extract<LogEntry, { kind: "event" }>[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry.kind === "reading") readings.push(entry.reading);
      else events.push(entry);
    } catch {
      // línea cortada por un cierre brusco: se ignora
    }
  }
  readings.sort((a, b) => a.seq - b.seq);
  return { readings, events };
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path: sessionFile(id), directory: Directory.Data });
  } catch {
    /* ya no existía */
  }
  await saveIndex((await listSessions()).filter((s) => s.id !== id));
}

/** Escribe un archivo temporal para compartir y devuelve su URI. */
export async function writeExportFile(name: string, data: string): Promise<string> {
  const res = await Filesystem.writeFile({
    path: `buky-export/${name}`,
    data,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  return res.uri;
}
