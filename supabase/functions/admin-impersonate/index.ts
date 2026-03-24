import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    // Check admin role SERVER-SIDE using service_role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { targetUserId } = await req.json();
    if (!targetUserId) throw new Error("Missing targetUserId");

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) throw new Error("Invalid targetUserId format");

    // Prevent self-impersonation
    if (targetUserId === caller.id) throw new Error("Cannot impersonate yourself");

    // Prevent impersonating other admins
    const { data: targetIsAdmin } = await adminClient.rpc("has_role", {
      _user_id: targetUserId,
      _role: "admin",
    });
    if (targetIsAdmin) throw new Error("Cannot impersonate another admin");

    // Get target user
    const { data: targetUser, error: userError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (userError || !targetUser?.user) throw new Error("User not found");

    // Generate a magic link for impersonation
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email!,
    });

    if (linkError || !linkData) throw new Error("Failed to generate impersonation link");

    // Log the impersonation with details
    await adminClient.from("audit_logs").insert({
      admin_user_id: caller.id,
      action: "impersonate_user",
      entity_type: "profile",
      entity_id: targetUserId,
      details: {
        target_email: targetUser.user.email,
        timestamp: new Date().toISOString(),
        admin_email: caller.email,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        access_token: linkData.properties?.access_token,
        refresh_token: linkData.properties?.refresh_token,
        email: targetUser.user.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
