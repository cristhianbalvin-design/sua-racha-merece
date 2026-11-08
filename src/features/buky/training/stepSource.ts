/**
 * Contador de pasos para detectar bicicleta (paso 24). Solo existe en la app instalada
 * (Android: permiso ACTIVITY_RECOGNITION; iPhone: permiso de movimiento). En la web, o si el
 * atleta no da el permiso, devuelve null y la detección usa solo la velocidad (ventana más larga).
 */
import { Capacitor } from "@capacitor/core";

export interface StepCounter {
  /** Pasos acumulados desde que empezó; null si todavía no llegó ninguna medición. */
  current(): number | null;
  stop(): Promise<void>;
}

export async function startStepCounter(): Promise<StepCounter | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { CapacitorPedometer } = await import("@capgo/capacitor-pedometer");
    const avail = await CapacitorPedometer.isAvailable();
    if (!avail.stepCounting) return null;
    let perm = await CapacitorPedometer.checkPermissions();
    if (perm.activityRecognition !== "granted") perm = await CapacitorPedometer.requestPermissions();
    if (perm.activityRecognition !== "granted") return null;
    let base: number | null = null;
    let steps: number | null = null;
    const handle = await CapacitorPedometer.addListener("measurement", (m) => {
      if (typeof m.numberOfSteps !== "number") return;
      if (base === null) base = m.numberOfSteps;
      steps = Math.max(0, m.numberOfSteps - base);
    });
    await CapacitorPedometer.startMeasurementUpdates();
    // Sin mediciones todavía (el teléfono quieto) = 0 pasos desde el inicio
    steps = 0;
    return {
      current: () => steps,
      async stop() {
        await handle.remove().catch(() => {});
        await CapacitorPedometer.stopMeasurementUpdates().catch(() => {});
      },
    };
  } catch (e) {
    console.warn("[buky] podómetro no disponible", e);
    return null;
  }
}
