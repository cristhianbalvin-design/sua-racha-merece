import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Camera, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiUploadAvatar } from "@/lib/mockApi";
import { pt } from "../i18n";
import CityPicker from "../components/CityPicker";
import { ProfileAvatar, Spinner } from "../components/ui";
import type { City } from "../lib/api";
import { getCity } from "../lib/api";
import { isProfileComplete, useBukyProfile, useUpdateProfile } from "../lib/hooks";
import { clearPendingProfile, takePendingProfile } from "../lib/pendingProfile";
import { cleanInstagram, isValidInstagram, isValidName, isValidNeighborhood } from "../lib/validation";

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
  const [f, setF] = useState({ nome: "", instagram: "", bairro: "" });
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
    });
    const code = p.city_code ?? pending?.city_code;
    if (code) void getCity(code).then(setCity);
  }, [p]);

  if (isLoading || !p) return <Spinner label={pt.comum.carregando} />;

  const E = pt.cadastro.erros;
  const errs = {
    nome: !isValidName(f.nome) ? E.nome : null,
    instagram: !isValidInstagram(f.instagram) ? E.instagram : null,
    bairro: !isValidNeighborhood(f.bairro) ? E.bairro : null,
    cidade: !city ? E.cidade : null,
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
        instagram: cleanInstagram(f.instagram),
        neighborhood: f.bairro.trim(),
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
      const url = await apiUploadAvatar(file, user.id);
      if (url) {
        await save.mutateAsync({ avatar_url: url });
        updateUserContext({ avatar: url });
      }
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

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <label className="buky-field" data-invalid={inv("nome")}>
          <span>{pt.cadastro.nome}</span>
          <input autoComplete="name" value={f.nome} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
        </label>
        <label className="buky-field" data-invalid={inv("instagram")}>
          <span>{pt.cadastro.instagram}</span>
          <div className="flex items-center gap-1">
            <span className="text-[17px] text-[var(--buky-faint)]">@</span>
            <input autoCapitalize="none" autoCorrect="off" placeholder={pt.cadastro.instagramPh} value={f.instagram} onChange={(e) => setF((s) => ({ ...s, instagram: e.target.value }))} />
          </div>
        </label>
        <label className="buky-field" data-invalid={inv("bairro")}>
          <span>{pt.cadastro.bairro}</span>
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
