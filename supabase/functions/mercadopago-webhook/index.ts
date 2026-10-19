// ============================================================
// 3BUK · Premium anual · Mercado Pago
// Edge Function mercadopago-webhook  (desplegar con --no-verify-jwt: lo llama Mercado Pago)
//
// Qué hace:
//   1. Valida la firma x-signature (si MP_WEBHOOK_SECRET está definido).
//   2. Consulta el pago en la API de Mercado Pago (fuente de verdad; no se confía en el body).
//   3. Cruza external_reference con public.payments, verifica monto y moneda.
//   4. Actualiza el estado y, si está aprobado, llama a apply_premium_payment (idempotente:
//      Mercado Pago puede avisar varias veces y el Premium solo se suma una vez).
// Un pago aprobado nunca retrocede a pending/rejected/cancelled. Reembolsos y contracargos
// se registran pero NO quitan el Premium automáticamente (decisión manual del admin).
//
// Secrets: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET (clave secreta del webhook en el panel de MP).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_MAP: Record<string, string> = {
  approved: "approved",
  authorized: "pending",
  pending: "pending",
  in_process: "pending",
  in_mediation: "pending",
  rejected: "rejected",
  cancelled: "cancelled",
  refunded: "refunded",
  charged_back: "charged_back",
};

const ok = (body: unknown = { ok: true }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function validSignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const signature = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts: Record<string, string> = {};
  for (const piece of signature.split(",")) {
    const [k, v] = piece.split("=").map((s) => s.trim());
    if (k && v) parts[k] = v;
  }
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return ok({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => null) : null;
    const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? body?.topic;
    const dataId = String(url.searchParams.get("data.id") ?? body?.data?.id ?? url.searchParams.get("id") ?? "");

    // Solo nos interesan los avisos de pago
    if (type !== "payment" || !/^\d+$/.test(dataId)) return ok({ ignored: true });

    const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
    if (webhookSecret && !(await validSignature(req, dataId, webhookSecret))) {
      console.warn("mercadopago-webhook: invalid signature");
      return ok({ error: "Invalid signature" }, 401);
    }

    const mpToken = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
    if (!mpToken) return ok({ error: "Not configured" }, 500);

    // Fuente de verdad: el pago en Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    if (!mpRes.ok) {
      console.error("MP payment fetch failed:", mpRes.status);
      return ok({ error: "Could not fetch payment" }, 502); // MP reintenta
    }
    const mp = await mpRes.json();

    const externalRef = String(mp.external_reference ?? "");
    if (!UUID_RE.test(externalRef)) return ok({ ignored: "no_reference" });

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: payment } = await admin
      .from("payments")
      .select("id, user_id, provider, product, amount_cents, currency, status")
      .eq("id", externalRef)
      .maybeSingle();
    if (!payment || payment.provider !== "mercadopago") return ok({ ignored: "unknown_payment" });

    // Monto y moneda deben coincidir con lo que registramos al crear el checkout
    const paidCents = Math.round(Number(mp.transaction_amount) * 100);
    if (paidCents !== payment.amount_cents || mp.currency_id !== payment.currency) {
      console.error("mercadopago-webhook: amount/currency mismatch", { paidCents, expected: payment.amount_cents, currency: mp.currency_id });
      return ok({ ignored: "amount_mismatch" });
    }

    const newStatus = STATUS_MAP[String(mp.status)] ?? "pending";
    const wasApproved = ["approved", "refunded", "charged_back"].includes(payment.status);
    // Un pago aprobado solo puede pasar a refunded/charged_back
    const finalStatus = wasApproved && !["refunded", "charged_back", "approved"].includes(newStatus) ? payment.status : newStatus;

    const update: Record<string, unknown> = { status: finalStatus, provider_payment_id: String(mp.id) };
    if (finalStatus === "approved") update.approved_at = mp.date_approved ?? new Date().toISOString();
    const { error: updError } = await admin.from("payments").update(update).eq("id", payment.id);
    if (updError) {
      console.error("payments update failed:", updError);
      return ok({ error: "Update failed" }, 500);
    }

    if (finalStatus === "approved") {
      const { data: applied, error: applyError } = await admin.rpc("apply_premium_payment", { p_payment_id: payment.id });
      if (applyError) {
        console.error("apply_premium_payment failed:", applyError);
        return ok({ error: "Apply failed" }, 500); // MP reintenta
      }
      return ok({ ok: true, applied });
    }

    return ok({ ok: true, status: finalStatus });
  } catch (err) {
    console.error("mercadopago-webhook error:", err);
    return ok({ error: "Internal error" }, 500);
  }
});
