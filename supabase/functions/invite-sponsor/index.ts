// Invita a miembros (solo ADMIN) y permite solicitar un reenvío público.
// Requiere los pasos 28 y 29 y RESEND_API_KEY. No usa el SMTP de Supabase.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers });
const accessUrl = "https://www.3buk.com/patrocinador/acesso";
const genericMessage = "Se este e-mail pertence a uma equipe de patrocinador, enviamos um novo link.";
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (body?.action === "resend") {
      try {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          const { data: existing, error: findError } = await admin.from("users").select("id").ilike("email", email).maybeSingle();
          if (findError) throw findError;
          if (existing) {
            const { data: member, error: memberError } = await admin.from("buky_sponsor_members")
              .select("sponsor_id").eq("user_id", existing.id).is("revoked_at", null).limit(1).maybeSingle();
            if (memberError) throw memberError;
            if (member) {
              const { data: allowed, error: claimError } = await admin.rpc("buky_claim_sponsor_access_resend", { p_email: email });
              if (claimError) throw claimError;
              if (allowed) {
                const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: accessUrl } });
                if (error || !data.properties?.action_link) throw error ?? new Error("missing link");
                await sendEmail(admin, email, "Acesso à equipe de patrocinador", "Você pediu um novo link para acessar sua equipe de patrocinador.", data.properties.action_link, true);
              }
            }
          }
        }
      } catch (error) {
        console.error("resend failed", error);
      }
      return json({ message: genericMessage });
    }
    const authorization = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser(authorization.replace(/^Bearer /i, ""));
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (authError || !user || !isAdmin)
      return json({ error: "forbidden" }, 403);
    const role = body?.role ?? "staff";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body?.sponsor_id ?? "",
      ) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["owner", "staff"].includes(role)
    )
      return json({ error: "invalid_input" }, 400);
    const { data: sponsor, error: spErr } = await admin
      .from("buky_sponsors")
      .select("id,name,active")
      .eq("id", body.sponsor_id)
      .maybeSingle();
    if (spErr) throw spErr;
    if (!sponsor?.active) return json({ error: "sponsor_not_found" }, 404);
    const { data: existing, error: findErr } = await admin
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (findErr) throw findErr;
    let userId = existing?.id;
    let link = "https://www.3buk.com/patrocinador";
    let created = false;
    if (!userId) {
      const { error: pendingError } = await admin
        .from("buky_sponsor_invites")
        .upsert({ email, created_at: new Date().toISOString() });
      if (pendingError) throw pendingError;
      const { data, error } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: accessUrl, data: { invited_sponsor: true } },
      });
      await admin.from("buky_sponsor_invites").delete().eq("email", email);
      if (error || !data.user || !data.properties?.action_link)
        return json(
          { error: "invite_creation_failed", detail: error?.message },
          500,
        );
      userId = data.user.id;
      link = data.properties.action_link;
      created = true;
      const { error: metadataError } = await admin.auth.admin.updateUserById(
        userId,
        { app_metadata: { invited_sponsor: true } },
      );
      if (metadataError) console.error("app metadata", metadataError);
    } else {
      const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(userId);
      if (authLookupError || !authData.user) throw authLookupError ?? new Error("user not found");
      if (!authData.user.last_sign_in_at) {
        const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: accessUrl } });
        if (error || !data.properties?.action_link) throw error ?? new Error("missing link");
        link = data.properties.action_link;
      }
    }
    const { error: memberError } = await admin
      .from("buky_sponsor_members")
      .upsert(
        {
          sponsor_id: sponsor.id,
          user_id: userId,
          role,
          invited_email: email,
          invited_by: user.id,
          revoked_at: null,
        },
        { onConflict: "sponsor_id,user_id" },
      );
    if (memberError) {
      if (created) await admin.auth.admin.deleteUser(userId);
      throw memberError;
    }
    const sent = await sendEmail(admin, email, `Convite para a equipe de ${sponsor.name}`, `Você foi adicionado à equipe de ${sponsor.name}.`, link, link !== "https://www.3buk.com/patrocinador");
    if (!sent)
      return json(
        { error: "email_failed", membership_created: true, user_id: userId },
        502,
      );
    return json({ success: true, user_id: userId, created });
  } catch (e) {
    console.error(e);
    return json({ error: "invite_failed" }, 500);
  }
});

async function sendEmail(admin: ReturnType<typeof createClient>, email: string, subject: string, intro: string, link: string, temporary: boolean) {
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "notify_email_from").single();
  const from = typeof setting?.value === "string" ? setting.value : "3buk <avisos@mail.3buk.com>";
  const expiry = temporary ? `Este link vale por tempo limitado. Se expirar, peça um novo em ${accessUrl}.` : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject, text: `${intro} Acesse ${link}\n\n${expiry}`,
      html: `<p>${esc(intro)}</p><p><a href="${esc(link)}">Acessar o portal</a></p><p>${esc(expiry)}</p>` }),
  });
  return response.ok;
}
