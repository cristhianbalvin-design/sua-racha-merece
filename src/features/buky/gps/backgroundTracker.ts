import { registerPlugin } from "@capacitor/core";
import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location,
} from "@capacitor-community/background-geolocation";

/**
 * Envoltorio del plugin de GPS en segundo plano. Es la única pieza que habla con
 * el plugin: si se cambia de plugin, solo cambia este archivo.
 */
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export interface RawFix {
  lat: number;
  lon: number;
  accuracy: number;
  speed: number | null;
  altitude: number | null;
  bearing: number | null;
  simulated: boolean;
  fixTime: number;
  receivedAt: number;
}

export interface TrackerHandle {
  stop: () => Promise<void>;
}

export interface TrackerOptions {
  /** Cada cuánto pide una posición al GPS. Buky nativo usaba 4000 ms. */
  intervalMs: number;
  /** false: solo con la app abierta, sin notificación (para ubicarse antes de empezar). */
  background?: boolean;
}

export async function startBackgroundTracking(
  onFix: (fix: RawFix) => void,
  onError: (error: CallbackError) => void,
  options: TrackerOptions = { intervalMs: 1000 },
): Promise<TrackerHandle> {
  const id = await BackgroundGeolocation.addWatcher(
    {
      // `intervalMs` lo agrega el parche de patches/ (el plugin original fija 1 s).
      ...({ intervalMs: options.intervalMs } as object),
      // Con backgroundMessage el plugin levanta un servicio en primer plano con
      // notificación persistente: es lo que mantiene el GPS con la pantalla apagada.
      ...(options.background === false
        ? {}
        : { backgroundTitle: "Buky está registrando tu recorrido", backgroundMessage: "Toca para volver a la app." }),
      requestPermissions: true,
      stale: false,
      distanceFilter: 0,
    },
    (location?: Location, error?: CallbackError) => {
      const receivedAt = Date.now();
      if (error) {
        onError(error);
        return;
      }
      if (!location) return;
      onFix({
        lat: location.latitude,
        lon: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed ?? null,
        altitude: location.altitude ?? null,
        bearing: location.bearing ?? null,
        simulated: Boolean(location.simulated),
        fixTime: location.time ?? receivedAt,
        receivedAt,
      });
    },
  );
  return {
    stop: () => BackgroundGeolocation.removeWatcher({ id }),
  };
}

export function openAppSettings(): Promise<void> {
  return BackgroundGeolocation.openSettings();
}
