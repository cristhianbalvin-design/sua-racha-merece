import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, Check, ChevronRight, Download, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { SHOW_FACE_SEARCH } from "@/config/features";
import { pt } from "../i18n";
import { ScreenHeader, Sheet } from "../components/ui";
import EventCalendar from "../components/EventCalendar";
import { downloadPhoto, listFotoEvents, searchMyPhotos, type FotoEvent, type FotoMatch } from "../lib/fotos";

const DRIVE_URL = "https://drive.google.com/drive/folders/1fgjMr5gKO2aDpTvbeYVio_HtbF-IX4tI";

/**
 * Fotos (mockup 3): evento + selfie → grilla de tus fotos. Usa el reconocimiento facial que ya
 * tenía 3BUK. Todo gratis por ahora: en vez de "Comprar" se descarga con el cupo gratis actual.
 */
export default function Fotos() {
  const navigate = useNavigate();
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["buky", "foto-events"],
    queryFn: listFotoEvents,
    staleTime: 5 * 60_000,
    enabled: SHOW_FACE_SEARCH,
  });
  const [event, setEvent] = useState<FotoEvent | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [pickEvent, setPickEvent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [stage, setStage] = useState(0);
  const [matches, setMatches] = useState<FotoMatch[]>([]);
  const [open, setOpen] = useState<FotoMatch | null>(null);
  const [downloading, setDownloading] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const selfieUrl = useMemo(() => (selfie ? URL.createObjectURL(selfie) : null), [selfie]);
  useEffect(() => () => void (selfieUrl && URL.revokeObjectURL(selfieUrl)), [selfieUrl]);

  // Busca sola en cuanto hay evento y selfie
  useEffect(() => {
    if (!event || !selfie) return;
    let cancelled = false;
    setStatus("loading");
    setStage(0);
    const timers = [3000, 8000].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    searchMyPhotos(selfie, event)
      .then((m) => {
        if (cancelled) return;
        setMatches(m);
        setStatus("done");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus("error");
        toast.error(e instanceof Error ? e.message : pt.comum.erro);
      });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [event, selfie]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) setSelfie(f);
  };

  const usarNoKit = (m: FotoMatch) => navigate("/app/patrocinio", { state: { photo: { id: m.id, imageUrl: m.image_url } } });

  const baixar = async (m: FotoMatch) => {
    setDownloading(true);
    try {
      const r = await downloadPhoto(m);
      if (r.ok) toast.success(pt.fotos.baixada);
      else if (r.needsParticipation) {
        toast(pt.fotos.liberar);
        usarNoKit(m);
      } else toast.error(r.message, { duration: 8000 });
    } catch {
      toast.error(pt.comum.erro);
    } finally {
      setDownloading(false);
    }
  };

  if (!SHOW_FACE_SEARCH) {
    return (
      <div>
        <ScreenHeader title={pt.fotos.titulo} />
        <p className="px-6 pt-3 text-[16px] text-[var(--buky-muted)]">{pt.fotos.sub}</p>
        <div className="px-6">
          <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="buky-btn mt-6">
            {pt.fotos.verFotos} <ExternalLink size={18} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <ScreenHeader title={pt.fotos.titulo} />
      <p className="px-6 pt-3 text-[16px] text-[var(--buky-muted)]">{pt.fotos.sub}</p>

      <div className="mx-6 mt-6 border-y border-[var(--buky-line)]">
        <button type="button" onClick={() => setPickEvent(true)} className="flex w-full items-center justify-between gap-4 py-4 text-left">
          <span className="text-[16px] font-medium">{pt.fotos.evento}</span>
          <span className="flex min-w-0 items-center gap-1 text-[15px] text-[var(--buky-muted)]">
            <span className="truncate">{event?.title ?? pt.fotos.escolherEvento}</span>
            <ChevronRight size={18} className="shrink-0" />
          </span>
        </button>
        <div className="border-t border-[var(--buky-line)]">
          <button type="button" onClick={() => camRef.current?.click()} className="flex w-full items-center gap-4 py-4 text-left">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--buky-neon)] text-[#050505]">
              {selfieUrl ? <img src={selfieUrl} alt="" className="h-full w-full object-cover" /> : <Camera size={22} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">{selfie ? pt.fotos.trocarSelfie : pt.fotos.selfie}</span>
              <span className="block text-[13px] text-[var(--buky-muted)]">{pt.fotos.selfieSub}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-[var(--buky-muted)]" />
          </button>
          <button type="button" onClick={() => galRef.current?.click()} className="-mt-2 pb-3 pl-[68px] text-[13px] font-semibold text-[var(--buky-neon)]">
            {pt.fotos.galeria}
          </button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center text-[var(--buky-muted)]" role="status">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--buky-neon)] border-t-transparent" />
          <span className="text-sm">{pt.fotos.buscando[stage]}</span>
        </div>
      )}

      {status === "done" && matches.length === 0 && (
        <div className="px-6 py-10 text-center">
          <p className="text-[16px] font-semibold">{pt.fotos.nenhuma}</p>
          <p className="mt-2 text-sm text-[var(--buky-muted)]">{pt.fotos.nenhumaDica}</p>
        </div>
      )}

      {status === "done" && matches.length > 0 && (
        <>
          <div className="flex items-center justify-between px-6 pb-3 pt-6">
            <p className="buky-label text-[var(--buky-muted)]">{pt.fotos.suasFotos}</p>
            <p className="text-sm font-semibold text-[var(--buky-neon)]">{pt.fotos.encontradas(matches.length)}</p>
          </div>
          <div className="grid grid-cols-3 gap-[2px]">
            {matches.map((m) => (
              <button key={m.id} type="button" onClick={() => setOpen(m)} className="relative aspect-[3/4] overflow-hidden bg-[#1a1a1a]">
                <img src={m.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="font-buky pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] text-white/50">3BUK</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet open={pickEvent} onClose={() => setPickEvent(false)} label={pt.fotos.escolherEvento}>
        <p className="buky-label mb-3 text-[var(--buky-muted)]">{pt.fotos.escolherEvento}</p>
        {loadingEvents ? (
          <p className="py-6 text-sm text-[var(--buky-faint)]">{pt.comum.carregando}</p>
        ) : events.length === 0 ? (
          <p className="py-6 text-sm text-[var(--buky-faint)]">{pt.fotos.semEventos}</p>
        ) : (
          <div className="max-h-[70svh] overflow-auto">
            <EventCalendar
              events={events}
              selectedKey={event?.key}
              onPick={(ev) => {
                setEvent(ev);
                setPickEvent(false);
              }}
            />
          </div>
        )}
      </Sheet>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={pt.fotos.suasFotos}>
          <div className="flex justify-end px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
            <button type="button" onClick={() => setOpen(null)} aria-label={pt.comum.voltar} className="p-2">
              <X size={26} />
            </button>
          </div>
          <div className="relative mx-auto flex min-h-0 w-full max-w-[480px] flex-1 items-center justify-center px-4">
            <img src={open.image_url} alt="" className="max-h-full max-w-full object-contain" />
            <span className="font-buky pointer-events-none absolute inset-0 flex items-center justify-center text-[40px] text-white/35">3BUK</span>
          </div>
          <div className="mx-auto w-full max-w-[480px] space-y-3 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
            {open.event_label && <p className="truncate text-center text-xs text-[var(--buky-muted)]">{open.event_label}</p>}
            <button type="button" className="buky-btn buky-btn-light" disabled={downloading} onClick={() => void baixar(open)}>
              <Download size={18} /> {downloading ? pt.fotos.baixando : pt.fotos.baixar}
            </button>
            <button type="button" className="buky-btn buky-btn-ghost" onClick={() => usarNoKit(open)}>
              {pt.fotos.usarNoKit}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
