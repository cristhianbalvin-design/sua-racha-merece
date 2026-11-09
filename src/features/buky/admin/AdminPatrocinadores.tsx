import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { listSponsors, saveSponsor, type Sponsor } from "./adminApi";
import { Badge, btnGhost, btnPrimary, card, Field, inputCls } from "./ui";

export default function AdminPatrocinadores() {
  const qc = useQueryClient();
  const { data: sponsors = [], isLoading } = useQuery({ queryKey: ["admin-buky", "sponsors"], queryFn: listSponsors });
  const [team, setTeam] = useState<Sponsor | null>(null);
  const [edit, setEdit] = useState<Partial<Sponsor> | null>(null);

  const save = async () => {
    if (!edit?.name || edit.name.trim().length < 2) return toast.error("Informe o nome.");
    try {
      await saveSponsor({ ...edit, name: edit.name.trim(), instagram: edit.instagram?.replace(/^@/, "").trim() || null });
      toast.success("Patrocinador salvo.");
      setEdit(null);
      await qc.invalidateQueries({ queryKey: ["admin-buky", "sponsors"] });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className={btnPrimary} onClick={() => setEdit({ active: true })}>
          <Plus size={14} /> NOVO PATROCINADOR
        </button>
      </div>
      {edit && (
        <div className={`${card} mb-4 grid gap-3 p-4 md:grid-cols-4`}>
          <Field label="Nome"><input className={inputCls} value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Instagram"><input className={inputCls} value={edit.instagram ?? ""} onChange={(e) => setEdit({ ...edit, instagram: e.target.value })} placeholder="perfil" /></Field>
          <Field label="Site"><input className={inputCls} value={edit.website ?? ""} onChange={(e) => setEdit({ ...edit, website: e.target.value })} /></Field>
          <Field label="Logo (URL)"><input className={inputCls} value={edit.logo_url ?? ""} onChange={(e) => setEdit({ ...edit, logo_url: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm md:col-span-4">
            <input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Ativo
          </label>
          <div className="flex gap-2 md:col-span-4">
            <button type="button" className={btnPrimary} onClick={save}><Save size={14} /> SALVAR</button>
            <button type="button" className={btnGhost} onClick={() => setEdit(null)}>CANCELAR</button>
          </div>
        </div>
      )}
      {team && <Team sponsor={team} onClose={() => setTeam(null)} />}
      <div className={`${card} overflow-hidden`}>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : sponsors.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum patrocinador.</p>
        ) : (
          <div className="divide-y divide-border">
            {sponsors.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                {s.logo_url ? <img src={s.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="h-8 w-8 rounded-full bg-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{[s.instagram && `@${s.instagram}`, s.website].filter(Boolean).join(" · ")}</p>
                </div>
                {s.active ? <Badge tone="green">ativo</Badge> : <Badge>inativo</Badge>}
                <button type="button" className={btnGhost} onClick={() => setTeam(s)}>EQUIPE</button>
                <button type="button" className={btnGhost} onClick={() => setEdit(s)}>EDITAR</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Team({ sponsor, onClose }: { sponsor: Sponsor; onClose: () => void }) {
  const [email, setEmail] = useState(""); const [role, setRole] = useState("staff"); const [busy, setBusy] = useState(false);
  const members = useQuery({ queryKey: ["sponsor-members", sponsor.id], queryFn: async () => { const { data, error } = await supabase.rpc("admin_buky_sponsor_members", { p_sponsor_id: sponsor.id }); if (error) throw error; return data as { user_id: string; name: string; email: string; role: string; revoked_at: string | null }[]; } });
  const invite = async () => { setBusy(true); try { const { error } = await supabase.functions.invoke("invite-sponsor", { body: { sponsor_id: sponsor.id, email: email.trim(), role } }); if (error) throw error; toast.success("Convite enviado."); setEmail(""); await members.refetch(); } catch (e) { toast.error(`Erro: ${(e as Error).message}`); } finally { setBusy(false); } };
  const revoke = async (id: string) => { if (!confirm("Revogar o acesso deste membro?")) return; const { error } = await supabase.rpc("admin_buky_sponsor_revoke", { p_sponsor_id: sponsor.id, p_user_id: id }); if (error) toast.error(error.message); else await members.refetch(); };
  return <section className={`${card} mb-4 p-4`}><div className="flex justify-between"><h2 className="font-bold">Equipe ? {sponsor.name}</h2><button onClick={onClose}>Fechar</button></div><form className="mt-3 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void invite(); }}><input className={inputCls} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail"/><select className={inputCls} value={role} onChange={e => setRole(e.target.value)}><option value="staff">Equipe</option><option value="owner">Respons?vel</option></select><button disabled={busy} className={btnPrimary}>Convidar</button></form>{members.error ? <p>Erro ao carregar equipe.</p> : members.isLoading ? <p>Carregando?</p> : members.data?.map(m => <div className="flex justify-between gap-3 border-b py-2" key={m.user_id}><span>{m.name} ? {m.email} ? {m.role} {m.revoked_at && "? revogado"}</span>{!m.revoked_at && <button className={btnGhost} onClick={() => void revoke(m.user_id)}>Revogar</button>}</div>)}</section>;
}
