// Invita o incorpora un miembro de patrocinador. Solo ADMIN; verify_jwt activado.
// Requiere el paso 28 y RESEND_API_KEY. No usa el SMTP de Supabase.
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
    const body = await req.json().catch(() => null);
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body?.role ?? "staff";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body?.sponsor_id ?? "",
      ) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["owner", "staff"].includes(role)
    )
      return json({ error: "invalid_input" }, 400);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
        options: { redirectTo: link, data: { invited_sponsor: true } },
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
    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "notify_email_from")
      .single();
    const from =
      typeof setting?.value === "string"
        ? setting.value
        : "3buk <avisos@mail.3buk.com>";
    const text = `Você foi adicionado à equipe de ${sponsor.name}. Acesse ${link}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Convite para a equipe de ${sponsor.name}`,
        text,
        html: `<p>Você foi adicionado à equipe de ${esc(sponsor.name)}.</p><p><a href="${esc(link)}">Acessar o portal</a></p>`,
      }),
    });
    if (!response.ok)
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
