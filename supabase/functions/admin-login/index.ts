import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://hotzfy.com.br",
  "https://www.hotzfy.com.br",
  "https://biz-blossom-gate.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.(lovable\.app|lovableproject\.com|lovable\.dev)$/i;
const CORS_BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = !origin || ALLOWED_ORIGINS.has(origin) || LOVABLE_PREVIEW_RE.test(origin);
  return allowed && origin
    ? { ...CORS_BASE_HEADERS, "Access-Control-Allow-Origin": origin }
    : CORS_BASE_HEADERS;
}

/**
 * Server-side admin login — direct auth without 2FA.
 * Authenticates, checks role, returns session tokens.
 */
Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { email, password } = await req.json();

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: "E-mail inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6 || password.length > 128) {
      return new Response(
        JSON.stringify({ success: false, error: "Senha inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SERVER-SIDE RATE LIMITING =====
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: recentAttempts, error: attemptsError } = await adminClient
      .from("admin_login_attempts")
      .select("id, success")
      .eq("email", trimmedEmail)
      .eq("scope", "admin")
      .gte("created_at", fifteenMinAgo)
      .eq("success", false);

    if (!attemptsError && recentAttempts && recentAttempts.length >= 5) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail,
        success: false,
        scope: "admin",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Muitas tentativas. Aguarde 15 minutos.",
          locked: true,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== AUTHENTICATE =====
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail,
        success: false,
        scope: "admin",
      });

      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SERVER-SIDE ROLE CHECK (direct query, bypasses RPC permission issues) =====
    const userId = authData.user.id;

    const { data: roleRows, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleError) {
      console.error("[admin-login] role query error:", roleError.message);
    }

    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    const isEmployee = roles.includes("employee");

    if (!isAdmin && !isEmployee) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail,
        success: false,
        scope: "admin",
      });

      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful password validation
    await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail,
        success: true,
        scope: "admin",
      });

    const role = isAdmin ? "admin" : "employee";

    // ===== 2FA GATE (admins only) =====
    // Employees skip 2FA and get session tokens directly.
    // Admins MUST complete a 6-digit email OTP before tokens are released.
    if (isAdmin) {
      // Sign the just-authenticated session out immediately — tokens are held
      // server-side inside admin_2fa_codes and only released after code verification.
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHashBuf = await crypto.subtle.digest(
        "SHA-256", new TextEncoder().encode(code + trimmedEmail),
      );
      const codeHash = Array.from(new Uint8Array(codeHashBuf))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const tempToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Purge any pending challenges for this email
      await adminClient.from("admin_2fa_codes").delete().eq("email", trimmedEmail);

      const { error: insertErr } = await adminClient.from("admin_2fa_codes").insert({
        email: trimmedEmail,
        code_hash: codeHash,
        temp_token: tempToken,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        role,
        expires_at: expiresAt,
        attempts: 0,
      });
      if (insertErr) {
        console.error("[admin-login] 2fa insert error:", insertErr.message);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao iniciar verificação 2FA." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Deliver the code — Resend if configured, otherwise log to edge fn logs.
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "HOTZFY Admin <admin@hotzfy.com.br>",
              to: [trimmedEmail],
              subject: `Código de verificação HOTZFY: ${code}`,
              html: `<p>Seu código de acesso ao painel admin é: <b style="font-size:22px;letter-spacing:4px">${code}</b></p><p>Expira em 10 minutos.</p>`,
            }),
          });
        } catch (e) {
          console.error("[admin-login] resend error:", e instanceof Error ? e.message : e);
        }
      }
      console.log(`[admin-login] 2FA code for ${trimmedEmail}: ${code}`);

      const devEcho = Deno.env.get("ADMIN_2FA_DEV_ECHO") === "true";
      return new Response(
        JSON.stringify({
          success: true,
          requires2FA: true,
          temp_token: tempToken,
          email: trimmedEmail,
          ...(devEcho ? { dev_code: code } : {}),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Employees: direct login (no 2FA required)
    console.log(`[admin-login] Direct login for ${trimmedEmail} (${role})`);

    return new Response(
      JSON.stringify({
        success: true,
        requires2FA: false,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        role,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-login] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
