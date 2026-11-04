import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { IS_NATIVE } from "./lib/platform";

const render = () => createRoot(document.getElementById("root")!).render(<App />);

if (IS_NATIVE) {
  // App de Android/iPhone: GPS en segundo plano y sin service worker (los archivos ya son locales).
  import("./features/buky/native/setupNative")
    .then(({ setupNative }) => setupNative())
    .catch((e) => console.error("[buky] setupNative", e))
    .finally(render);
} else {
  render();
  // Mismo registro simple que inyectaba vite-plugin-pwa antes (registerSW.js): sin recargar la
  // página. No usar registerSW() de virtual:pwa-register con autoUpdate: recarga al cambiar el
  // controlador, y OneSignal registra su propio worker en /sw.js → ambos se reemplazan y la
  // página entra en un bucle de recargas.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    });
  }
}
