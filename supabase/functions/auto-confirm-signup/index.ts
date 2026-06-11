// Auto-confirms a freshly signed-up user when the admin has disabled
// "require email verification" in platform settings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Read setting
    const { data: setting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "require_email_verification")
      .maybeSingle();

    const requireVerification = (setting?.value as any)?.enabled ?? true;

    if (requireVerification) {
      return new Response(JSON.stringify({ confirmed: false, requireVerification: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user by email and mark email confirmed
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (listErr) throw listErr;
    const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      return new Response(JSON.stringify({ confirmed: false, error: "user not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user.email_confirmed_at) {
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (updErr) throw updErr;
    }

    return new Response(JSON.stringify({ confirmed: true, requireVerification: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
