import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

    // Rate limiting - reuse admin_login_attempts table
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentAttempts } = await adminClient
      .from("admin_login_attempts")
      .select("id, success")
      .eq("email", trimmedEmail)
      .gte("created_at", fifteenMinAgo)
      .eq("success", false);

    if (recentAttempts && recentAttempts.length >= 5) {
      await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: false });
      return new Response(
        JSON.stringify({ success: false, error: "Muitas tentativas. Aguarde 15 minutos.", locked: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate
    const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: false });
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side role check - must be manager
    const userId = authData.user.id;
    const { data: isManager } = await adminClient.rpc("has_role", { _user_id: userId, _role: "manager" });

    if (!isManager) {
      await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: false });
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success
    await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: true });

    await adminClient.from("audit_logs").insert({
      admin_user_id: userId,
      action: "manager_login",
      entity_type: "auth",
      entity_id: userId,
      details: { role: "manager", timestamp: new Date().toISOString() },
    });

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        role: "manager",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[manager-login] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
