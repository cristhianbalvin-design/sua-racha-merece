/**
 * Arranque de la app nativa: registra el GPS en segundo plano y el botón "atrás" de Android.
 * Solo se carga dentro de Capacitor (ver main.tsx).
 */
import { App as CapApp } from "@capacitor/app";
import { registerNativeGpsSource } from "../training/gpsSource";
import { nativeGpsSource } from "./nativeGps";

export function setupNative(): void {
  registerNativeGpsSource(nativeGpsSource);
  // Borde a borde solo en la app nativa (la web actual no usa las zonas seguras).
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !vp.getAttribute("content")?.includes("viewport-fit")) {
    vp.setAttribute("content", `${vp.getAttribute("content")}, viewport-fit=cover`);
  }
  document.documentElement.style.background = "#050505";
  // Atrás: navega hacia atrás; en la pantalla inicial deja la app en segundo plano
  // (no la cierra: un entrenamiento en curso sigue contando).
  void CapApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.location.pathname !== "/app") window.history.back();
    else void CapApp.minimizeApp();
  });
}
