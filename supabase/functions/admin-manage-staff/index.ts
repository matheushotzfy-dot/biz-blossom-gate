import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, preflight } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const corsHeaders = buildCorsHeaders(req);

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
    });
    const { data: claimsData } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: rolesData } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    if (!(rolesData ?? []).some((r: { role: string }) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Apenas admin." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const action = String(body.action ?? "");
    const target_user_id = String(body.target_user_id ?? "");
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "freeze" || action === "unfreeze") {
      const frozen = action === "freeze";
      await admin.from("profiles").update({ frozen }).eq("user_id", target_user_id);
      // Force-invalidate all active sessions when freezing so revocation is immediate
      if (frozen) {
        try { await admin.auth.admin.signOut(target_user_id, "global"); } catch (_) {}
      }
      await admin.from("staff_audit_log").insert({
        staff_user_id: callerId,
        action: action === "freeze" ? "freeze_staff" : "unfreeze_staff",
        entity_type: "user",
        entity_id: target_user_id,
      });
      return new Response(JSON.stringify({ success: true, frozen }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_password") {
      const newPassword = String(body.password ?? "");
      if (newPassword.length < 8) {
        return new Response(JSON.stringify({ error: "Senha mínima 8 caracteres." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await admin.auth.admin.updateUserById(target_user_id, { password: newPassword });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Kill existing sessions so old JWT can't linger with the previous password
      try { await admin.auth.admin.signOut(target_user_id, "global"); } catch (_) {}
      await admin.from("staff_audit_log").insert({
        staff_user_id: callerId,
        action: "reset_staff_password",
        entity_type: "user",
        entity_id: target_user_id,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(target_user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("staff_audit_log").insert({
        staff_user_id: callerId,
        action: "delete_staff",
        entity_type: "user",
        entity_id: target_user_id,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[admin-manage-staff]", e);
    return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
