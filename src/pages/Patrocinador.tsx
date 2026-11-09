import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import jsQR from "jsqr";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { redemptionValue } from "@/features/buky/lib/redemption";

type Sponsor = { id: string; name: string };
type Lookup = { status: "valid" | "redeemed" | "expired" | "not_found"; result_id?: string; prize?: { title: string; benefit: string; kind: string }; athlete_short_name?: string; redeem_deadline?: string; redeemed_at?: string };
type Dashboard = { coupons: { coupon_id: string; title: string; period: string; assigned: number; redeemed: number; pending: number; expired: number; codes_available: number }[]; redemptions: { date: string; prize: string; athlete_short_name: string; channel: string }[] };
const date = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "?";
export function useSponsors() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["my-sponsors", user?.id], enabled: !!user?.id, queryFn: async () => { const { data, error } = await supabase.rpc("buky_my_sponsors"); if (error) throw error; return data as Sponsor[]; } });
}
export default function Patrocinador() {
  const { token } = useParams();
  const { data: sponsors = [], isLoading, error } = useSponsors();
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<"validar" | "cupons">("validar");
  const [value, setValue] = useState(token ?? "");
  const [result, setResult] = useState<Lookup | null>(null);
  const [channel, setChannel] = useState<"qr" | "code">(token ? "qr" : "code");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const sponsorId = selected || sponsors[0]?.id;
  const dashboard = useQuery({ queryKey: ["sponsor-dashboard", sponsorId], enabled: !!sponsorId && tab === "cupons", queryFn: async () => { const { data, error } = await supabase.rpc("buky_sponsor_dashboard", { p_sponsor_id: sponsorId }); if (error) throw error; return data as Dashboard; } });
  async function lookup(input: string, source: "qr" | "code") {
    setBusy(true); setMessage(""); setResult(null); setChannel(source);
    try { const { data, error } = await supabase.rpc("buky_sponsor_lookup", { p_value: redemptionValue(input) }); if (error) throw error; setResult(data as Lookup); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { if (token) void lookup(token, "qr"); }, [token]);
  useEffect(() => {
    if (!scanning) return;
    let stopped = false; let stream: MediaStream | undefined; let frame = 0;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const el = video.current; if (!el) return; el.srcObject = stream; await el.play();
        const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        let detector: InstanceType<NonNullable<typeof Detector>> | undefined;
        try { if (Detector) detector = new Detector({ formats: ["qr_code"] }); } catch { /* jsQR sirve de respaldo. */ }
        const scan = async () => {
          if (stopped) return;
          if (el.readyState >= 2 && el.videoWidth) {
            if (detector) {
              try { const codes = await detector.detect(el); if (stopped) return; if (codes[0]?.rawValue) { setScanning(false); setValue(codes[0].rawValue); void lookup(codes[0].rawValue, "qr"); return; } } catch { detector = undefined; }
            }
            if (!detector) {
            canvas.width = el.videoWidth; canvas.height = el.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) { ctx.drawImage(el, 0, 0); const image = ctx.getImageData(0, 0, canvas.width, canvas.height); const qr = jsQR(image.data, image.width, image.height); if (qr) { setScanning(false); setValue(qr.data); void lookup(qr.data, "qr"); return; } }
            }
          }
          if (!stopped) frame = requestAnimationFrame(() => void scan());
        }; void scan();
      } catch { if (!stopped) { setMessage("N?o foi poss?vel acessar a c?mera. Confira a permiss?o ou digite o c?digo."); setScanning(false); } }
    })();
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(t => t.stop()); };
  }, [scanning]);
  async function redeem() { if (!result?.result_id) return; setBusy(true); setMessage(""); try { const { error } = await supabase.rpc("buky_sponsor_redeem", { p_result_id: result.result_id, p_channel: channel }); if (error) throw error; await lookup(value, channel); setMessage("Uso confirmado."); void dashboard.refetch(); } catch (e) { setMessage(`N?o foi poss?vel confirmar: ${(e as Error).message}`); } finally { setBusy(false); } }
  return <main className="mx-auto min-h-screen max-w-2xl bg-background p-5 text-foreground"><h1 className="text-2xl font-bold">Painel do patrocinador</h1>
    {isLoading ? <p>Carregando?</p> : error ? <p>N?o foi poss?vel carregar os patrocinadores.</p> : !sponsors.length ? <p className="mt-6">Esta conta n?o est? vinculada a nenhum patrocinador.</p> : <>
      {sponsors.length > 1 ? <select aria-label="Patrocinador" className="mt-4 w-full rounded border bg-background p-3" value={sponsorId} onChange={e => setSelected(e.target.value)}>{sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select> : <p className="mt-2">{sponsors[0].name}</p>}
      <nav className="my-5 flex gap-3"><button className="rounded border p-3" onClick={() => setTab("validar")}>Validar</button><button className="rounded border p-3" onClick={() => { setScanning(false); setTab("cupons"); }}>Cupons</button></nav>
      {tab === "validar" ? <section className="space-y-4"><button className="rounded bg-primary p-3 text-primary-foreground" onClick={() => setScanning(!scanning)}>{scanning ? "Fechar c?mera" : "Escanear QR"}</button>{scanning && <video ref={video} playsInline muted className="w-full rounded" />}
        <form onSubmit={e => { e.preventDefault(); void lookup(value, "code"); }} className="flex gap-2"><input aria-label="Digitar c?digo" placeholder="Digitar c?digo" value={value} onChange={e => setValue(e.target.value)} className="min-w-0 flex-1 rounded border bg-background p-3" /><button disabled={busy || !value.trim()} className="rounded border px-4">Buscar</button></form>
        {message && <p role="status">{message}</p>}{result && <div className="rounded border p-4">{result.status === "not_found" ? "Cupom n?o encontrado." : <><h2 className="text-lg font-bold">{result.prize?.title}</h2><p>{result.prize?.benefit}</p><p>{result.athlete_short_name}</p><p>Vence em {date(result.redeem_deadline)}</p><p>{result.status === "valid" ? "Dispon?vel" : result.status === "expired" ? "Expirado" : `J? usado em ${date(result.redeemed_at)}`}</p>{result.status === "valid" && <button disabled={busy} onClick={() => void redeem()} className="mt-3 rounded bg-primary p-3 text-primary-foreground">Confirmar uso</button>}</>}</div>}</section> : <section>{dashboard.isLoading ? "Carregando?" : dashboard.error ? "N?o foi poss?vel carregar os cupons." : <><h2 className="font-bold">Cupons</h2>{dashboard.data?.coupons.map(c => <div key={c.coupon_id} className="my-3 rounded border p-3"><b>{c.title}</b> ? {c.period}<p>Atribu?dos: {c.assigned} ? Usados: {c.redeemed} ? Pendentes: {c.pending} ? Expirados: {c.expired} ? C?digos dispon?veis: {c.codes_available}</p></div>)}<h2 className="mt-5 font-bold">?ltimos usos</h2>{dashboard.data?.redemptions.map((r, i) => <p className="border-b py-2" key={i}>{date(r.date)} ? {r.prize} ? {r.athlete_short_name} ? {r.channel}</p>)}</>}</section>}
    </>}</main>;
}
