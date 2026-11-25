import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { emailValid, mapsValid, phoneValid, type SponsorContact } from "@/features/buky/lib/sponsorContact";

const fields = [
  ["WhatsApp", "whatsapp"], ["Telefone", "phone"], ["Endereço", "address"],
  ["E-mail de contato", "contact_email"], ["Link de mapas", "maps_url"],
  ["Instagram", "instagram"], ["Site", "website"], ["Logo (URL)", "logo_url"],
] as const;

export default function SponsorData({ sponsorId }: { sponsorId: string }) {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["sponsor-own-data", sponsorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("buky_sponsor_own_data", { p_sponsor_id: sponsorId });
      if (error) throw error;
      return data as SponsorContact;
    },
  });
  const [form, setForm] = useState<SponsorContact>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data.data) setForm(data.data); }, [data.data]);
  const save = async () => {
    if (form.whatsapp && !phoneValid(form.whatsapp)) return setMessage("WhatsApp inválido: use 8 a 15 dígitos.");
    if (form.phone && !phoneValid(form.phone)) return setMessage("Telefone inválido: use 8 a 15 dígitos.");
    if (form.contact_email && !emailValid(form.contact_email)) return setMessage("E-mail inválido.");
    if (form.maps_url && !mapsValid(form.maps_url)) return setMessage("Link de mapas inválido.");
    if (form.address && (form.address.trim().length < 3 || form.address.length > 300)) return setMessage("Endereço: use entre 3 e 300 caracteres.");
    setBusy(true);
    setMessage("");
    try {
      const values = Object.fromEntries(fields.map(([, key]) => [key, form[key]?.trim() || null]));
      const { error } = await supabase.rpc("buky_sponsor_update_own_data", { p_sponsor_id: sponsorId, p_data: values });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["sponsor-own-data", sponsorId] });
      setMessage("Dados salvos.");
    } catch {
      setMessage("Não foi possível salvar os dados. Confira os campos e tente novamente.");
    } finally { setBusy(false); }
  };
  if (data.isLoading) return <p>Carregando…</p>;
  if (data.isError) return <p>Não foi possível carregar os dados.</p>;
  return <section className="space-y-3">
    <h2 className="font-bold">Meus dados · {data.data?.name}</h2>
    {fields.map(([label, key]) => <label key={key} className="block text-sm">
      {label}
      <input className="mt-1 w-full rounded border bg-background p-3" value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>)}
    <button type="button" disabled={busy} onClick={() => void save()} className="min-h-11 rounded bg-primary px-4 font-bold text-primary-foreground">Salvar dados</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
