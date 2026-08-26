import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://hotzfy.com.br",
  "https://www.hotzfy.com.br",
  "https://biz-blossom-gate.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.(lovable\.app|lovableproject\.com|lovable\.dev)$/i;
const BASE: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  const ok = !o || ALLOWED_ORIGINS.has(o) || LOVABLE_PREVIEW_RE.test(o);
  return ok && o ? { ...BASE, "Access-Control-Allow-Origin": o } : BASE;
}

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const corsHeaders = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const tempToken = String(body?.temp_token ?? "").trim();
    const code = String(body?.code ?? "").trim();
    if (!tempToken || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ success: false, error: "Código inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: row } = await admin.from("admin_2fa_codes")
      .select("*").eq("temp_token", tempToken).maybeSingle();
    if (!row) {
      return new Response(JSON.stringify({ success: false, error: "Sessão expirada. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await admin.from("admin_2fa_codes").delete().eq("id", row.id);
      return new Response(JSON.stringify({ success: false, error: "Código expirado. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      await admin.from("admin_2fa_codes").delete().eq("id", row.id);
      return new Response(JSON.stringify({ success: false, error: "Muitas tentativas. Faça login novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: verified, error: verifyError } = await authClient.auth.verifyOtp({
      email: row.email,
      token: code,
      type: "email",
    });
    if (verifyError || !verified.user || !verified.session || verified.user.id !== row.user_id) {
      await admin.from("admin_2fa_codes")
        .update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
      return new Response(JSON.stringify({ success: false, error: "Código incorreto." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleRows, error: roleError } = await admin
      .from("user_roles").select("role").eq("user_id", verified.user.id);
    const roles = (roleRows ?? []).map((entry: { role: string }) => entry.role);
    const role = roles.includes("admin") ? "admin" : roles.includes("employee") ? "employee" : null;
    if (roleError || !role || role !== row.role) {
      await admin.from("admin_2fa_codes").delete().eq("id", row.id);
      return new Response(JSON.stringify({ success: false, error: "Acesso não autorizado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Success — burn the challenge before releasing the newly minted session.
    await admin.from("admin_2fa_codes").delete().eq("id", row.id);

    return new Response(JSON.stringify({
      success: true,
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      role,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[admin-2fa-verify]", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ success: false, error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
