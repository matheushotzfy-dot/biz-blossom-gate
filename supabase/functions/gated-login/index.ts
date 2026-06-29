// Server-side login with per-email rate limiting.
// Used by seller (/auth) and member (/membros-area/login) sign-in flows.
// Same bucket pattern as admin-login / manager-login, but no role check —
// the only goal here is to stop brute-force / credential stuffing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SECURITY_HEADERS, logAbuseEvent, abuseGuard, logSecurityEvent } from "../_shared/security.ts";

const ALLOWED_ORIGINS = new Set([
  "https://hotzfy.com.br",
  "https://www.hotzfy.com.br",
  "https://biz-blossom-gate.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.(lovable\.app|lovableproject\.com|lovable\.dev)$/i;
const CORS_BASE_HEADERS: Record<string, string> = {
  ...SECURITY_HEADERS,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = !origin || ALLOWED_ORIGINS.has(origin) || LOVABLE_PREVIEW_RE.test(origin);
  return allowed && origin
    ? { ...CORS_BASE_HEADERS, "Access-Control-Allow-Origin": origin }
    : CORS_BASE_HEADERS;
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_FAILS = 5;
const ALLOWED_SCOPES = new Set(["seller", "member"]);

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ===== Abuse guard (very high threshold: 100 events in 10s → 15min block) =====
    const guard = await abuseGuard({
      supabaseUrl, serviceKey: serviceRoleKey, req,
      endpoint: "gated-login",
    });
    if (guard.blocked) {
      return new Response(
        JSON.stringify({ success: false, error: "Atividade suspeita detectada. Tente novamente em alguns minutos.", locked: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "900" } },
      );
    }

    const { email, password, scope } = await req.json();

    if (
      !email || typeof email !== "string" ||
      !password || typeof password !== "string" ||
      !scope || typeof scope !== "string" || !ALLOWED_SCOPES.has(scope)
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: "E-mail inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (password.length < 6 || password.length > 128) {
      return new Response(
        JSON.stringify({ success: false, error: "Senha inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Per-email rate limit (same bucket as admin/manager, scoped) =====
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { data: recentAttempts } = await adminClient
      .from("admin_login_attempts")
      .select("id")
      .eq("email", trimmedEmail)
      .eq("scope", scope)
      .eq("success", false)
      .gte("created_at", windowStart);

    if (recentAttempts && recentAttempts.length >= RATE_LIMIT_MAX_FAILS) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail, success: false, scope,
      });
      await logAbuseEvent({
        supabaseUrl, serviceKey: serviceRoleKey,
        event_type: "login_rate_limited", endpoint: "gated-login",
        status_code: 429, identifier: trimmedEmail, req,
        metadata: { scope, attempts: recentAttempts.length },
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Muitas tentativas. Aguarde 15 minutos.",
          locked: true,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Authenticate =====
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail, success: false, scope,
      });
      await logAbuseEvent({
        supabaseUrl, serviceKey: serviceRoleKey,
        event_type: "login_failed", endpoint: "gated-login",
        status_code: 401, identifier: trimmedEmail, req,
        metadata: { scope },
      });
      return new Response(
        JSON.stringify({ success: false, error: "E-mail ou senha incorretos." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Block frozen accounts (sellers / members) =====
    const { data: profileRow } = await adminClient
      .from("profiles")
      .select("frozen")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileRow?.frozen) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail, success: false, scope,
      });
      return new Response(
        JSON.stringify({ success: false, error: "Conta congelada. Contate o suporte." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await adminClient.from("admin_login_attempts").insert({
      email: trimmedEmail, success: true, scope,
    });

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[gated-login] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
