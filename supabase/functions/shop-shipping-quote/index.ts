import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildPackage, mapOptions } from "./logic.ts";
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
    const token = Deno.env.get("MELHOR_ENVIO_TOKEN");
    if (!token) return json({ error: "shipping_unavailable" }, 503);
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);
    const body = await req.json();
    const cep = String(body.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8 || !Array.isArray(body.items))
      return json({ error: "invalid_request" }, 400);
    const { data: packageData, error } = await caller.rpc(
      "shop_quote_package",
      { p_items: body.items },
    );
    if (error || !packageData) return json({ error: "invalid_items" }, 400);
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const ids = [
      ...new Set(
        body.items.map((item: { variant_id: string }) => item.variant_id),
      ),
    ];
    const { data: variants, error: variantsError } = await admin
      .from("shop_variants")
      .select("id,shop_products(weight_kg,width_cm,height_cm,length_cm)")
      .in("id", ids);
    if (variantsError || !variants || variants.length !== ids.length)
      return json({ error: "invalid_items" }, 400);
    const packageItems = body.items.map(
      (item: { variant_id: string; qty: number }) => {
        const variant = variants.find(
          (v: { id: string }) => v.id === item.variant_id,
        );
        if (!variant || !variant.shop_products) throw new Error("invalid_items");
        return { ...variant.shop_products, qty: item.qty };
      },
    );
    const parcel = buildPackage(packageItems);
    const { data: origin } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "shop_origin_cep")
      .maybeSingle();
    const base =
      Deno.env.get("MELHOR_ENVIO_SANDBOX") === "true"
        ? "https://sandbox.melhorenvio.com.br"
        : "https://melhorenvio.com.br";
    const response = await fetch(`${base}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": Deno.env.get("MELHOR_ENVIO_USER_AGENT") ?? "",
      },
      body: JSON.stringify({
        from: { postal_code: origin?.value ?? "24210470" },
        to: { postal_code: cep },
        package: parcel,
      }),
    });
    if (!response.ok) return json({ error: "shipping_unavailable" }, 503);
    const options = mapOptions(await response.json());
    if (!options.length) return json({ error: "shipping_unavailable" }, 503);
    const { data: quote, error: insertError } = await admin
      .from("shop_shipping_quotes")
      .insert({
        user_id: user.id,
        cep,
        items_hash: packageData.items_hash,
        options,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (insertError) return json({ error: "shipping_unavailable" }, 503);
    return json({ quote_id: quote.id, options });
  } catch (error) {
    console.error(error);
    return json({ error: "shipping_unavailable" }, 503);
  }
});
