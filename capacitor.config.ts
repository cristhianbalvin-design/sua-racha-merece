import type { CapacitorConfig } from "@capacitor/cli";

// App móvil de 3BUK (Capacitor): la misma app web, con /app (Buky) como entrada y GPS en
// segundo plano. La web (PWA) no usa este archivo.
const config: CapacitorConfig = {
  appId: "com.tresbuk.app",
  appName: "3BUK",
  webDir: "dist",
  backgroundColor: "#050505",
  android: {
    // Recomendado por @capacitor-community/background-geolocation: evita que las
    // lecturas se detengan tras ~5 minutos en segundo plano.
    useLegacyBridge: true,
  },
  ios: {
    backgroundColor: "#050505",
  },
  plugins: {
    // Pantalla de borde a borde; la app respeta env(safe-area-inset-*) en cada pantalla.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
