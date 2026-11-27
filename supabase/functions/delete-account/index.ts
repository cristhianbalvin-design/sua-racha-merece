import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return json({ error: "unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: { user }, error: authError } = await caller.auth.getUser(token);
    if (authError || !user) return json({ error: "unauthorized" }, 401);
    let body: { confirm?: string }; try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
    if (body?.confirm !== "EXCLUIR") return json({ error: "confirmation_required" }, 400);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { error } = await admin.rpc("buky_prepare_account_deletion", { p_user: user.id });
    if (error) {
      const code = ["blocked_admin", "blocked_sponsor_member", "blocked_open_order"].find(c => error.message === c);
      if (code) return json({ error: code }, 409);
      throw error;
    }
    // Track objects are in user-id folders; avatars and evidences use user-id- prefixes.
    const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();
    if (bucketsError) throw bucketsError;
    for (const bucket of ["buky-tracks", "avatars", "evidences"].filter(name => buckets?.some(b => b.id === name))) {
      const prefix = bucket === "buky-tracks" ? user.id : "";
      const search = bucket === "buky-tracks" ? undefined : `${user.id}-`;
      for (;;) {
        const { data, error: listError } = await admin.storage.from(bucket).list(prefix, { limit: 100, search });
        if (listError) throw listError;
        const paths = (data ?? []).filter(x => x.id && (bucket === "buky-tracks" || x.name.startsWith(`${user.id}-`))).map(x => prefix ? `${prefix}/${x.name}` : x.name);
        if (!paths.length) break;
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) throw removeError;
      }
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return json({ ok: true });
  } catch { return json({ error: "internal_error" }, 500); }
});
