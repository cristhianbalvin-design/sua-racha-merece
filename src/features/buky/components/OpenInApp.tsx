import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import { ANDROID_APK_URL, APP_STORE_URL, IOS_TESTFLIGHT_URL, PLAY_STORE_URL, appDeepLink } from "@/config/appLinks";

export function OpenInApp({ path = "/app", compact = false }: { path?: string; compact?: boolean }) {
  const [downloads, setDownloads] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const open = () => {
    window.location.href = appDeepLink(path);
    timer.current = setTimeout(() => {
      if (document.visibilityState === "visible") setDownloads(true);
    }, 1800);
  };
  const android = /android/i.test(navigator.userAgent);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const option = (label: string, url: string) => url
    ? <a className="block underline" href={url}>{label}</a>
    : <span className="block">{label}: Em breve</span>;
  return (
    <div className={compact ? "" : "rounded-2xl border border-[#333] bg-[#111] p-5 text-white"}>
      {!compact && <><Smartphone className="text-[#39ff14]" /><h2 className="mt-2 text-xl font-bold">O Buky só roda no app</h2><p className="my-2 text-sm">Abra o aplicativo para iniciar seu treino.</p></>}
      <button type="button" onClick={open} className="rounded-full bg-[#39ff14] px-5 py-3 font-bold text-black">Abrir no app</button>
      {downloads && <div className="mt-3 text-sm" aria-live="polite">
        {!android && !ios && <p>Abra este link no seu celular.</p>}
        {!ios && option("Android", PLAY_STORE_URL || ANDROID_APK_URL)}
        {!android && option("iPhone", APP_STORE_URL || IOS_TESTFLIGHT_URL)}
      </div>}
    </div>
  );
}
