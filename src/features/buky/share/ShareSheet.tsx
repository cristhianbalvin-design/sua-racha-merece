import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { toast } from "sonner";
import { Sheet } from "../components/ui";
import { canvasBlob, drawSticker, type StickerColor, type StickerData } from "./stickerCanvas";
import type { ShareFormat } from "./stickerLayout";

function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "3buk-corrida.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
export default function ShareSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: StickerData }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<StickerColor>("lime");
  const [format, setFormat] = useState<ShareFormat>("sticker");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !canvas.current) return;
    let active = true;
    setReady(false);
    const target = canvas.current;
    const pending = document.createElement("canvas");
    void drawSticker(pending, data, format, color)
      .then(() => {
        if (active) {
          target.width = pending.width;
          target.height = pending.height;
          target.getContext("2d")?.drawImage(pending, 0, 0);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) toast.error("Não foi possível gerar a prévia.");
      });
    return () => {
      active = false;
    };
  }, [open, data, format, color]);
  async function act(save: boolean) {
    if (!canvas.current || !ready || busy) return;
    setBusy(true);
    try {
      const blob = await canvasBlob(canvas.current);
      if (Capacitor.isNativePlatform()) {
        const path = `3buk-corrida-${Date.now()}.png`;
        const file = await Filesystem.writeFile({
          path,
          data: await base64(blob),
          directory: save ? Directory.Documents : Directory.Cache,
          recursive: true,
        });
        if (save) toast.success("Imagem salva em Documentos.");
        else {
          // Un intent directo de Instagram Stories iría aquí, si se dispone de Facebook App ID.
          await Share.share({ files: [file.uri], dialogTitle: "Compartilhar corrida" });
        }
      } else if (save) download(blob);
      else {
        const file = new File([blob], "3buk-corrida.png", { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
        else download(blob);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast.error("Não foi possível compartilhar ou salvar a imagem.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} label="Compartilhar corrida">
      <div className="max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between">
          <h2 className="text-xl font-bold">Compartilhar corrida</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div
          className={`mx-auto mt-3 flex h-[210px] items-center justify-center rounded-xl ${color === "black" && format === "sticker" ? "bg-[#e8e8e8]" : "bg-[#202020]"}`}
        >
          <canvas ref={canvas} aria-label="Prévia da imagem" className="max-h-full max-w-full object-contain" />
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm text-[var(--buky-muted)]">Cor</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["lime", "Verde lima"],
                ["white", "Branco"],
                ["black", "Preto"],
              ] as const
            ).map(([v, label]) => (
              <button
                type="button"
                key={v}
                aria-pressed={color === v}
                onClick={() => setColor(v)}
                className={`rounded-full border px-3 py-2 text-sm ${color === v ? "border-[var(--buky-neon)]" : "border-[#555]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-sm text-[var(--buky-muted)]">Formato</legend>
          <div className="mt-2 flex gap-2">
            {(
              [
                ["sticker", "Sticker"],
                ["story", "Story"],
              ] as const
            ).map(([v, label]) => (
              <button
                type="button"
                key={v}
                aria-pressed={format === v}
                onClick={() => setFormat(v)}
                className={`rounded-full border px-4 py-2 text-sm ${format === v ? "border-[var(--buky-neon)]" : "border-[#555]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--buky-muted)]">
            {format === "sticker" ? "1080 × 1080 · fundo transparente" : "1080 × 1920 · fundo preto"}
          </p>
        </fieldset>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={!ready || busy} onClick={() => void act(false)} className="buky-btn">
            Compartilhar
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => void act(true)}
            className="rounded-full border border-[var(--buky-line)] px-3 py-3"
          >
            Salvar imagem
          </button>
        </div>
      </div>
    </Sheet>
  );
}
