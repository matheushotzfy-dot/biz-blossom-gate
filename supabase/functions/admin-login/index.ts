import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Server-side admin login with 2FA.
 * Step 1: Authenticate + role check → generate OTP → store in admin_2fa_codes → return tempToken
 * Step 2: Verify OTP via admin-2fa-verify function
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { email, password } = await req.json();

    // Input validation
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
      .gte("created_at", fifteenMinAgo)
      .eq("success", false);

    if (!attemptsError && recentAttempts && recentAttempts.length >= 5) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail,
        success: false,
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
    const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail,
        success: false,
      });

      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SERVER-SIDE ROLE CHECK =====
    const userId = authData.user.id;

    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    const { data: isEmployee } = await adminClient.rpc("has_role", {
      _user_id: userId,
      _role: "employee",
    });

    if (!isAdmin && !isEmployee) {
      await adminClient.from("admin_login_attempts").insert({
        email: trimmedEmail,
        success: false,
      });

      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== 2FA: Generate OTP & store session temporarily =====
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const tempToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const role = isAdmin ? "admin" : "employee";

    // Clean old codes
    await adminClient.from("admin_2fa_codes").delete().eq("email", trimmedEmail);

    // Store OTP + session tokens
    await adminClient.from("admin_2fa_codes").insert({
      email: trimmedEmail,
      code_hash: otp,
      temp_token: tempToken,
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      role,
      expires_at: expiresAt,
      attempts: 0,
    });

    // Log attempt (pending 2FA)
    await adminClient.from("admin_login_attempts").insert({
      email: trimmedEmail,
      success: false, // Not fully authenticated yet
    });

    console.log(`[admin-login] 2FA OTP generated for ${trimmedEmail}`);

    // Mask email for display
    const [local, domain] = trimmedEmail.split("@");
    const maskedEmail = local.slice(0, 2) + "***@" + domain;

    return new Response(
      JSON.stringify({
        success: true,
        requires2FA: true,
        tempToken,
        maskedEmail,
        // DEV ONLY: include OTP for testing
        ...(Deno.env.get("DENO_DEPLOYMENT_ID") ? {} : { _devOtp: otp }),
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
