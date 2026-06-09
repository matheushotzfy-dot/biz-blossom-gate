// Atomic seller ban: blocks profile + freezes balance + suspends products in a
// single privileged server call. Replaces two independent client-side updates
// that could partially fail and leave the seller in an inconsistent state.

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
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) {
      return json({ success: false, error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.targetUserId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return json({ success: false, error: "Invalid targetUserId" }, 400);
    }
    if (targetUserId === callerId) {
      return json({ success: false, error: "Cannot ban yourself" }, 400);
    }

    // Atomic: block profile + freeze balance + suspend products.
    // Done sequentially with service role; on any failure we revert profile.
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ account_status: "blocked", balance_frozen: true })
      .eq("user_id", targetUserId);
    if (profileErr) {
      return json({ success: false, error: "Failed to block profile" }, 500);
    }

    const { error: productsErr } = await admin
      .from("products")
      .update({ status: "suspended" })
      .eq("user_id", targetUserId);

    if (productsErr) {
      // Roll back profile change so the seller is not left half-banned
      await admin
        .from("profiles")
        .update({ account_status: "active", balance_frozen: false })
        .eq("user_id", targetUserId);
      return json({ success: false, error: "Failed to suspend products — rolled back" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[admin-ban-seller]", msg);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
