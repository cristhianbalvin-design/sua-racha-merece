// ============================================================
// 3BUK · Buky · Edge Function buky-close-session  (verify_jwt ACTIVADO)
//
// La app la llama al tocar "Terminar" (y la reintenta si no hubo conexión). Recibe el recorrido
// completo, vuelve a calcular las pasadas con el mismo motor de la app, aplica las reglas de
// velocidad (caminar no cuenta; la bicicleta solo registra avisos) y ubicación falsa, el límite de 1 h, guarda el recorrido comprimido
// en el bucket privado buky-tracks y llama a buky_finalize_session, que acredita los Bukys
// (idempotente: reintentar no duplica). Las reglas se leen de app_settings (claves buky_*).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  BadRequest,
  buildFinalize,
  gzipJson,
  MAX_BODY_BYTES,
  parseCloseRequest,
  rulesFromSettings,
  SETTINGS_KEYS,
  toEnginePoints,
} from "./logic.ts";

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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing_authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "body_too_large" }, 413);
    const { sessionId, readings, info } = parseCloseRequest(JSON.parse(raw));

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });

    const { data: session, error: sErr } = await admin
      .from("buky_sessions")
      .select("id, user_id, route_id, status, started_at, bukys_awarded, invalid_reason")
      .eq("id", sessionId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!session || session.user_id !== user.id) return json({ error: "session_not_found" }, 404);
    if (session.status === "valid" || session.status === "invalid") {
      const { data: bal } = await admin.from("buky_balances").select("balance").eq("user_id", user.id).maybeSingle();
      return json({
        status: session.status,
        reason: session.invalid_reason,
        bukys: session.bukys_awarded,
        balance: bal?.balance ?? 0,
        duplicate: true,
      });
    }

    const [{ data: pointRows, error: pErr }, { data: settingRows, error: cErr }] = await Promise.all([
      admin.from("buky_points").select("id, label, lat, lon, radius_m").eq("route_id", session.route_id).order("seq"),
      admin.from("app_settings").select("key, value").in("key", SETTINGS_KEYS),
    ]);
    if (pErr) throw pErr;
    if (cErr) throw cErr;

    // Recorrido completo al bucket privado (si falla, el cierre sigue: las pasadas quedan en la base)
    const trackPath = `${user.id}/${sessionId}.json.gz`;
    let storedPath: string | null = trackPath;
    const gz = await gzipJson({ session_id: sessionId, format: "seq,fixTime,receivedAt,lat,lon,accuracy,simulated", readings: readings.map((r) => [r.seq, r.fixTime, r.receivedAt, r.lat, r.lon, r.accuracy, r.simulated ? 1 : 0]) });
    const { error: upErr } = await admin.storage.from("buky-tracks").upload(trackPath, gz, {
      contentType: "application/gzip",
      upsert: true,
    });
    if (upErr) {
      console.error("buky-close-session: no se pudo guardar el recorrido", upErr.message);
      storedPath = null;
    }

    const { evaluation, params } = buildFinalize({
      sessionId,
      userId: user.id,
      startedAt: Date.parse(session.started_at),
      now: Date.now(),
      points: toEnginePoints(pointRows ?? []),
      readings,
      rules: rulesFromSettings(settingRows ?? []),
      trackPath: storedPath,
      info,
    });

    const { data: result, error: fErr } = await admin.rpc("buky_finalize_session", params);
    if (fErr) throw fErr;

    // Pasadas tal como quedaron en la base: incluye los topes por punto (paso 24), que decide el SQL
    const { data: saved } = await admin
      .from("buky_passes")
      .select("point_id, passed_at, speed_kmh, valid, awarded, reject_reason")
      .eq("session_id", sessionId)
      .order("passed_at");
    return json({
      ...result,
      passes: saved
        ? saved.map((p) => ({ point_id: p.point_id, at: p.passed_at, speed_kmh: p.speed_kmh, valid: p.valid, awarded: p.awarded, reject_reason: p.reject_reason }))
        : evaluation.passes.map((p) => ({
            point_id: p.pointId,
            at: new Date(p.at).toISOString(),
            speed_kmh: p.speedKmh,
            valid: p.valid,
            reject_reason: p.rejectReason,
          })),
      stats: evaluation.stats,
    });
  } catch (err) {
    if (err instanceof BadRequest || err instanceof SyntaxError) return json({ error: (err as Error).message }, 400);
    console.error("buky-close-session", err);
    return json({ error: "internal_error" }, 500);
  }
});
