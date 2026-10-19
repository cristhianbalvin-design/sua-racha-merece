// ============================================================
// 3BUK · Premium anual · Mercado Pago
// Edge Function sync-premium-payment  (verify_jwt ACTIVADO)
//
// Respaldo del webhook: el usuario autenticado pide verificar SUS pagos de Premium que siguen
// pendientes o sin aplicar. Para cada uno consulta a Mercado Pago por external_reference y, si
// está aprobado (monto y moneda correctos), lo marca aprobado y llama a apply_premium_payment
// (idempotente, así que webhook y sync no duplican nada).
//
// Solo toca pagos del propio usuario creados en los últimos 7 días. Secret: MP_ACCESS_TOKEN.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const mpToken = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
    if (!mpToken) return json({ error: "Payment provider not configured" }, 500);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Pagos del usuario aún no aplicados (pendientes, o aprobados sin aplicar), últimos 7 días
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: payments, error: listError } = await admin
      .from("payments")
      .select("id, amount_cents, currency, status, premium_applied_at")
      .eq("user_id", user.id)
      .eq("provider", "mercadopago")
      .eq("product", "premium_annual")
      .is("premium_applied_at", null)
      .in("status", ["pending", "approved"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    if (listError) {
      console.error("sync list failed:", listError);
      return json({ error: "Internal error" }, 500);
    }
    if (!payments || payments.length === 0) return json({ checked: 0, applied: false });

    let appliedAny = false;
    let premiumUntil: string | null = null;

    for (const payment of payments) {
      let approved: { id: number | string; date_approved?: string } | null = null;

      if (payment.status === "approved") {
        approved = { id: "" }; // ya aprobado por el webhook, solo falta aplicar
      } else {
        const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${payment.id}&sort=date_created&criteria=desc`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${mpToken}` } });
        if (!res.ok) {
          console.error("MP search failed:", res.status);
          continue;
        }
        const body = await res.json();
        const hit = (body?.results ?? []).find((p: Record<string, unknown>) =>
          p.status === "approved" &&
          Math.round(Number(p.transaction_amount) * 100) === payment.amount_cents &&
          p.currency_id === payment.currency
        );
        if (!hit) continue;
        approved = { id: hit.id, date_approved: hit.date_approved };
      }

      if (payment.status !== "approved") {
        const { error: updError } = await admin
          .from("payments")
          .update({
            status: "approved",
            provider_payment_id: String(approved.id),
            approved_at: approved.date_approved ?? new Date().toISOString(),
          })
          .eq("id", payment.id)
          .eq("status", "pending");
        if (updError) {
          console.error("sync update failed:", updError);
          continue;
        }
      }

      const { data: applied, error: applyError } = await admin.rpc("apply_premium_payment", { p_payment_id: payment.id });
      if (applyError) {
        console.error("apply_premium_payment failed:", applyError);
        continue;
      }
      if (applied?.applied === true) {
        appliedAny = true;
        premiumUntil = applied.premium_until ?? premiumUntil;
      }
    }

    return json({ checked: payments.length, applied: appliedAny, premium_until: premiumUntil });
  } catch (err) {
    console.error("sync-premium-payment error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
