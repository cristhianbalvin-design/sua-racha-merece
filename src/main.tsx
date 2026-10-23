import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

// Dentro de la app nativa (Capacitor) se carga solo la prueba de GPS de Buky.
// En la web (PWA) se carga la aplicación de siempre.
if (Capacitor.isNativePlatform()) {
  import("./features/buky/spike/SpikeApp").then(({ default: SpikeApp }) => root.render(<SpikeApp />));
} else {
  import("./App.tsx").then(({ default: App }) => root.render(<App />));
}
