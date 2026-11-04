import { Capacitor } from "@capacitor/core";

/** true dentro de la app de Android/iPhone (Capacitor); false en la web/PWA. */
export const IS_NATIVE = Capacitor.isNativePlatform();
