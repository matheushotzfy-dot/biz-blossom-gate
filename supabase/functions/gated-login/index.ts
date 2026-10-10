// Server-side login with per-email rate limiting.
// Used by seller (/auth) and member (/membros-area/login) sign-in flows.
// Same bucket pattern as admin-login / manager-login, but no role check —
// the only goal here is to stop brute-force / credential stuffing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders as buildCors, logAbuseEvent, abuseGuard, logSecurityEvent, safeError, clientIp } from "../_shared/security.ts";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_FAILS = 5;
const ALLOWED_SCOPES = new Set(["seller", "member"]);
const OK_JSON_STATUS = 200;

function getLoginFailure(authError: { code?: string; message?: string } | null) {
  const code = String(authError?.code ?? "").toLowerCase();
  const message = String(authError?.message ?? "").toLowerCase();
  // Anti-enumeração: a resposta ao cliente é sempre idêntica. O motivo real
  // fica apenas no `internalCode`, gravado no log de segurança do servidor.
  const internalCode = (code === "email_not_confirmed" || message.includes("email not confirmed"))
    ? "email_not_confirmed"
    : "invalid_credentials";

  return {
    status: 401,
    code: "invalid_credentials",
    internalCode,
    error: "E-mail ou senha incorretos.",
  };
}


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
        JSON.stringify({ success: false, error: "Atividade suspeita detectada. Tente novamente em alguns minutos.", locked: true, code: "temporarily_blocked" }),
        { status: OK_JSON_STATUS, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "900" } },
      );
    }

    const { email, password, scope } = await req.json();

    if (
      !email || typeof email !== "string" ||
      !password || typeof password !== "string" ||
      !scope || typeof scope !== "string" || !ALLOWED_SCOPES.has(scope)
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas.", code: "invalid_payload" }),
        { status: OK_JSON_STATUS, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: "E-mail inválido.", code: "invalid_email" }),
        { status: OK_JSON_STATUS, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (password.length < 6 || password.length > 128) {
      return new Response(
        JSON.stringify({ success: false, error: "Senha inválida.", code: "invalid_password" }),
        { status: OK_JSON_STATUS, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Rate limit — read-only check (peek) per-email + per-IP =====
    // Successful logins must NOT consume the lockout budget; the counters are
    // only incremented (bump_rate_limit) when the password check fails below.
    const [emailLimit, ipLimit] = await Promise.all([
      adminClient.rpc("peek_rate_limit", {
        _bucket_key: `gated_login_email:${scope}:${trimmedEmail}`,
        _window_seconds: 900,
        _max_count: RATE_LIMIT_MAX_FAILS,
      }),
      adminClient.rpc("peek_rate_limit", {
        _bucket_key: `gated_login_ip:${clientIp(req)}`,
        _window_seconds: 900,
        _max_count: 20,
      }),
    ]);
    const emailRow = Array.isArray(emailLimit.data) ? emailLimit.data[0] : null;
    const ipRow = Array.isArray(ipLimit.data) ? ipLimit.data[0] : null;
    if (emailLimit.error || ipLimit.error || emailRow?.allowed !== true || ipRow?.allowed !== true) {
      await logAbuseEvent({
        supabaseUrl, serviceKey: serviceRoleKey,
        event_type: "login_rate_limited", endpoint: "gated-login",
        status_code: 429, identifier: trimmedEmail, req,
        metadata: { scope },
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Muitas tentativas. Aguarde 15 minutos.",
          locked: true,
          code: "rate_limited",
        }),
        { status: OK_JSON_STATUS, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Authenticate =====
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      const failure = getLoginFailure(authError);
      if (failure.internalCode !== "email_not_confirmed") {
        await adminClient.from("admin_login_attempts").insert({
          email: trimmedEmail, success: false, scope,
        });
      }
      await logAbuseEvent({
        supabaseUrl, serviceKey: serviceRoleKey,
        event_type: "login_failed", endpoint: "gated-login",
        status_code: failure.status, identifier: trimmedEmail, req,
        metadata: { scope, code: failure.internalCode },
      });
      return new Response(
        JSON.stringify({ success: false, error: failure.error, code: failure.code }),
        { status: OK_JSON_STATUS, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Block frozen / banned / suspended accounts =====
    const { data: profileRow } = await adminClient
      .from("profiles")
      .select("frozen, account_status")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    const blockedStatuses = ["blocked", "banned", "suspended"];
    const isBlocked = blockedStatuses.includes(String(profileRow?.account_status ?? "").toLowerCase());
    if (profileRow?.frozen || isBlocked) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail, success: false, scope,
      });
      // Revoke any leftover sessions so a banned user can't reuse an old refresh token
      try { await adminClient.auth.admin.signOut(authData.user.id, "global"); } catch (_) {}
      const msg = isBlocked
        ? "Conta bloqueada. Contate o suporte."
        : "Conta congelada. Contate o suporte.";
      return new Response(
        JSON.stringify({ success: false, error: msg, code: isBlocked ? "account_blocked" : "account_frozen" }),
        { status: OK_JSON_STATUS, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Registros pós-login (auditoria/IP) rodam em segundo plano para não
    // atrasar a entrada do usuário; falhas são apenas registradas.
    const userId = authData.user.id;
    const bookkeeping = (async () => {
    await adminClient.from("admin_login_attempts").insert({
      email: trimmedEmail, success: true, scope,
    });
    await logSecurityEvent({
      supabaseUrl, serviceKey: serviceRoleKey, req,
      event_type: "login_success", endpoint: "gated-login",
      user_id: userId, actor_role: scope, status_code: 200,
    });

    // ===== Capture IP for audit / anti-fraud (server-side, always) =====
    try {
      const ip = req.headers.get("cf-connecting-ip")
        || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "0.0.0.0";
      const country = req.headers.get("cf-ipcountry") || null;
      const ua = req.headers.get("user-agent") || null;
      // Only write when the IP actually changed (avoids a profile row lock on every login).
      await adminClient.from("profiles").update({ last_ip: ip } as any).eq("user_id", userId).or(`last_ip.is.null,last_ip.neq.${ip}`);
      const { data: last } = await adminClient
        .from("ip_logs")
        .select("ip")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last || last.ip !== ip) {
        await adminClient.from("ip_logs").insert({
          user_id: userId, ip, user_agent: ua, country, source: `login:${scope}`,
        });
      }
    } catch (e) {
      safeError("gated-login:ip-capture", e);
    }

    })().catch((e) => safeError("gated-login:bookkeeping", e));
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(bookkeeping); else await bookkeeping;

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    safeError("gated-login", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
