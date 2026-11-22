// Sustituir estas URLs al publicar en las tiendas; las tiendas tienen prioridad.
export const APP_SCHEME = "tresbuk";
export const ANDROID_APK_URL = "https://github.com/cristhianbalvin-design/sua-racha-merece/releases/latest";
export const IOS_TESTFLIGHT_URL = "";
export const PLAY_STORE_URL = "";
export const APP_STORE_URL = "";

export function appDeepLink(path: string): string {
  const suffix = path === "/app" ? "" : path.startsWith("/app/") ? path.slice(4) : "";
  return `${APP_SCHEME}://app${suffix}`;
}
