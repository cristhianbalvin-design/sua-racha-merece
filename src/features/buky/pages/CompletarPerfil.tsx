import CpfProfile from "@/components/CpfProfile";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Camera, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiUploadAvatar } from "@/lib/mockApi";
import { squareAvatar } from "../lib/avatarImage";
import { pt } from "../i18n";
import CityPicker from "../components/CityPicker";
import { ProfileAvatar, Spinner } from "../components/ui";
import type { City } from "../lib/api";
import { getCity } from "../lib/api";
import { isProfileComplete, useBukyProfile, useUpdateProfile } from "../lib/hooks";
import { clearPendingProfile, takePendingProfile } from "../lib/pendingProfile";
import { cleanInstagram, isValidInstagram, isValidName, isValidNeighborhood, isValidNickname, maskPhone, normalizePhone } from "../lib/validation";

/**
 * Completar o editar el perfil: ciudad (catálogo IBGE), barrio, Instagram, nombre y foto.
 * Los atletas que ya existían en 3BUK pasan por aquí una vez (su ciudad estaba escrita a mano).
 */
export default function CompletarPerfil() {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = Boolean((location.state as { edit?: boolean } | null)?.edit);
  const { user, updateUserContext } = useAuth();
  const { data: p, isLoading } = useBukyProfile();
  const save = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ nome: "", instagram: "", bairro: "", nickname: "", phone: "", whatsapp: "" });
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const loaded = useRef(false);

  // Prellenar con el perfil y con lo que quedó pendiente del registro
  useEffect(() => {
    if (!p || loaded.current) return;
    loaded.current = true;
    const pending = takePendingProfile(p.email);
    setF({
      nome: p.name && p.name !== "Atleta" ? p.name : pending?.name ?? p.name ?? "",
      instagram: p.instagram ?? pending?.instagram ?? "",
      bairro: p.neighborhood ?? pending?.neighborhood ?? "",
      nickname: p.nickname ?? "",
      phone: maskPhone(p.phone ?? ""),
      whatsapp: maskPhone(p.whatsapp ?? ""),
    });
    setSameWhatsapp(!p.whatsapp || p.whatsapp === p.phone);
    const code = p.city_code ?? pending?.city_code;
    if (code) void getCity(code).then(setCity);
  }, [p]);

  if (isLoading || !p) return <Spinner label={pt.comum.carregando} />;

  const E = pt.cadastro.erros;
  const errs = {
    nome: !isValidName(f.nome) ? E.nome : null,
    // Opcionales: solo se validan si el atleta escribió algo
    instagram: f.instagram.trim() && !isValidInstagram(f.instagram) ? E.instagram : null,
    bairro: f.bairro.trim() && !isValidNeighborhood(f.bairro) ? E.bairro : null,
    cidade: !city ? E.cidade : null,
    nickname: !isValidNickname(f.nickname) ? "Use 3 a 20 letras, números, pontos ou sublinhados." : null,
    phone: f.phone && !normalizePhone(f.phone) ? "Confira o número de celular." : null,
    whatsapp: !sameWhatsapp && f.whatsapp && !normalizePhone(f.whatsapp) ? "Confira o número de WhatsApp." : null,
  };
  const firstError = Object.values(errs).find(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (firstError) {
      toast.error(firstError);
      return;
    }
    try {
      const saved = await save.mutateAsync({
        name: f.nome.trim(),
        instagram: cleanInstagram(f.instagram) || null,
        neighborhood: f.bairro.trim() || null,
        nickname: f.nickname.trim() || null,
        phone: normalizePhone(f.phone),
        whatsapp: normalizePhone(sameWhatsapp ? f.phone : f.whatsapp),
        city_code: city!.code,
      });
      clearPendingProfile();
      if (isProfileComplete(saved)) navigate(editing ? "/app/perfil" : "/app", { replace: true });
    } catch {
      toast.error(pt.comum.erro);
    }
  };

  const onAvatar = async (file?: File) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      // Recorta y reduce en el teléfono: las fotos grandes de la cámara ya no fallan
      const small = await squareAvatar(file).catch(() => file);
      const url = await apiUploadAvatar(small, user.id);
      if (url) {
        await save.mutateAsync({ avatar_url: url });
        updateUserContext({ avatar: url });
        toast.success(pt.perfil.fotoAtualizada);
      } else toast.error(pt.perfil.fotoErro);
    } catch {
      toast.error(pt.perfil.fotoErro);
    } finally {
      setUploading(false);
    }
  };

  const inv = (k: keyof typeof errs) => (touched && errs[k] ? "true" : undefined);

  return (
    <main className="px-7 pb-10 pt-[calc(env(safe-area-inset-top,0px)+24px)]">
      {editing && (
        <button type="button" onClick={() => navigate(-1)} aria-label={pt.comum.voltar} className="-ml-1 p-1">
          <ChevronLeft size={26} />
        </button>
      )}
      <div className="mt-2 flex items-start justify-between">
        <h1 className="font-buky text-[48px]">
          {editing ? pt.perfil.editar.split(" ")[0] : pt.cadastro.completarTitulo1}
          <br />
          <span className="text-[var(--buky-neon)]">{editing ? pt.perfil.editar.split(" ").slice(1).join(" ") : pt.cadastro.completarTitulo2}</span>
        </h1>
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="Trocar foto" disabled={uploading}>
          <ProfileAvatar size={72} to={null} />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--buky-neon)] text-[#050505]">
            <Camera size={14} />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onAvatar(e.target.files?.[0])} />
      </div>
      {!editing && <p className="mt-3 text-[15px] text-[var(--buky-muted)]">{pt.cadastro.completarTexto}</p>}

      {editing && <CpfProfile />}
      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <label className="buky-field" data-invalid={inv("nome")}>
          <span>{pt.cadastro.nome}</span>
          <input autoComplete="name" value={f.nome} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
        </label>
        <label className="buky-field" data-invalid={inv("nickname")}>
          <span>Apelido (aparece no ranking) · {f.nickname.length}/20</span>
          <div className="flex gap-2"><span>@</span><input maxLength={20} value={f.nickname} onChange={(e) => setF((s) => ({ ...s, nickname: e.target.value.replace(/[^A-Za-z0-9_.]/g, "") }))} /></div>
        </label>
        <label className="buky-field">
          <span>E-mail</span>
          <input value={user?.email ?? p.email ?? ""} readOnly />
          <small>Para mudar o e-mail, fale com a 3buk</small>
        </label>
        <label className="buky-field" data-invalid={inv("phone")}>
          <span>Celular</span>
          <div className="flex gap-2"><span>+55</span><input type="tel" value={f.phone} placeholder="(21) 99999-9999" onChange={(e) => setF((s) => ({ ...s, phone: maskPhone(e.target.value) }))} /></div>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sameWhatsapp} onChange={(e) => setSameWhatsapp(e.target.checked)} /> Meu WhatsApp é o mesmo número
        </label>
        {!sameWhatsapp && <label className="buky-field" data-invalid={inv("whatsapp")}>
          <span>WhatsApp</span>
          <div className="flex gap-2"><span>+55</span><input type="tel" value={f.whatsapp} placeholder="(21) 99999-9999" onChange={(e) => setF((s) => ({ ...s, whatsapp: maskPhone(e.target.value) }))} /></div>
        </label>}
        <p className="text-xs text-[var(--buky-muted)]">Usamos seu celular e WhatsApp só para avisos de prêmios e da sua conta.</p>
        <label className="buky-field" data-invalid={inv("instagram")}>
          <span>{pt.cadastro.instagram} <em className="not-italic font-normal opacity-70">· {pt.cadastro.opcional}</em></span>
          <div className="flex items-center gap-1">
            <span className="text-[17px] text-[var(--buky-faint)]">@</span>
            <input autoCapitalize="none" autoCorrect="off" placeholder={pt.cadastro.instagramPh} value={f.instagram} onChange={(e) => setF((s) => ({ ...s, instagram: e.target.value }))} />
          </div>
        </label>
        <label className="buky-field" data-invalid={inv("bairro")}>
          <span>{pt.cadastro.bairro} <em className="not-italic font-normal opacity-70">· {pt.cadastro.opcional}</em></span>
          <input value={f.bairro} maxLength={80} onChange={(e) => setF((s) => ({ ...s, bairro: e.target.value }))} />
        </label>
        <CityPicker value={city} onChange={setCity} invalid={touched && !city} />
        {p.city && !p.city_code && !city && (
          <p className="text-xs text-[var(--buky-faint)]">Antes: “{p.city}”</p>
        )}
        <button type="submit" className="buky-btn !mt-8" disabled={save.isPending}>
          {save.isPending ? pt.comum.carregando : pt.cadastro.salvar}
        </button>
      </form>
    </main>
  );
}
