import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Admin 2FA — Generates OTP (hashed), stores hash in DB.
 * - Step "send": generate 6-digit OTP, hash via SHA-256, persist hash + tempToken.
 * - Step "verify": hash provided code, compare to stored hash, return success only.
 *
 * NOTE: Session tokens are NEVER stored in DB. Callers complete authentication
 * via admin-login after a successful 2FA verify.
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, code, tempToken } = await req.json();

    if (action === "send") {
      if (!email || typeof email !== "string") {
        return new Response(
          JSON.stringify({ success: false, error: "E-mail obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const trimmedEmail = email.trim().toLowerCase();
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = await sha256Hex(otp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const tempTokenValue = crypto.randomUUID();

      // Replace any previous code for this email
      await adminClient.from("admin_2fa_codes").delete().eq("email", trimmedEmail);

      await adminClient.from("admin_2fa_codes").insert({
        email: trimmedEmail,
        code_hash: otpHash,
        temp_token: tempTokenValue,
        expires_at: expiresAt,
        attempts: 0,
      });

      // TODO: integrate transactional email provider to send `otp` to the admin.
      // The OTP is NEVER logged or returned in the response.
      return new Response(
        JSON.stringify({ success: true, tempToken: tempTokenValue }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      if (!code || !tempToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Código e token obrigatórios." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const trimmedCode = String(code).trim();
      if (!/^\d{6}$/.test(trimmedCode)) {
        return new Response(
          JSON.stringify({ success: false, error: "Código inválido." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: record, error: findError } = await adminClient
        .from("admin_2fa_codes")
        .select("*")
        .eq("temp_token", tempToken)
        .maybeSingle();

      if (findError || !record) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão expirada. Faça login novamente." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(record.expires_at) < new Date()) {
        await adminClient.from("admin_2fa_codes").delete().eq("id", record.id);
        return new Response(
          JSON.stringify({ success: false, error: "Código expirado. Faça login novamente." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (record.attempts >= 5) {
        await adminClient.from("admin_2fa_codes").delete().eq("id", record.id);
        return new Response(
          JSON.stringify({ success: false, error: "Muitas tentativas. Faça login novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient
        .from("admin_2fa_codes")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);

      const providedHash = await sha256Hex(trimmedCode);
      if (record.code_hash !== providedHash) {
        return new Response(
          JSON.stringify({ success: false, error: "Código inválido." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Burn the code
      await adminClient.from("admin_2fa_codes").delete().eq("id", record.id);

      return new Response(
        JSON.stringify({
          success: true,
          email: record.email,
          role: record.role,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-2fa] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
