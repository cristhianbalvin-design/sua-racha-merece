import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import jsQR from "jsqr";
import { useSponsors } from "@/lib/sponsorApi";
import { useConfirm } from "@/hooks/useConfirm";
import { supabase } from "@/lib/supabase";
import { redemptionValue } from "@/features/buky/lib/redemption";

const texto = {
  titulo: "Painel do patrocinador",
  carregando: "Carregando…",
  erroPatrocinadores: "Não foi possível carregar os patrocinadores.",
  semPatrocinador: "Esta conta não está vinculada a nenhum patrocinador.",
  patrocinador: "Patrocinador",
  validar: "Validar",
  cupons: "Cupons",
  fecharCamera: "Fechar câmera",
  escanear: "Escanear QR",
  digitar: "Digitar código",
  buscar: "Buscar",
  naoEncontrado: "Cupom não encontrado.",
  vence: "Vence em",
  disponivel: "Disponível",
  expirado: "Expirado",
  confirmar: "Confirmar uso",
  erroCupons: "Não foi possível carregar os cupons.",
  ultimos: "Últimos usos",
  atribuidos: "Atribuídos",
  usados: "Usados",
  pendentes: "Pendentes",
  expirados: "Expirados",
  codigos: "Códigos disponíveis",
  jaUsado: "Já usado em",
  sucesso: "Uso confirmado.",
  confirmarPergunta: "Confirmar o uso deste prêmio?",
  erroCamera:
    "Não foi possível acessar a câmera. Confira a permissão ou digite o código.",
} as const;

type Lookup = {
  status: "valid" | "redeemed" | "expired" | "not_found";
  result_id?: string;
  prize?: { title: string; benefit: string; kind: string };
  athlete_short_name?: string;
  redeem_deadline?: string;
  redeemed_at?: string;
};
type Dashboard = {
  coupons: {
    coupon_id: string;
    title: string;
    period: string;
    assigned: number;
    redeemed: number;
    pending: number;
    expired: number;
    codes_available: number;
  }[];
  redemptions: {
    date: string;
    prize: string;
    athlete_short_name: string;
    channel: string;
  }[];
};
const date = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    : "—";
const channelLabel = (channel: string) =>
  ({ qr: "QR", code: "Código", admin: "Admin" })[channel] ?? "—";
