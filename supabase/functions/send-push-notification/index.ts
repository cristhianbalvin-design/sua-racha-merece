import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONESIGNAL_APP_ID = "f4c2d37d-d6a4-4209-9814-cf2c9cce92e1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email } = await req.json();
    const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!restApiKey) {
      return new Response(JSON.stringify({ error: "ONESIGNAL_REST_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        filters: [{ field: "tag", key: "role", relation: "=", value: "admin" }],
        contents: {
          en: `Novo atleta registrado: ${name} (${email})`,
          pt: `Novo atleta registrado: ${name} (${email})`,
        },
        headings: {
          en: "Novo Registro 3BUK!",
          pt: "Novo Registro 3BUK!",
        },
        chrome_web_icon: "https://ljizlialjsonmmvppoqh.supabase.co/storage/v1/object/public/popups/assets/3buk-notification-icon.png",
        chrome_web_badge: "https://ljizlialjsonmmvppoqh.supabase.co/storage/v1/object/public/popups/assets/3buk-notification-icon.png",
        large_icon: "https://ljizlialjsonmmvppoqh.supabase.co/storage/v1/object/public/popups/assets/3buk-notification-icon.png",
      }),
    });

    const data = await res.json();
    console.log("OneSignal response:", JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
