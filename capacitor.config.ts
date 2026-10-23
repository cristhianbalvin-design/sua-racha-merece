import type { CapacitorConfig } from "@capacitor/cli";

// App móvil de 3BUK (Capacitor). Por ahora solo empaqueta la prueba de GPS de Buky
// para Android. La web (PWA) sigue funcionando igual y no usa este archivo.
const config: CapacitorConfig = {
  appId: "com.tresbuk.app",
  appName: "3BUK",
  webDir: "dist",
  android: {
    // Recomendado por @capacitor-community/background-geolocation: evita que las
    // lecturas se detengan tras ~5 minutos en segundo plano.
    useLegacyBridge: true,
  },
};

export default config;