const rpcError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? "");
  const messages: Record<string, string> = {
    not_member: "Sua conta não tem acesso a este patrocinador.",
    not_found: "Cupom não encontrado.",
    expired: "O prazo deste cupom expirou.",
    already_redeemed: "Este cupom já foi usado.",
    not_active: "Este cupom não está disponível para uso.",
  };
  return (
    Object.entries(messages).find(([key]) => message.includes(key))?.[1] ??
    "Não foi possível concluir a operação. Tente novamente."
  );
};
export default function Patrocinador() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { token } = useParams();
  const [confirmRedeem, confirmDialog] = useConfirm();
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
  const dashboard = useQuery({
    queryKey: ["sponsor-dashboard", sponsorId],
    enabled: !!sponsorId && tab === "cupons",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("buky_sponsor_dashboard", {
        p_sponsor_id: sponsorId,
      });
      if (error) throw error;
      return data as Dashboard;
    },
  });
  async function lookup(input: string, source: "qr" | "code") {
    setBusy(true);
    setMessage("");
    setResult(null);
    setChannel(source);
    try {
      const { data, error } = await supabase.rpc("buky_sponsor_lookup", {
        p_value: redemptionValue(input),
      });
      if (error) throw error;
      setResult(data as Lookup);
    } catch (e) {
      setMessage(rpcError(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (token) void lookup(token, "qr");
  }, [token]);
  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let frame = 0;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const el = video.current;
        if (!el) return;
        el.srcObject = stream;
        await el.play();
        const Detector = (
          window as unknown as {
            BarcodeDetector?: new (options: { formats: string[] }) => {
              detect: (
                source: HTMLVideoElement,
              ) => Promise<{ rawValue: string }[]>;
            };
          }
        ).BarcodeDetector;
        let detector: InstanceType<NonNullable<typeof Detector>> | undefined;
        try {
          if (Detector) detector = new Detector({ formats: ["qr_code"] });
        } catch {
          /* jsQR sirve de respaldo. */
        }
        const scan = async () => {
          if (stopped) return;
          if (el.readyState >= 2 && el.videoWidth) {
            if (detector) {
              try {
                const codes = await detector.detect(el);
                if (stopped) return;
                if (codes[0]?.rawValue) {
                  setScanning(false);
                  setValue(codes[0].rawValue);
                  void lookup(codes[0].rawValue, "qr");
                  return;
                }
              } catch {
                detector = undefined;
              }
            }
            if (!detector) {
              canvas.width = el.videoWidth;
              canvas.height = el.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(el, 0, 0);
                const image = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                const qr = jsQR(image.data, image.width, image.height);
                if (qr) {
                  setScanning(false);
                  setValue(qr.data);
                  void lookup(qr.data, "qr");
                  return;
                }
              }
            }
          }
          if (!stopped) frame = requestAnimationFrame(() => void scan());
        };
        void scan();
      } catch {
        if (!stopped) {
          setMessage(texto.erroCamera);
          setScanning(false);
        }
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);
  async function redeem() {
    if (
      !result?.result_id ||
      !(await confirmRedeem({
        description: texto.confirmarPergunta,
        confirmLabel: texto.confirmar,
      }))
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("buky_sponsor_redeem", {
        p_result_id: result.result_id,
        p_channel: channel,
      });
      if (error) throw error;
      await lookup(value, channel);
      setMessage(texto.sucesso);
      void dashboard.refetch();
    } catch (e) {
      setMessage(`Não foi possível confirmar: ${rpcError(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-background p-5 text-foreground">
      {confirmDialog}
      <h1 className="text-2xl font-bold">{texto.titulo}</h1>
      {isLoading ? (
        <p>{texto.carregando}</p>
      ) : error ? (
        <p>{texto.erroPatrocinadores}</p>
      ) : !sponsors.length ? (
        <div className="mt-6 space-y-4">
          <p>Você entrou como <strong>{user?.email}</strong>.</p>
          <p>Esta conta não pertence a uma equipe de patrocinador.</p>
          <button className="w-full rounded-xl bg-primary p-3 font-bold text-primary-foreground" onClick={async () => {
            await supabase.auth.signOut();
            navigate('/login?redirectTo=%2Fpatrocinador', { replace: true });
          }}>Sair e entrar com outra conta</button>
          <Link className="block rounded-xl border p-3 text-center font-bold" to="/patrocinador/acesso">Recebi um convite</Link>
        </div>
      ) : (
        <>
          {sponsors.length > 1 ? (
            <select
              aria-label={texto.patrocinador}
              className="mt-4 w-full rounded border bg-background p-3"
              value={sponsorId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-2">{sponsors[0].name}</p>
          )}
          <nav className="my-5 flex gap-3">
            <button
              aria-current={tab === "validar" ? "page" : undefined}
              className={`min-h-11 flex-1 rounded border p-3 ${tab === "validar" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setTab("validar")}
            >
              {texto.validar}
            </button>
            <button
              aria-current={tab === "cupons" ? "page" : undefined}
              className={`min-h-11 flex-1 rounded border p-3 ${tab === "cupons" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => {
                setScanning(false);
                setTab("cupons");
              }}
            >
              {texto.cupons}
            </button>
          </nav>
          {tab === "validar" ? (
            <section className="space-y-4">
              <button
                className="rounded bg-primary p-3 text-primary-foreground"
                onClick={() => setScanning(!scanning)}
              >
                {scanning ? texto.fecharCamera : texto.escanear}
              </button>
              {scanning && (
                <video
                  ref={video}
                  playsInline
                  muted
                  className="w-full rounded"
                />
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void lookup(value, "code");
                }}
                className="flex gap-2"
              >
                <input
                  aria-label={texto.digitar}
                  placeholder={texto.digitar}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="min-w-0 flex-1 rounded border bg-background p-3"
                />
                <button
                  disabled={busy || !value.trim()}
                  className="rounded border px-4"
                >
                  {texto.buscar}
                </button>
              </form>
              {message && <p role="status">{message}</p>}
              {result && (
                <div
                  className={`rounded border p-4 ${result.status === "valid" ? "border-green-600 bg-green-50 text-green-950" : result.status === "expired" ? "border-red-600 bg-red-50 text-red-950" : "border-gray-400 bg-gray-100 text-gray-900"}`}
                >
                  {result.status === "not_found" ? (
                    texto.naoEncontrado
                  ) : (
                    <>
                      <h2 className="text-lg font-bold">
                        {result.prize?.title}
                      </h2>
                      <p>{result.prize?.benefit}</p>
                      <p>{result.athlete_short_name}</p>
                      <p>
                        {texto.vence} {date(result.redeem_deadline)}
                      </p>
                      <p>
                        {result.status === "valid"
                          ? texto.disponivel
                          : result.status === "expired"
                            ? texto.expirado
                            : `${texto.jaUsado} ${date(result.redeemed_at)}`}
                      </p>
                      {result.status === "valid" && (
                        <button
                          disabled={busy}
                          onClick={() => void redeem()}
                          className="mt-3 rounded bg-primary p-3 text-primary-foreground"
                        >
                          {texto.confirmar}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section>
              {dashboard.isLoading ? (
                texto.carregando
              ) : dashboard.error ? (
                texto.erroCupons
              ) : (
                <>
                  <h2 className="font-bold">{texto.cupons}</h2>
                  {dashboard.data?.coupons.map((c) => (
                    <div key={c.coupon_id} className="my-3 rounded border p-3">
                      <b>{c.title}</b> · {c.period}
                      <p>
                        {texto.atribuidos}: {c.assigned} · {texto.usados}:{" "}
                        {c.redeemed} · {texto.pendentes}: {c.pending} ·{" "}
                        {texto.expirados}: {c.expired} · {texto.codigos}:{" "}
                        {c.codes_available}
                      </p>
                    </div>
                  ))}
                  <h2 className="mt-5 font-bold">{texto.ultimos}</h2>
                  {dashboard.data?.redemptions.map((r, i) => (
                    <p className="border-b py-2" key={i}>
                      {date(r.date)} · {r.prize} · {r.athlete_short_name} ·{" "}
                      {channelLabel(r.channel)}
                    </p>
                  ))}
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
