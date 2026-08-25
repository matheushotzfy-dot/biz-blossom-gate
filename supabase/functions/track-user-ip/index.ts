import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      // No session (e.g. admin/manager custom auth) — silently skip tracking.
      return new Response(JSON.stringify({ ok: true, skipped: "no_auth" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      // Invalid/expired token — skip silently instead of surfacing a 401.
      return new Response(JSON.stringify({ ok: true, skipped: "invalid_session" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ip = req.headers.get("cf-connecting-ip")
      || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "0.0.0.0";
    const country = req.headers.get("cf-ipcountry") || null;
    const ua = req.headers.get("user-agent") || null;
    let source = "login";
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.source) source = String(body.source).slice(0, 32);
    } catch {}

    const admin = createClient(supabaseUrl, serviceKey);

    // Update profile last_ip
    await admin.from("profiles").update({ last_ip: ip } as any).eq("user_id", user.id);

    // Insert into ip_logs only if last entry differs (avoid spam)
    const { data: last } = await admin.from("ip_logs").select("ip").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last || last.ip !== ip) {
      await admin.from("ip_logs").insert({ user_id: user.id, ip, user_agent: ua, country, source });
    }

    return new Response(JSON.stringify({ ok: true, ip }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[track-user-ip]", e?.message || e);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
