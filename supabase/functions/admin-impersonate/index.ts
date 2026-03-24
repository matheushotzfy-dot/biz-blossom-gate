import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller with their own token
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role SERVER-SIDE
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUserId } = await req.json();

    // Validate input
    if (!targetUserId || typeof targetUserId !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing targetUserId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid targetUserId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-impersonation
    if (targetUserId === caller.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot impersonate yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent impersonating other admins
    const { data: targetIsAdmin } = await adminClient.rpc("has_role", {
      _user_id: targetUserId,
      _role: "admin",
    });
    if (targetIsAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot impersonate an admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user
    const { data: targetUser, error: userError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (userError || !targetUser?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link for impersonation
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email!,
    });

    if (linkError || !linkData) {
      console.error("[admin-impersonate] Failed to generate link:", linkError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate impersonation session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audit log (no PII in details beyond what's necessary)
    await adminClient.from("audit_logs").insert({
      admin_user_id: caller.id,
      action: "impersonate_user",
      entity_type: "profile",
      entity_id: targetUserId,
      details: {
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        access_token: linkData.properties?.access_token,
        refresh_token: linkData.properties?.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-impersonate] Error:", error instanceof Error ? error.message : "unknown");
    // NEVER leak internal error details to client
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
