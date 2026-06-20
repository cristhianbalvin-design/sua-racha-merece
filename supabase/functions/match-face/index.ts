import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Cliente con tokens de usuario para verificar su sesión
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Extraer multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No image file provided" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 3. Reenviar foto a Railway /compare
    const railwayUrl = Deno.env.get("RAILWAY_SERVICE_URL") ?? "https://sua-racha-merece-production.up.railway.app";
    const serviceSecret = Deno.env.get("SERVICE_SECRET") ?? "";

    const railwayFormData = new FormData();
    railwayFormData.append("file", file);

    const railwayRes = await fetch(`${railwayUrl.replace(/\/$/, '')}/compare`, {
      method: "POST",
      headers: {
        "X-Service-Secret": serviceSecret,
      },
      body: railwayFormData,
    });

    if (!railwayRes.ok) {
      const errorText = await railwayRes.text();
      console.error("Railway error response:", railwayRes.status, errorText);
      return new Response(JSON.stringify({ error: `Face recognition service failed: ${railwayRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { embedding } = await railwayRes.json();
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid embedding returned from Railway");
    }

    // 4 & 5. Llamar al RPC usando Service Role para bypassear RLS y buscar similitudes
    const threshold = parseFloat(Deno.env.get("SIMILARITY_THRESHOLD") ?? "0.55");
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: matches, error: matchError } = await supabaseAdmin.rpc("match_event_photos", {
      query_embedding: `[${embedding.join(',')}]`, // pgvector string format
      match_threshold: threshold,
      match_count: 50
    });

    if (matchError) {
      console.error("RPC Error:", matchError);
      throw new Error("Failed to match event photos in database");
    }

    let enrichedMatches = matches || [];
    if (enrichedMatches.length > 0) {
      const campaignIds = [...new Set(enrichedMatches.map((m) => m.campaign_id))];
      const { data: campaigns, error: campError } = await supabaseAdmin
        .from('campaigns')
        .select('id, title')
        .in('id', campaignIds);

      if (!campError && campaigns) {
        const campaignMap = new Map(campaigns.map((c) => [c.id, c.title]));
        enrichedMatches = enrichedMatches.map((m) => ({
          ...m,
          campaign_title: campaignMap.get(m.campaign_id) || 'Evento Desconhecido'
        }));
      }
    }

    // 6 & 7. Devolver las fotos. El embedding NO SE GUARDA en ningún lado.
    return new Response(JSON.stringify({ matches: enrichedMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
