// ============================================================
// 3BUK · Fase 1 · J. Portal de Fotógrafos (núcleo)
// PASO 5 — Edge Function invite-photographer (PROPUESTA, no desplegada)
// Ruta en el repo: supabase/functions/invite-photographer/index.ts
//
// Qué hace (solo ADMIN):
//   1. Recibe { photographer_id, email? } (el email del body solo se usa si la
//      fila de photographers no tiene uno; Wellington Santos hoy no lo tiene).
//   2. Crea el usuario en Supabase Auth con service role, con
//      app_metadata.invited_photographer = true (lo que habilita el alta sin
//      accepted_terms en handle_new_user, ver Paso 4) y sin contraseña.
//   3. Vincula photographers.auth_user_id (solo si estaba vacío). Si el vínculo
//      falla, borra el usuario recién creado para no dejar cuentas huérfanas.
//   4. Envía el correo para que el fotógrafo defina su contraseña.
//
// Variables de entorno opcionales:
//   PHOTOGRAPHER_PORTAL_URL → URL a la que vuelve el fotógrafo tras definir la
//   contraseña (por ejemplo la ruta de login del portal). Si no existe, se usa
//   el Site URL configurado en Supabase Auth.
//
// Requisitos: Paso 4 de SQL ejecutado. Desplegar con verify_jwt activado.
// Si el email ya tiene una cuenta (p. ej. un atleta), responde 409 y NO la
// reutiliza: vincular una cuenta de atleta existente es una decisión manual.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // 1. Autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2. Solo ADMIN
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerRow } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (callerRow?.role !== "ADMIN") {
      return json({ error: "Forbidden: Admins only" }, 403);
    }

    // 3. Entrada
    const body = await req.json().catch(() => null);
    const photographerId = body?.photographer_id;
    if (typeof photographerId !== "string" || !UUID_RE.test(photographerId)) {
      return json({ error: "Missing or invalid field: photographer_id" }, 400);
    }

    const { data: photographer } = await supabaseAdmin
      .from("photographers")
      .select("id, name, email, auth_user_id")
      .eq("id", photographerId)
      .maybeSingle();

    if (!photographer) {
      return json({ error: "Photographer not found" }, 404);
    }
    if (photographer.auth_user_id) {
      return json({ error: "Photographer already has an account" }, 409);
    }

    const rawEmail = (photographer.email && photographer.email.trim() !== "")
      ? photographer.email
      : (typeof body?.email === "string" ? body.email : "");
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return json({ error: "A valid email is required for this photographer" }, 400);
    }

    // 4. Crear usuario (sin contraseña) con el flag de servidor
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { invited_photographer: true },
      user_metadata: { name: photographer.name },
    });

    if (createError || !created?.user) {
      const msg = (createError?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
        return json({ error: "Email already registered" }, 409);
      }
      console.error("createUser error:", createError);
      throw new Error("Failed to create photographer account");
    }

    const newUserId = created.user.id;

    // 5. Vincular (solo si sigue sin cuenta) y completar el email si faltaba
    const { data: linked, error: linkError } = await supabaseAdmin
      .from("photographers")
      .update({ auth_user_id: newUserId, email })
      .eq("id", photographer.id)
      .is("auth_user_id", null)
      .select("id");

    if (linkError || !linked || linked.length !== 1) {
      console.error("Link error:", linkError);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Failed to link photographer account");
    }

    // 6. Correo para definir contraseña
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const redirectTo = Deno.env.get("PHOTOGRAPHER_PORTAL_URL") || undefined;
    const { error: mailError } = await anonClient.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (mailError) {
      console.error("Password email error:", mailError);
    }

    return json({
      success: true,
      photographer_id: photographer.id,
      auth_user_id: newUserId,
      email_sent: !mailError,
      ...(mailError ? { warning: "Account created but the password email failed; resend it from the admin panel." } : {}),
    });
  } catch (error) {
    console.error("Function error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
