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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Extraer multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");
    const filterRegionId = formData.get("filter_region_id")?.toString() || null;
    const filterSportId = formData.get("filter_sport_id")?.toString() || null;
    const filterEventDate = formData.get("filter_event_date")?.toString() || null;
    const filterPhotographerId = formData.get("filter_photographer_id")?.toString() || null;

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
      match_count: 50,
      filter_region_id: filterRegionId,
      filter_sport_id: filterSportId,
      filter_event_date: filterEventDate,
      filter_photographer_id: filterPhotographerId
    });

    if (matchError) {
      console.error("RPC Error:", matchError);
      throw new Error("Failed to match event photos in database");
    }

    let enrichedMatches = matches || [];
    if (enrichedMatches.length > 0) {
      const campaignIds = [...new Set(enrichedMatches.map(m => m.campaign_id).filter(Boolean))];
      const regionIds = [...new Set(enrichedMatches.map(m => m.region_id).filter(Boolean))];
      const sportIds = [...new Set(enrichedMatches.map(m => m.sport_id).filter(Boolean))];
      const photographerIds = [...new Set(enrichedMatches.map(m => m.photographer_id).filter(Boolean))];

      const [
        { data: campaigns },
        { data: regions },
        { data: sports },
        { data: photographers }
      ] = await Promise.all([
        campaignIds.length ? supabaseAdmin.from('campaigns').select('id, name').in('id', campaignIds) : Promise.resolve({ data: [] }),
        regionIds.length ? supabaseAdmin.from('regions').select('id, name').in('id', regionIds) : Promise.resolve({ data: [] }),
        sportIds.length ? supabaseAdmin.from('sports').select('id, name').in('id', sportIds) : Promise.resolve({ data: [] }),
        photographerIds.length ? supabaseAdmin.from('photographers').select('id, name').in('id', photographerIds) : Promise.resolve({ data: [] })
      ]);

      const campaignMap = new Map((campaigns || []).map(c => [c.id, c.name]));
      const regionMap = new Map((regions || []).map(r => [r.id, r.name]));
      const sportMap = new Map((sports || []).map(s => [s.id, s.name]));
      const photographerMap = new Map((photographers || []).map(p => [p.id, p.name]));

      enrichedMatches = enrichedMatches.map((m) => {
        let event_label = '';
        if (m.campaign_id) {
          event_label = campaignMap.get(m.campaign_id) || 'Evento Desconhecido';
        } else {
          let dateStr = null;
          if (m.event_date) {
            const [y, mth, d] = m.event_date.split('-');
            dateStr = `${d}/${mth}/${y}`;
          }
          const sportName = sportMap.get(m.sport_id);
          const parts = [sportName, m.city, dateStr].filter(Boolean);
          event_label = parts.length > 0 ? parts.join(' — ') : 'Evento Desconhecido';
        }

        return {
          ...m,
          event_label,
          photographer_name: photographerMap.get(m.photographer_id) || null
        };
      });
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
