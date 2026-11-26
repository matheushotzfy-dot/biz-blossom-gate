import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders as buildCors, safeError, clientIp, sha256Hex } from "../_shared/security.ts";

/** Password login for admin/employee accounts. The email-code step is currently off (owner's decision); failures answer 4xx with { success:false, error, locked? }. */
Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Método não permitido." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[admin-login] Missing required server configuration");
      return new Response(JSON.stringify({ success: false, error: "Serviço indisponível." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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
    // Três travas, todas por 15 minutos:
    //  - este e-mail NESTE IP: 5 erros (o ataque comum);
    //  - este IP em qualquer e-mail: 20 erros;
    //  - este e-mail somando TODOS os IPs: 30 erros (ataque distribuído).
    // Antes era só "5 erros no e-mail": qualquer pessoa, de qualquer lugar, trancava o dono fora do painel por 15 min.
    const ipKey = (await sha256Hex(clientIp(req))).slice(0, 32);
    const pairKey = `admin_login_pair:${trimmedEmail}:${ipKey}`;
    const ipBucket = `admin_login_ip:${ipKey}`;
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const [pairLimit, ipLimit, emailFails] = await Promise.all([
      adminClient.rpc("peek_rate_limit", { _bucket_key: pairKey, _window_seconds: 900, _max_count: 5 }),
      adminClient.rpc("peek_rate_limit", { _bucket_key: ipBucket, _window_seconds: 900, _max_count: 20 }),
      adminClient
        .from("admin_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", trimmedEmail)
        .eq("scope", "admin")
        .eq("success", false)
        .gte("created_at", fifteenMinAgo),
    ]);
    const pairRow = Array.isArray(pairLimit.data) ? pairLimit.data[0] : null;
    const ipRow = Array.isArray(ipLimit.data) ? ipLimit.data[0] : null;
    // Falha ao consultar uma trava = trava fechada (nunca deixa passar por erro).
    const locked = pairLimit.error || ipLimit.error || emailFails.error
      || pairRow?.allowed !== true || ipRow?.allowed !== true || (emailFails.count ?? 0) >= 30;

    if (locked) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Muitas tentativas. Aguarde 15 minutos.",
          locked: true,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const countFailure = () => Promise.all([
      adminClient.from("admin_login_attempts").insert({ email: trimmedEmail, success: false, scope: "admin" }),
      adminClient.rpc("bump_rate_limit", { _bucket_key: pairKey, _window_seconds: 900, _max_count: 5 }),
      adminClient.rpc("bump_rate_limit", { _bucket_key: ipBucket, _window_seconds: 900, _max_count: 20 }),
    ]);

    // ===== AUTHENTICATE =====
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      await countFailure();

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
      safeError("admin-login", roleError);
    }

    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    const isEmployee = roles.includes("employee");

    if (!isAdmin && !isEmployee) {
      await countFailure();
      // A senha estava certa, mas a conta não é da equipe: encerra a sessão que acabou de abrir.
      try { await adminClient.auth.admin.signOut(authData.session.access_token, "local"); } catch (_) { /* best-effort */ }

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

    // Direct password login (email code step disabled at owner's request).
    // Role was verified server-side above; password attempts stay rate-limited.
    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        role,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    safeError("admin-login", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
