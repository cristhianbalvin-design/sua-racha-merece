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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Restricciones que aplican SOLO a fotógrafos (el admin conserva su flujo actual)
const PHOTOGRAPHER_MAX_BYTES = 20 * 1024 * 1024;
const PHOTOGRAPHER_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Columnas devueltas a un fotógrafo (sin embedding)
const PHOTOGRAPHER_SELECT =
  "id, image_url, status, region_id, sport_id, city, photographer_id, event_date, created_at";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error(`Unauthorized: ${authError?.message || "No user found"}`);
    }

    // 1.b. Determinar quién llama: ADMIN o FOTÓGRAFO
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = userData?.role === "ADMIN";

    let ownPhotographerId: string | null = null;
    let termsAcceptedAt: string | null = null;
    if (!isAdmin) {
      const { data: photographerRow } = await supabaseAdmin
        .from("photographers")
        .select("id, terms_accepted_at")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      ownPhotographerId = photographerRow?.id ?? null;
      termsAcceptedAt = photographerRow?.terms_accepted_at ?? null;
    }

    if (!isAdmin && !ownPhotographerId) {
      return json({ error: "Forbidden" }, 403);
    }

    // El fotógrafo debe haber aceptado sus términos antes de subir (Paso 4)
    if (!isAdmin && !termsAcceptedAt) {
      return json({ error: "terms_not_accepted" }, 403);
    }

    // 2. Extraer multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");

    const regionId = formData.get("region_id");
    const sportId = formData.get("sport_id");
    const rawCity = formData.get("city")?.toString() || "";
    const exceptions = ["de", "da", "do", "dos", "das", "e"];
    const city = rawCity.trim().toLowerCase().split(/\s+/).map((word, i) => {
      if (i === 0 || !exceptions.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    }).join(" ");
    const eventDate = formData.get("event_date");

    // Admin: photographer_id viene del formulario (como antes).
    // Fotógrafo: se ignora el valor del body y se usa el propio.
    const photographerId: FormDataEntryValue | string | null = isAdmin
      ? formData.get("photographer_id")
      : ownPhotographerId;

    if (!file || !(file instanceof File)) {
      return json({ error: "No image file provided" }, 400);
    }
    if (!regionId || typeof regionId !== "string" || !UUID_RE.test(regionId)) {
      return json({ error: "Missing or invalid field: region_id" }, 400);
    }
    if (!sportId || typeof sportId !== "string" || !UUID_RE.test(sportId)) {
      return json({ error: "Missing or invalid field: sport_id" }, 400);
    }
    if (!city || typeof city !== "string") {
      return json({ error: "Missing required field: city" }, 400);
    }
    if (!photographerId || typeof photographerId !== "string" || !UUID_RE.test(photographerId)) {
      return json({ error: "Missing or invalid field: photographer_id" }, 400);
    }
    if (!eventDate || typeof eventDate !== "string" || !DATE_RE.test(eventDate)) {
      return json({ error: "Missing or invalid field: event_date (YYYY-MM-DD)" }, 400);
    }

    // 2.b. Validaciones de archivo solo para fotógrafos
    let fileExt = file.name.split(".").pop();
    let contentType = file.type;
    if (!isAdmin) {
      const mappedExt = PHOTOGRAPHER_ALLOWED_TYPES[file.type];
      if (!mappedExt) {
        return json({ error: "Unsupported file type. Use JPEG, PNG or WEBP." }, 400);
      }
      if (file.size > PHOTOGRAPHER_MAX_BYTES) {
        return json({ error: "File too large (max 20 MB)." }, 413);
      }
      fileExt = mappedExt;
      contentType = file.type;
    }

    // 3. Obtener Embedding desde Railway (/embed)
    const railwayUrl = Deno.env.get("RAILWAY_SERVICE_URL") ?? "https://sua-racha-merece-production.up.railway.app";
    const serviceSecret = Deno.env.get("SERVICE_SECRET") ?? "";

    const railwayFormData = new FormData();
    railwayFormData.append("file", file);

    const railwayRes = await fetch(`${railwayUrl.replace(/\/$/, "")}/embed`, {
      method: "POST",
      headers: {
        "X-Service-Secret": serviceSecret,
      },
      body: railwayFormData,
    });

    if (!railwayRes.ok) {
      const errorText = await railwayRes.text();
      console.error("Railway error response:", railwayRes.status, errorText);
      return json({ error: `Face recognition service failed: ${railwayRes.status}` }, 502);
    }

    const { embedding } = await railwayRes.json();
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid embedding returned from Railway");
    }

    // 4. Subir a Supabase Storage (event-photos)
    const folderName = eventDate || "general";
    const filePath = `${folderName}/${crypto.randomUUID()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from("event-photos")
      .upload(filePath, file, {
        contentType,
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error("Storage Error:", uploadError);
      throw new Error("Failed to upload image to Storage");
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from("event-photos").getPublicUrl(filePath);
    const imageUrl = publicUrlData.publicUrl;

    // 5. Insertar en Base de Datos (event_photos)
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("event_photos")
      .insert({
        campaign_id: null,
        image_url: imageUrl,
        embedding: `[${embedding.join(",")}]`,
        region_id: regionId,
        sport_id: sportId,
        city: city,
        photographer_id: photographerId,
        event_date: eventDate,
        status: isAdmin ? "published" : "pending",
        uploaded_by_photographer: !isAdmin,
      })
      .select(isAdmin ? "*" : PHOTOGRAPHER_SELECT)
      .single();

    // 6. Rollback si falla la inserción en BD
    if (insertError) {
      console.error("Database Insert Error:", insertError);

      console.log(`Rolling back: Deleting orphaned file ${filePath} from Storage`);
      await supabaseAdmin.storage.from("event-photos").remove([filePath]);

      throw new Error("Failed to save event photo record in database");
    }

    return json({ success: true, photo: insertData });
  } catch (error) {
    console.error("Function error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});