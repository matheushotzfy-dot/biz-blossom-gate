// Auto-confirms a freshly signed-up user when the admin has disabled
// "require email verification" in platform settings.
//
// SECURITY: caller MUST present the Authorization Bearer token returned by
// the signUp() call. We confirm ONLY the e-mail belonging to that JWT, so an
// attacker cannot confirm someone else's account or enumerate registered
// e-mails by trial-and-error.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Per-IP rate limit (20/min) — blocks credential-stuffing / enumeration.
    const ip = clientIp(req);
    const { data: rl } = await admin.rpc("bump_rate_limit", {
      _bucket_key: `auto_confirm_signup:${ip}`,
      _window_seconds: 60,
      _max_count: 20,
    });
    const allowed = Array.isArray(rl) ? (rl[0]?.allowed ?? true) : true;
    if (!allowed) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require the caller's JWT (the session just minted by signUp).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller?.email) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read global setting.
    const { data: setting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "require_email_verification")
      .maybeSingle();

    const requireVerification = (setting?.value as { enabled?: boolean } | null)?.enabled ?? true;

    if (requireVerification) {
      return new Response(
        JSON.stringify({ confirmed: false, requireVerification: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Confirm ONLY the e-mail bound to the bearer token.
    if (!caller.email_confirmed_at) {
      const { error: updErr } = await admin.auth.admin.updateUserById(caller.id, {
        email_confirm: true,
      });
      if (updErr) {
        console.error("[auto-confirm-signup] update failed", updErr.message);
        return new Response(JSON.stringify({ error: "internal" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ confirmed: true, requireVerification: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[auto-confirm-signup]", (e as Error).message);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
