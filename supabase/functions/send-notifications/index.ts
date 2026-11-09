// Despacha la cola con secreto de Vault; prueba de correo solo para ADMIN.
// Desplegar con --no-verify-jwt. Requiere RESEND_API_KEY y ONESIGNAL_REST_API_KEY.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { renderNotice } from "./logic.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-dispatch-secret",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const fromResult = await service
      .from("app_settings")
      .select("value")
      .eq("key", "notify_email_from")
      .single();
    const from =
      typeof fromResult.data?.value === "string"
        ? fromResult.data.value
        : "3buk <avisos@mail.3buk.com>";
    const sendEmail = async (
      to: string,
      content: { subject: string; html: string; text: string },
      key: string,
    ) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") ?? ""}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ from, to: [to], ...content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(`Resend ${response.status}: ${JSON.stringify(data)}`);
      return data.id as string;
    };
    if (body.test === true) {
      const auth = req.headers.get("Authorization") ?? "";
      const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const {
        data: { user },
        error,
      } = await caller.auth.getUser(auth.replace(/^Bearer /i, ""));
      const { data: isAdmin } = await caller.rpc("is_admin");
      if (error || !user || !isAdmin) return reply({ error: "forbidden" }, 403);
      const to = typeof body.to === "string" ? body.to.trim() : user.email;
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))
        return reply({ error: "invalid_email" }, 400);
      const id = await sendEmail(
        to,
        renderNotice({
          kind: "test",
          title: "Teste de avisos 3buk",
          message: "Este é um e-mail de teste.",
        }),
        `test:${crypto.randomUUID()}`,
      );
      return reply({ id });
    }
    const { data: allowed, error: secretError } = await service.rpc(
      "notify_dispatch_secret_ok",
      { p: req.headers.get("x-dispatch-secret") },
    );
    if (secretError || !allowed) return reply({ error: "unauthorized" }, 401);
    const { data: rows, error: claimError } = await service.rpc(
      "notify_outbox_claim",
      { p_limit: 20 },
    );
    if (claimError) throw claimError;
    for (const row of rows ?? []) {
      let status = "sent";
      let error: string | null = null;
      let provider: string | null = null;
      try {
        if (row.channel === "email") {
          if (
            !row.email ||
            (!row.email_notifications &&
              !["buky_raffle_won", "buky_raffle_substitute"].includes(row.kind))
          )
            status = "skipped";
          else
            provider = await sendEmail(
              row.email,
              renderNotice({
                kind: row.kind,
                title: row.subject,
                message: row.payload.message,
                prize: row.prize,
              }),
              row.dedupe_key,
            );
        } else {
          const response = await fetch(
            "https://api.onesignal.com/notifications",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${Deno.env.get("ONESIGNAL_REST_API_KEY") ?? ""}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                app_id: "f4c2d37d-d6a4-4209-9814-cf2c9cce92e1",
                include_aliases: { external_id: [row.user_id] },
                target_channel: "push",
                headings: { en: row.subject },
                contents: { en: row.payload.message },
              }),
            },
          );
          const data = await response.json().catch(() => ({}));
          if (
            !response.ok ||
            data.errors ||
            !data.id ||
            data.recipients === 0
          ) {
            status = "skipped";
            error = JSON.stringify(data);
          } else provider = data.id;
        }
      } catch (e) {
        status = row.channel === "push" ? "skipped" : "failed";
        error = String(e);
      }
      const { error: markError } = await service.rpc("notify_outbox_mark", {
        p_id: row.id,
        p_status: status,
        p_error: error,
        p_provider_id: provider,
      });
      if (markError) console.error("mark failed", row.id, markError);
    }
    return reply({ claimed: rows?.length ?? 0 });
  } catch (e) {
    console.error(e);
    return reply({ error: "dispatch_failed" }, 500);
  }
});
