/**
 * GPS en segundo plano de la app nativa (Capacitor). Es el mismo plugin y configuración
 * validados en la prueba de octubre de 2026 (Android 33 min / 99,8 % de cobertura;
 * iPhone 41 min / 100 %, con la pantalla apagada).
 *
 * En Android el plugin levanta un servicio en primer plano con una notificación fija:
 * es lo que mantiene el GPS con la pantalla apagada. En iPhone usa el modo de ubicación
 * en segundo plano declarado en Info.plist.
 */
import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, CallbackError, Location } from "@capacitor-community/background-geolocation";
import type { GpsSource } from "../training/gpsSource";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

/** 1 lectura por segundo: lo que espera el motor del servidor (≈2.400 lecturas en 40 min). */
const INTERVAL_MS = 1000;

export const nativeGpsSource: GpsSource = {
  kind: "native",
  background: true,
  async start(onFix, onError) {
    const id = await BackgroundGeolocation.addWatcher(
      {
        // intervalMs lo agrega el parche de patches/ (el plugin original fija 1 s).
        ...({ intervalMs: INTERVAL_MS } as object),
        backgroundTitle: "Buky está contando seu treino",
        backgroundMessage: "Toque para voltar ao app.",
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      },
      (location?: Location, error?: CallbackError) => {
        const receivedAt = Date.now();
        if (error) {
          onError(error.code === "NOT_AUTHORIZED" ? "permission_denied" : "position_unavailable");
          return;
        }
        if (!location) return;
        onFix({
          lat: location.latitude,
          lon: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed ?? null,
          simulated: Boolean(location.simulated),
          fixTime: location.time ?? receivedAt,
          receivedAt,
        });
      },
    );
    return () => BackgroundGeolocation.removeWatcher({ id });
  },
  openSettings: () => BackgroundGeolocation.openSettings(),
};
