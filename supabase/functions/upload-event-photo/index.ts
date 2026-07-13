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
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error(`Unauthorized: ${authError?.message || 'No user found'}`);
    }

    // 1.b. Verificar rol de ADMIN
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userData || userData.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: "Forbidden: Admins only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Extraer multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");
    const campaignId = formData.get("campaign_id");
    
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No image file provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!campaignId || typeof campaignId !== 'string') {
      return new Response(JSON.stringify({ error: "No campaign_id provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Obtener Embedding desde Railway (/embed)
    const railwayUrl = Deno.env.get("RAILWAY_SERVICE_URL") ?? "https://sua-racha-merece-production.up.railway.app";
    const serviceSecret = Deno.env.get("SERVICE_SECRET") ?? "";

    const railwayFormData = new FormData();
    railwayFormData.append("file", file);

    const railwayRes = await fetch(`${railwayUrl.replace(/\/$/, '')}/embed`, {
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

    // 4. Subir a Supabase Storage (event-photos)
    const fileExt = file.name.split('.').pop();
    const filePath = `${campaignId}/${crypto.randomUUID()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('event-photos')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError || !uploadData) {
      console.error("Storage Error:", uploadError);
      throw new Error("Failed to upload image to Storage");
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('event-photos').getPublicUrl(filePath);
    const imageUrl = publicUrlData.publicUrl;

    // 5. Insertar en Base de Datos (event_photos)
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('event_photos')
      .insert({
        campaign_id: campaignId,
        image_url: imageUrl,
        embedding: `[${embedding.join(',')}]`
      })
      .select()
      .single();

    // 6. Rollback si falla la inserción en BD
    if (insertError) {
      console.error("Database Insert Error:", insertError);
      
      console.log(`Rolling back: Deleting orphaned file ${filePath} from Storage`);
      await supabaseAdmin.storage.from('event-photos').remove([filePath]);
      
      throw new Error("Failed to save event photo record in database");
    }

    return new Response(JSON.stringify({ success: true, photo: insertData }), {
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
