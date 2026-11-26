import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { listSponsors, saveSponsor, type Sponsor } from "./adminApi";
import { Badge, btnGhost, btnPrimary, card, Field, inputCls } from "./ui";
import { emailValid, instagramLink, mapsLink, mapsValid, phoneValid, whatsappLink } from "../lib/sponsorContact";

export default function AdminPatrocinadores() {
  const qc = useQueryClient();
  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ["admin-buky", "sponsors"],
    queryFn: listSponsors,
  });
  const [team, setTeam] = useState<Sponsor | null>(null);
  const [edit, setEdit] = useState<Partial<Sponsor> | null>(null);
  const [shown, setShown] = useState(25);

  const save = async () => {
    if (!edit?.name || edit.name.trim().length < 2)
      return toast.error("Informe o nome.");
    if (edit.whatsapp && !phoneValid(edit.whatsapp)) return toast.error("WhatsApp: use 8 a 15 dígitos, com + opcional.");
    if (edit.phone && !phoneValid(edit.phone)) return toast.error("Telefone: use 8 a 15 dígitos, com + opcional.");
    if (edit.contact_email && !emailValid(edit.contact_email)) return toast.error("Informe um e-mail válido.");
    if (edit.maps_url && !mapsValid(edit.maps_url)) return toast.error("O link de mapas deve começar com http:// ou https://.");
    if (edit.address && (edit.address.trim().length < 3 || edit.address.length > 300)) return toast.error("Endereço: use entre 3 e 300 caracteres.");
    try {
      await saveSponsor({
        ...edit,
        name: edit.name.trim(),
        instagram: edit.instagram?.replace(/^@/, "").trim() || null,
      });
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
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setEdit({ active: true })}
        >
          <Plus size={14} /> NOVO PATROCINADOR
        </button>
      </div>
      {edit && (
        <div className={`${card} mb-4 grid gap-3 p-4 md:grid-cols-4`}>
          <Field label="Nome">
            <input
              className={inputCls}
              value={edit.name ?? ""}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>
          <Field label="Instagram">
            <input
              className={inputCls}
              value={edit.instagram ?? ""}
              onChange={(e) => setEdit({ ...edit, instagram: e.target.value })}
              placeholder="perfil"
            />
          </Field>
          <Field label="Site">
            <input
              className={inputCls}
              value={edit.website ?? ""}
              onChange={(e) => setEdit({ ...edit, website: e.target.value })}
            />
          </Field>
          <Field label="Logo (URL)">
            <input
              className={inputCls}
              value={edit.logo_url ?? ""}
              onChange={(e) => setEdit({ ...edit, logo_url: e.target.value })}
            />
          </Field>
          {([
            ["WhatsApp", "whatsapp"], ["Telefone", "phone"], ["Endereço", "address"],
            ["E-mail de contato", "contact_email"], ["Link de mapas", "maps_url"],
          ] as const).map(([label, key]) => (
            <Field key={key} label={label}>
              <input className={inputCls} value={edit[key] ?? ""} onChange={(e) => setEdit({ ...edit, [key]: e.target.value })} />
            </Field>
          ))}
          <div className="flex flex-wrap gap-2 text-xs md:col-span-4" aria-label="Prévia dos botões de contato">
            {[
              ["Falar no WhatsApp", whatsappLink(edit.whatsapp, "seu cupom")],
              ["Ligar", edit.phone && phoneValid(edit.phone) ? `tel:${edit.phone}` : null],
              ["Ver Instagram", instagramLink(edit.instagram)],
              ["Como chegar", mapsLink(edit.maps_url, edit.address)],
            ].filter((item): item is [string, string] => Boolean(item[1])).map(([label, href]) => (
              <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={btnGhost}>{label}</a>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-4">
            <input
              type="checkbox"
              checked={edit.active ?? true}
              onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
            />{" "}
            Ativo
          </label>
          <div className="flex gap-2 md:col-span-4">
            <button type="button" className={btnPrimary} onClick={save}>
              <Save size={14} /> SALVAR
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setEdit(null)}
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}
      {team && <Team sponsor={team} onClose={() => setTeam(null)} />}
      <div className={`${card} overflow-hidden`}>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carregando…
          </p>
        ) : sponsors.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum patrocinador.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {[...sponsors].sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id)).slice(0, shown).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                {s.logo_url ? (
                  <img
                    src={s.logo_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[s.instagram && `@${s.instagram}`, s.website]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {s.active_members === 0 && <p className="text-[11px] text-amber-600">Sem membros ativos</p>}
                  {s.pending_invites > 0 && <p className="text-[11px] text-amber-600">{s.pending_invites} convite(s) pendente(s)</p>}
                </div>
                {s.active ? (
                  <Badge tone="green">ativo</Badge>
                ) : (
                  <Badge>inativo</Badge>
                )}
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setTeam(s)}
                >
                  EQUIPE
                </button>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setEdit(s)}
                >
                  EDITAR
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {sponsors.length > shown && <button type="button" className={`${btnGhost} mt-3`} onClick={() => setShown((n) => n + 25)}>Ver mais</button>}
    </div>
  );
}

function Team({ sponsor, onClose }: { sponsor: Sponsor; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [busy, setBusy] = useState(false);
  const members = useQuery({
    queryKey: ["sponsor-members", sponsor.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_buky_sponsor_team", {
        p_sponsor_id: sponsor.id,
      });
      if (error) throw error;
      return data as {
        user_id: string;
        name: string;
        email: string;
        role: string;
        revoked_at: string | null;
        status: "convidado" | "ativo" | "revogado";
      }[];
    },
  });
  const invite = async (targetEmail = email, targetRole = role) => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("invite-sponsor", {
        body: { sponsor_id: sponsor.id, email: targetEmail.trim(), role: targetRole },
      });
      if (error) throw error;
      toast.success("Convite enviado.");
      setEmail("");
      await members.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-buky", "sponsors"] });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    if (!confirm("Revogar o acesso deste membro?")) return;
    const { error } = await supabase.rpc("admin_buky_sponsor_revoke", {
      p_sponsor_id: sponsor.id,
      p_user_id: id,
    });
    if (error) toast.error(error.message);
    else {
      await members.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-buky", "sponsors"] });
    }
  };
  return (
    <section className={`${card} mb-4 p-4`}>
      <div className="flex justify-between">
        <h2 className="font-bold">Equipe · {sponsor.name}</h2>
        <button onClick={onClose}>Fechar</button>
      </div>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void invite();
        }}
      >
        <input
          className={inputCls}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
        />
        <select
          className={inputCls}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="staff">Equipe</option>
          <option value="owner">Responsável</option>
        </select>
        <button disabled={busy} className={btnPrimary}>
          Convidar
        </button>
      </form>
      {members.error ? (
        <p>Erro ao carregar equipe.</p>
      ) : members.isLoading ? (
        <p>Carregando…</p>
      ) : (
        members.data?.map((m) => (
          <div
            className="flex justify-between gap-3 border-b py-2"
            key={m.user_id}
          >
            <span>
              {m.name} · {m.email} · {m.role} · {m.status}
            </span>
            {m.status === "convidado" && <button className={btnGhost} disabled={busy} onClick={() => void invite(m.email, m.role)}>Reenviar convite</button>}
            {!m.revoked_at && (
              <button
                className={btnGhost}
                onClick={() => void revoke(m.user_id)}
              >
                Revogar
              </button>
            )}
          </div>
        ))
      )}
    </section>
  );
}
