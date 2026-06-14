import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rolesData } = await admin
      .from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (rolesData ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admin pode criar staff." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = String(body.full_name ?? "").trim();
    const role = body.role === "manager" ? "manager" : "employee";
    const permissions: string[] = Array.isArray(body.permissions) ? body.permissions : [];
    const commission_pct = Number(body.commission_pct ?? 0.1);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return new Response(JSON.stringify({ error: "E-mail inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (password.length < 8)
      return new Response(JSON.stringify({ error: "Senha deve ter ao menos 8 caracteres." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!full_name || full_name.length < 2)
      return new Response(JSON.stringify({ error: "Nome obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, created_by_admin: true },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Falha ao criar conta." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const newId = created.user.id;

    // Profile (criado por trigger handle_new_user; complementamos)
    await admin.from("profiles").update({
      full_name,
      staff_role_type: role === "manager" ? "manager" : "employee",
      created_by_admin: callerId,
      account_status: "active",
    }).eq("user_id", newId);

    // Role
    await admin.from("user_roles").upsert({ user_id: newId, role }, { onConflict: "user_id,role" });

    // Permissions
    if (permissions.length > 0) {
      await admin.from("staff_permissions").insert(
        permissions.map((k) => ({ user_id: newId, permission_key: k, granted_by: callerId }))
      );
    }

    // Commission config
    await admin.from("staff_commission_config").upsert({
      user_id: newId,
      base_pct: commission_pct,
      base: "net_amount",
      is_active: true,
    });

    // Audit
    await admin.from("staff_audit_log").insert({
      staff_user_id: callerId,
      action: "create_staff",
      entity_type: "user",
      entity_id: newId,
      after: { email, full_name, role, permissions, commission_pct },
    });

    return new Response(JSON.stringify({ success: true, user_id: newId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[admin-create-staff]", e);
    return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
