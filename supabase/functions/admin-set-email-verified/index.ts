// Admin action: mark a seller's e-mail as verified or unverified.
// Uses service role because auth.users.email_confirmed_at is not writable
// via the public API. Only admins (or staff with sellers.manage) allowed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://hotzfy.com.br",
  "https://www.hotzfy.com.br",
  "https://biz-blossom-gate.lovable.app",
  "https://id-preview--8b85380d-bbad-44c2-8000-ac99dd36affb.lovable.app",
  "https://8b85380d-bbad-44c2-8000-ac99dd36affb.lovableproject.com",
]);

function buildCors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.has(origin);
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (isAllowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, corsHeaders, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, corsHeaders, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ success: false, error: "Unauthorized" }, corsHeaders, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (isAdmin !== true) {
      const { data: canManage } = await admin.rpc("has_staff_permission", {
        _user_id: callerId, _key: "sellers.manage",
      });
      if (canManage !== true) {
        return json({ success: false, error: "Forbidden" }, corsHeaders, 403);
      }
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.targetUserId || "").trim();
    const action = String(body?.action || "set");
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return json({ success: false, error: "Invalid targetUserId" }, corsHeaders, 400);
    }

    if (action === "status") {
      const { data: user, error } = await admin.auth.admin.getUserById(targetUserId);
      if (error) return json({ success: false, error: "Não foi possível atualizar o cadastro." }, corsHeaders, 500);
      return json({
        success: true,
        verified: !!user?.user?.email_confirmed_at,
        email_confirmed_at: user?.user?.email_confirmed_at ?? null,
      }, corsHeaders);
    }

    const verified = Boolean(body?.verified);

    if (verified) {
      const { error } = await admin.auth.admin.updateUserById(targetUserId, { email_confirm: true });
      if (error) return json({ success: false, error: "Não foi possível atualizar o cadastro." }, corsHeaders, 500);

      const { data: userData } = await admin.auth.admin.getUserById(targetUserId);
      const verifiedEmail = userData?.user?.email?.trim().toLowerCase();
      if (verifiedEmail) {
        await admin
          .from("admin_login_attempts")
          .delete()
          .eq("email", verifiedEmail)
          .eq("scope", "seller")
          .eq("success", false);
      }
    } else {
      // updateUserById cannot un-confirm; use privileged SQL via RPC helper.
      const { error } = await admin.rpc("admin_unverify_email", { _user_id: targetUserId });
      if (error) return json({ success: false, error: "Não foi possível atualizar o cadastro." }, corsHeaders, 500);
    }

    await admin.from("audit_logs").insert({
      admin_user_id: callerId,
      action: verified ? "email_verify" : "email_unverify",
      entity_type: "auth.user",
      entity_id: targetUserId,
      details: { verified },
    });

    return json({ success: true, verified, cleared_login_lock: verified }, corsHeaders);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[admin-set-email-verified]", msg);
    return json({ success: false, error: "Internal error" }, corsHeaders, 500);
  }
});
