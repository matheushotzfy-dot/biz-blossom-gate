import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, preflight, safeError } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const corsHeaders = buildCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

    const ALLOWED_PERMISSIONS = new Set(["view_sellers","view_transactions","view_financial","view_disputes","view_withdrawals","approve_kyc","reject_kyc","approve_product","review_products","suspend_products","edit_fees","edit_seller_notes","request_refund","manage_med","freeze_seller_withdrawals","view_support","respond_support","view_analytics","view_rewards","ship_rewards"]);
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const sendInvite = body?.send_invite === true || !password;
    const full_name = String(body?.full_name ?? "").trim().slice(0, 120);
    const role = body?.role === "manager" ? "manager" : body?.role === "partner" ? "partner" : "employee";
    const rawPerms: unknown[] = Array.isArray(body?.permissions) ? body.permissions : [];
    if (rawPerms.some(p => typeof p !== "string" || !ALLOWED_PERMISSIONS.has(p))) return new Response(JSON.stringify({ error: "Permissão inválida." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const permissions = Array.from(new Set(rawPerms as string[]));
    const commission_pct = Number(body?.commission_pct ?? 0.1);
    const limits = body?.fee_limits ?? { min_transaction_percentage: 2, min_transaction_fixed: 1, min_withdrawal_fee: 3 };
    const percentage = Number(limits.min_transaction_percentage), fixed = Number(limits.min_transaction_fixed), withdrawal = Number(limits.min_withdrawal_fee);
    if (![commission_pct,percentage,fixed,withdrawal].every(Number.isFinite) || commission_pct<0 || commission_pct>50 || percentage<0 || percentage>100 || fixed<0 || fixed>1000000 || withdrawal<0 || withdrawal>1000000 || (role === "partner" && permissions.length)) return new Response(JSON.stringify({ error: "Limites ou permissões inválidos." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return new Response(JSON.stringify({ error: "E-mail inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!sendInvite && (password.length < 8 || password.length > 128))
      return new Response(JSON.stringify({ error: "Senha deve ter entre 8 e 128 caracteres." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!full_name || full_name.length < 2)
      return new Response(JSON.stringify({ error: "Nome obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let newId: string;
    if (sendInvite) {
      // Sends the standard "You've been invited" email with a magic link.
      // The user sets their own password on first login — no manual password copying.
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, created_by_admin: true, staff_role: role },
      });
      if (inviteErr || !invited.user) {
        return new Response(JSON.stringify({ error: "Falha ao enviar convite." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      newId = invited.user.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, created_by_admin: true },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: "Falha ao criar conta." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      newId = created.user.id;
    }

    // Never leave an operational account with a partially applied policy.
    const profileResult = await admin.from("profiles").update({ full_name, staff_role_type: role, created_by_admin: callerId, account_status: "active" }).eq("user_id", newId).select("user_id").single();
    const roleResult = profileResult.error ? profileResult : await admin.from("user_roles").upsert({ user_id: newId, role }, { onConflict: "user_id,role" });
    const configured = roleResult.error ? roleResult : role === "partner"
      ? await admin.from("staff_audit_log").insert({ staff_user_id: callerId, action: "create_partner", entity_type: "user", entity_id: newId })
      : await admin.rpc("configure_staff_service", { _actor: callerId, _user_id: newId, _permissions: permissions, _percentage: percentage, _fixed: fixed, _withdrawal: withdrawal, _commission: commission_pct });
    if (configured.error) {
      await admin.auth.admin.updateUserById(newId, { ban_duration: "876000h" });
      await admin.from("user_roles").delete().eq("user_id", newId).in("role", ["employee","manager","partner"]);
      return new Response(JSON.stringify({ error: "Configuração incompleta; acesso bloqueado. Consulte a equipe antes de tentar novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true, user_id: newId, invited: sendInvite }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    safeError("admin-create-staff", e);
    return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
