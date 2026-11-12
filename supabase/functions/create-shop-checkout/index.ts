import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const token = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
    if (!token) return json({ error: "payment_unavailable" }, 503);
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });
    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);
    const { order_id, kind } = await req.json();
    const freight = kind === "freight";
    const { data: order } = await caller
      .from("shop_orders")
      .select("id,total_cents,freight_cents,freight_due_at,reserved_until")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!order) return json({ error: "order_not_found" }, 404);
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: paymentId, error } = await admin.rpc(
      freight ? "shop_begin_freight_checkout" : "shop_begin_checkout",
      {
        p_order_id: order.id,
        p_user_id: user.id,
      },
    );
    if (error || !paymentId) return json({ error: "order_not_payable" }, 409);
    const site = (Deno.env.get("SITE_URL") ?? "https://www.3buk.com").replace(
      /\/+$/,
      "",
    );
    const back = `${site}/app/loja/pedido/${order.id}?pagamento=`;
    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": paymentId,
        },
        body: JSON.stringify({
          items: [
            {
              id: order.id,
              title: "Loja 3buk",
              quantity: 1,
              currency_id: "BRL",
              unit_price:
                (freight ? order.freight_cents : order.total_cents) / 100,
            },
          ],
          metadata: {
            product: freight ? "shop_freight" : "shop_order",
            order_id: order.id,
          },
          external_reference: paymentId,
          payer: user.email ? { email: user.email } : undefined,
          back_urls: {
            success: `${back}success`,
            pending: `${back}pending`,
            failure: `${back}failure`,
          },
          auto_return: "approved",
          notification_url: `${url}/functions/v1/mercadopago-webhook`,
          expiration_date_to: freight ? undefined : order.reserved_until,
          expires: !freight,
          statement_descriptor: "3BUK",
          payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
        }),
      },
    );
    const data = await response.json();
    if (!response.ok || !data.id) {
      await admin
        .from("payments")
        .update({ status: "cancelled" })
        .eq("id", paymentId);
      await admin
        .from("shop_orders")
        .update(
          freight
            ? { freight_payment_id: null, freight_payment_method: null }
            : { payment_id: null, payment_method: null },
        )
        .eq("id", order.id)
        .eq(freight ? "freight_payment_id" : "payment_id", paymentId)
        .eq("status", freight ? "freight_pending" : "pending_payment");
      return json({ error: "payment_unavailable" }, 502);
    }
    await admin
      .from("payments")
      .update({ preference_id: data.id })
      .eq("id", paymentId);
    return json({
      checkout_url: token.startsWith("TEST-")
        ? (data.sandbox_init_point ?? data.init_point)
        : data.init_point,
      payment_id: paymentId,
    });
  } catch (error) {
    console.error(error);
    return json({ error: "internal_error" }, 500);
  }
});
