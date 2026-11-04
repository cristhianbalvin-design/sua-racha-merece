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
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
