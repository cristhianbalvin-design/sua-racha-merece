// ============================================================
// 3BUK · Premium anual (R$ 50, pago único) y recargas de saldo · Mercado Pago Checkout Pro
// Edge Function create-premium-checkout  (verify_jwt ACTIVADO)
//
// Cuerpo (opcional): { product?: "premium_annual" | "wallet_topup", amount_cents?: number, return_to?: "app" | "web" }
//   · premium_annual (por defecto): R$ 50. Siempre dinero nuevo: el saldo no paga el Premium.
//   · wallet_topup: solo los montos de app_settings.wallet_topup_options (hoy R$20, R$30 y R$50).
//
// Qué hace (usuario autenticado):
//   1. Crea una fila en public.payments (status 'pending', con el producto y el monto validados aquí).
//   2. Crea una preferencia de Checkout Pro con external_reference = payments.id.
//   3. Devuelve la URL de pago (tarjeta y Pix; se excluye boleto).
// El Premium NO se activa aquí: lo activa mercadopago-webhook cuando el pago se aprueba.
//
// Variables de entorno (secrets):
//   MP_ACCESS_TOKEN  → Access Token de Mercado Pago (TEST-... en pruebas, APP_USR-... en producción)
//   SITE_URL         → opcional; por defecto https://www.3buk.com
// El precio vive aquí (servidor), nunca viene del cliente.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const PREMIUM_PRICE_CENTS = 5000; // R$ 50,00
const CURRENCY = "BRL";

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://www.3buk.com").replace(/\/+$/, "");

    if (!mpToken) return json({ error: "Payment provider not configured" }, 500);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Producto y monto: se validan en el servidor, nunca se confía en el cliente
    const body = await req.json().catch(() => ({})) as { product?: string; amount_cents?: number; return_to?: string };
    const product = body.product === "wallet_topup" ? "wallet_topup" : "premium_annual";
    let amountCents = PREMIUM_PRICE_CENTS;
    if (product === "wallet_topup") {
      const { data: opt } = await admin.from("app_settings").select("value").eq("key", "wallet_topup_options").maybeSingle();
      const options = Array.isArray(opt?.value) ? (opt!.value as unknown[]).map(Number) : [2000, 3000, 5000];
      if (!options.includes(Number(body.amount_cents))) return json({ error: "invalid_amount" }, 400);
      amountCents = Number(body.amount_cents);
    }
    const back = body.return_to === "app" ? `${siteUrl}/app/perfil/saldo?pagamento=` : `${siteUrl}/creditos?premium=`;

    // 1. Registro del pago pendiente
    const { data: payment, error: insertError } = await admin
      .from("payments")
      .insert({
        user_id: user.id,
        provider: "mercadopago",
        product,
        amount_cents: amountCents,
        currency: CURRENCY,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertError || !payment) {
      console.error("payments insert failed:", insertError);
      return json({ error: "Could not create payment" }, 500);
    }

    // 2. Preferencia de Checkout Pro
    const preference = {
      items: [{
        id: product,
        title: product === "wallet_topup" ? `3BUK — Recarga de saldo R$ ${amountCents / 100}` : "3BUK Premium — 1 ano",
        quantity: 1,
        currency_id: CURRENCY,
        unit_price: amountCents / 100,
      }],
      external_reference: payment.id,
      payer: user.email ? { email: user.email } : undefined,
      back_urls: {
        success: `${back}success`,
        pending: `${back}pending`,
        failure: `${back}failure`,
      },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "3BUK",
      payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": payment.id,
      },
      body: JSON.stringify(preference),
    });
    const mpBody = await mpRes.json().catch(() => null);

    if (!mpRes.ok || !mpBody?.id) {
      console.error("MP preference failed:", mpRes.status, JSON.stringify(mpBody));
      await admin.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
      return json({ error: "Could not create checkout" }, 502);
    }

    await admin.from("payments").update({ preference_id: mpBody.id }).eq("id", payment.id);

    // Con credenciales de prueba se usa el checkout sandbox.
    const checkoutUrl = mpToken.startsWith("TEST-") ? (mpBody.sandbox_init_point ?? mpBody.init_point) : mpBody.init_point;
    return json({ checkout_url: checkoutUrl, payment_id: payment.id });
  } catch (err) {
    console.error("create-premium-checkout error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
