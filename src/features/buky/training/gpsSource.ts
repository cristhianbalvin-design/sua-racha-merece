/**
 * Fuente de posiciones GPS. En la web usa el GPS del navegador (solo con la pantalla
 * encendida). En la app nativa (Capacitor) se registra la fuente en segundo plano probada
 * en la prueba de octubre (plugin background-geolocation), que sigue con la pantalla apagada.
 */

export interface RawFix {
  lat: number;
  lon: number;
  accuracy: number;
  speed: number | null;
  simulated: boolean;
  /** Momento en que el GPS produjo la posición (ms). */
  fixTime: number;
  /** Momento en que la app la recibió (ms). */
  receivedAt: number;
}

export interface GpsSource {
  kind: "web" | "native";
  /** true si sigue registrando con la pantalla apagada. */
  background: boolean;
  start(onFix: (fix: RawFix) => void, onError: (message: string) => void): Promise<() => Promise<void>>;
  /** Abre los ajustes del sistema para dar permiso de ubicación (solo nativo). */
  openSettings?: () => Promise<void>;
}

let nativeSource: GpsSource | null = null;

/** La app nativa llama a esto al arrancar (fase de empaquetado). */
export function registerNativeGpsSource(source: GpsSource): void {
  nativeSource = source;
}

export const webGpsSource: GpsSource = {
  kind: "web",
  background: false,
  async start(onFix, onError) {
    if (!("geolocation" in navigator)) {
      onError("geolocation_unavailable");
      return async () => {};
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        onFix({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          simulated: false,
          fixTime: pos.timestamp,
          receivedAt: Date.now(),
        });
      },
      (err) => onError(err.code === err.PERMISSION_DENIED ? "permission_denied" : "position_unavailable"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
    return async () => navigator.geolocation.clearWatch(id);
  },
};

export function getGpsSource(): GpsSource {
  return nativeSource ?? webGpsSource;
}

/** Mantiene la pantalla encendida en el navegador mientras dura el entrenamiento. */
export async function keepScreenOn(): Promise<() => void> {
  const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
  if (!nav.wakeLock) return () => {};
  let lock: { release(): Promise<void> } | null = null;
  const acquire = async () => {
    try {
      lock = await nav.wakeLock!.request("screen");
    } catch {
      /* el navegador lo negó (batería baja, pestaña oculta) */
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") void acquire();
  };
  await acquire();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release().catch(() => {});
  };
}
