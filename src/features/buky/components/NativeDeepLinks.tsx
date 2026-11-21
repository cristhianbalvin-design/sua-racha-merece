import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { IS_NATIVE } from "@/lib/platform";

export function deepLinkPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "tresbuk:" || url.hostname !== "app" || url.username || url.password || url.port) return null;
    const path = `/app${url.pathname === "/" ? "" : url.pathname}`;
    if (path !== "/app" && !path.startsWith("/app/")) return null;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function NativeDeepLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!IS_NATIVE) return;
    const listener = App.addListener("appUrlOpen", ({ url }) => {
      const path = deepLinkPath(url);
      if (path) navigate(path);
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [navigate]);
  return null;
}
