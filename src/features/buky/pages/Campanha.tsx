import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ImagePlus, Instagram } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiAddParticipation, apiGetCampaignById } from "@/lib/mockApi";
import { isCampaignUnavailable } from "@/lib/campaignSharing";
import { submitParticipationEvidence } from "@/lib/participationEvidence";
import { supabase } from "@/lib/supabase";
import { pt } from "../i18n";
import { Spinner } from "../components/ui";
import { useMyStatus } from "../lib/hooks";

const P = pt.patrocinio;
type PhotoRef = { id: string; imageUrl: string };

const fmtDay = (d?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}/${m[2]}` : d ?? "";
};

async function myParticipation(userId: string, campaignId: string) {
  const { data, error } = await supabase
    .from("participations")
    .select("id, status")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; status: string } | null;
}

/** Foto del buscador de Fotos → archivo, para enviarla como evidencia. */
async function photoToFile(p: PhotoRef): Promise<File> {
  const res = await fetch(p.imageUrl);
  if (!res.ok) throw new Error("photo");
  const blob = await res.blob();
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  return new File([blob], `foto-3buk-${p.id}.${ext}`, { type: blob.type || "image/jpeg" });
}

/**
 * Kit 3buk (campaña de patrocinio) dentro de la app: datos de la campaña + las evidencias que ya
 * pedía 3BUK (foto, respuesta a la pregunta y, si la campaña lo pide, Instagram con print).
 */
export default function Campanha() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const fromFotos = (location.state as { photo?: PhotoRef } | null)?.photo ?? null;

  const { data: campaign, isLoading } = useQuery({ queryKey: ["buky", "campaign", id], queryFn: () => apiGetCampaignById(id) });
  const { data: st } = useMyStatus();
  const { data: part, isLoading: loadingPart } = useQuery({
    queryKey: ["buky", "participation", id, user?.id],
    queryFn: () => myParticipation(user!.id, id),
    enabled: Boolean(user?.id && id),
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [answer, setAnswer] = useState("");
  const [ig, setIg] = useState(false);
  const [igShot, setIgShot] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const igRef = useRef<HTMLInputElement>(null);

  // Si viene desde Fotos, la foto elegida queda precargada
  useEffect(() => {
    if (!fromFotos) return;
    photoToFile(fromFotos).then(setPhoto).catch(() => toast.error(pt.comum.erro));
  }, [fromFotos?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : fromFotos?.imageUrl ?? null), [photo, fromFotos?.imageUrl]);
  const igUrl = useMemo(() => (igShot ? URL.createObjectURL(igShot) : null), [igShot]);

  if (isLoading || loadingPart) return <Spinner label={pt.comum.carregando} />;
  // Fase 1: sin los Bukys históricos necesarios vuelve a Patrocínio, que muestra cuánto falta
  if (st && !st.tester && st.found_total < st.sponsorship_min && !part) return <Navigate to="/app/patrocinio" replace />;

  const back = (
    <button type="button" onClick={() => navigate("/app/patrocinio")} aria-label={pt.comum.voltar} className="-ml-1 p-1">
      <ChevronLeft size={26} />
    </button>
  );

  if (!campaign || isCampaignUnavailable(campaign)) {
    return (
      <div className="px-6 pt-[calc(env(safe-area-inset-top,0px)+24px)]">
        {back}
        <p className="mt-10 text-center text-[var(--buky-muted)]">{P.encerrada}</p>
        <Link to="/app/patrocinio" className="buky-btn buky-btn-ghost mt-6">{P.voltar}</Link>
      </div>
    );
  }

  const done = sent || (part && part.status !== "Em curso");
  const askIg = String(campaign.instagramOptional) === "true";
  const tag = campaign.instagramHashtags || "#3bukchallenge";
  const errs = {
    foto: !photo ? P.faltaFoto : null,
    resposta: !answer.trim() ? P.faltaResposta : null,
    print: askIg && ig && !igShot ? P.faltaPrint : null,
  };
  const firstError = Object.values(errs).find(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (firstError) return void toast.error(firstError);
    if (!user || !photo) return;
    setSending(true);
    try {
      let current = part ?? (await myParticipation(user.id, id));
      if (!current) {
        const created = await apiAddParticipation({ userId: user.id, campaignId: id, participationStatus: "Em curso", photo: "", instagram: false });
        if (!created) throw new Error(pt.comum.erro);
        current = { id: created.id, status: "Em curso" };
      }
      await submitParticipationEvidence({
        participationId: current.id,
        userId: user.id,
        expectedStatus: "Em curso",
        photos: [photo],
        instagram: askIg && ig,
        instagramScreenshot: igShot,
        comment: answer.trim(),
      });
      setSent(true);
      void qc.invalidateQueries({ queryKey: ["buky", "participation", id] });
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : pt.comum.erro);
    } finally {
      setSending(false);
    }
  };

  const hero = campaign.imageUrlMobile || campaign.imageUrl;

  return (
    <div className="pb-10">
      <div className="relative">
        {hero && (
          <>
            <img src={hero} alt="" className="h-[220px] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-[var(--buky-bg)]" />
          </>
        )}
        <div className={`${hero ? "absolute inset-x-0 top-0" : ""} px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)]`}>{back}</div>
      </div>

      <div className={`px-6 ${hero ? "-mt-10 relative" : "mt-4"}`}>
        <p className="buky-label text-[var(--buky-neon)]">{[campaign.sport, campaign.city].filter(Boolean).join(" · ")}</p>
        <h1 className="font-buky mt-2 text-[34px] leading-[1.02]">{campaign.name}</h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--buky-muted)]">
          {campaign.prize && (
            <span>
              {P.premio}: <b className="text-white">{campaign.prize}</b>
            </span>
          )}
          {campaign.winnersCount > 0 && <span>{P.vencedores(campaign.winnersCount)}</span>}
          {campaign.endDate && <span>{P.ate(fmtDay(campaign.endDate))}</span>}
        </div>
        {campaign.description && campaign.description !== campaign.name && (
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-[var(--buky-muted)]">{campaign.description}</p>
        )}

        {done ? (
          <div className="mt-8 rounded-[22px] border border-[var(--buky-neon)] p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--buky-neon)] text-[#050505]">
              <Check size={28} />
            </span>
            <p className="font-buky mt-4 text-[26px]">{sent ? P.enviada : P.jaParticipou}</p>
            <p className="mt-2 text-sm text-[var(--buky-muted)]">
              {sent ? P.emAvaliacao : P.status[part?.status ?? ""] ?? P.emAvaliacao}
            </p>
            <Link to="/app/patrocinio" className="buky-btn buky-btn-ghost mt-6">{P.voltar}</Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-8 space-y-7">
            {/* 1 · Foto */}
            <section>
              <p className={`buky-label ${touched && errs.foto ? "text-[var(--buky-danger)]" : "text-[var(--buky-muted)]"}`}>{P.foto}</p>
              <p className="mt-1 text-sm text-[var(--buky-muted)]">{P.fotoTexto}</p>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPhoto(f); }} />
              {photoUrl ? (
                <button type="button" onClick={() => photoRef.current?.click()} className="relative mt-3 block w-full overflow-hidden rounded-[18px]">
                  <img src={photoUrl} alt="" className="max-h-[320px] w-full object-cover" />
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold">{P.trocarFoto}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className={`mt-3 flex h-[120px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed ${touched && errs.foto ? "border-[var(--buky-danger)]" : "border-[#3a3a3a]"} text-[var(--buky-muted)]`}
                >
                  <ImagePlus size={26} />
                  <span className="text-sm font-semibold">{P.escolherFoto}</span>
                </button>
              )}
            </section>

            {/* 2 · Respuesta */}
            <section>
              {campaign.question && (
                <div className="mb-4 rounded-[18px] bg-[var(--buky-neon-soft)] p-4">
                  <p className="buky-label text-[11px] text-[var(--buky-neon)]">{P.pergunta}</p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug">{campaign.question}</p>
                </div>
              )}
              <label className="buky-field" data-invalid={touched && errs.resposta ? "true" : undefined}>
                <span>{campaign.question ? P.resposta : P.historia}</span>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={P.respostaPh}
                  className="w-full resize-none bg-transparent text-[17px] text-white outline-none placeholder:text-[var(--buky-faint)]"
                />
              </label>
            </section>

            {/* 3 y 4 · Instagram (solo si la campaña lo pide) */}
            {askIg && (
              <section>
                <button type="button" role="checkbox" aria-checked={ig} onClick={() => setIg((v) => !v)} className="flex w-full items-center gap-3 text-left">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${ig ? "border-[var(--buky-neon)] bg-[var(--buky-neon)] text-[#050505]" : "border-[#3a3a3a]"}`}>
                    {ig && <Check size={16} />}
                  </span>
                  <span className="text-[15px]">{P.publiquei(tag)}</span>
                </button>
                {ig && (
                  <>
                    <input ref={igRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setIgShot(f); }} />
                    <button
                      type="button"
                      onClick={() => igRef.current?.click()}
                      className={`mt-3 flex w-full items-center gap-3 rounded-[18px] border border-dashed p-3 text-left ${touched && errs.print ? "border-[var(--buky-danger)]" : "border-[#3a3a3a]"}`}
                    >
                      {igUrl ? <img src={igUrl} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <Instagram size={22} className="m-2 text-[var(--buky-muted)]" />}
                      <span className="text-sm font-semibold">{igShot ? P.print : P.anexarPrint}</span>
                    </button>
                  </>
                )}
              </section>
            )}

            <button type="submit" className="buky-btn" disabled={sending}>
              {sending ? P.enviando : P.enviar}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
