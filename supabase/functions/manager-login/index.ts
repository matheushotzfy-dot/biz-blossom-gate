import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders as buildCors, safeError, clientIp } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    // Rate limiting — atomic per-email + per-IP buckets (same pattern as admin-login).
    const [emailLimit, ipLimit] = await Promise.all([
      adminClient.rpc("bump_rate_limit", {
        _bucket_key: `manager_login_email:${trimmedEmail}`,
        _window_seconds: 900,
        _max_count: 5,
      }),
      adminClient.rpc("bump_rate_limit", {
        _bucket_key: `manager_login_ip:${clientIp(req)}`,
        _window_seconds: 900,
        _max_count: 20,
      }),
    ]);
    const emailRow = Array.isArray(emailLimit.data) ? emailLimit.data[0] : null;
    const ipRow = Array.isArray(ipLimit.data) ? ipLimit.data[0] : null;
    if (emailLimit.error || ipLimit.error || emailRow?.allowed !== true || ipRow?.allowed !== true) {
      return new Response(
        JSON.stringify({ success: false, error: "Muitas tentativas. Aguarde 15 minutos.", locked: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth via anon client; keep service-role on adminClient
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: false, scope: "manager" });
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Role check via direct query (bypasses RPC permission issues)
    const userId = authData.user.id;
    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isManager = roles.includes("manager") || roles.includes("employee");

    if (!isManager) {
      await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: false, scope: "manager" });
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas ou acesso não autorizado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block frozen staff accounts
    const { data: profileRow } = await adminClient
      .from("profiles")
      .select("frozen")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileRow?.frozen) {
      await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: false, scope: "manager" });
      return new Response(
        JSON.stringify({ success: false, error: "Conta congelada. Contate o administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    await adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: true, scope: "manager" });

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
    safeError("manager-login", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
