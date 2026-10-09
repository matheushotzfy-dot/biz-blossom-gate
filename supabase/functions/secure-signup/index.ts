import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, preflight } from "../_shared/security.ts";
import { validCpfOrCnpj } from "../_shared/documents.ts";

interface SignupPayload {
  email?: unknown;
  password?: unknown;
  metadata?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_METADATA = new Set([
  "full_name", "nickname", "document_number", "document_type", "phone",
  "referral_source", "company_name", "segment", "monthly_revenue_band",
]);

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function sanitizeMetadata(value: unknown): Record<string, string | null> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const sanitized: Record<string, string | null> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!ALLOWED_METADATA.has(key)) continue;
    if (rawValue === null) {
      sanitized[key] = null;
    } else if (typeof rawValue === "string") {
      sanitized[key] = rawValue.trim().slice(0, key === "full_name" ? 120 : 254);
    } else {
      return null;
    }
  }
  return sanitized;
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = buildCorsHeaders(req);
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido." }, 405, corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ success: false, error: "Serviço indisponível." }, 503, corsHeaders);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: rateRows, error: rateError } = await admin.rpc("bump_rate_limit", {
      _bucket_key: `secure_signup:${clientIp(req)}`,
      _window_seconds: 900,
      _max_count: 8,
    });
    const rateRow = Array.isArray(rateRows) ? rateRows[0] : null;
    if (rateError || rateRow?.allowed !== true) {
      return json({ success: false, error: "Muitas tentativas. Aguarde alguns minutos." }, 429, corsHeaders);
    }

    const body = await req.json().catch(() => null) as SignupPayload | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const metadata = sanitizeMetadata(body?.metadata);
    const documentNumber = metadata?.document_number?.replace(/\D/g, "") ?? "";
    const phone = metadata?.phone?.replace(/\D/g, "") ?? "";

    if (!EMAIL_PATTERN.test(email) || email.length > 254 || !metadata
      || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(password)
      || ![11, 14].includes(documentNumber.length) || !validCpfOrCnpj(documentNumber)
      || phone.length < 10 || phone.length > 13) {
      return json({ success: false, error: "Não foi possível criar a conta com os dados informados." }, 400, corsHeaders);
    }
    metadata.document_number = documentNumber;
    metadata.phone = phone;

    const { data: setting } = await admin.from("platform_settings")
      .select("value").eq("key", "require_email_verification").maybeSingle();
    const requireVerification = (setting?.value as { enabled?: boolean } | null)?.enabled ?? true;
    const origin = req.headers.get("origin");
    const { data: signupData, error: createError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      },
    });
    if (createError) {
      console.warn("[secure-signup] create rejected", createError.code ?? "unknown");
      return json({ success: false, error: "Não foi possível criar a conta com os dados informados." }, 400, corsHeaders);
    }
    if (!requireVerification && signupData.user?.id && !signupData.user.email_confirmed_at) {
      const { error: confirmError } = await admin.auth.admin.updateUserById(signupData.user.id, { email_confirm: true });
      if (confirmError) {
        console.error("[secure-signup] confirmation failed", confirmError.message);
        return json({ success: false, error: "Conta criada, mas a ativação está pendente. Verifique seu e-mail." }, 500, corsHeaders);
      }
    }
    return json({ success: true, requireVerification }, 200, corsHeaders);
  } catch (error) {
    console.error("[secure-signup]", error instanceof Error ? error.message : "unknown");
    return json({ success: false, error: "Serviço temporariamente indisponível." }, 500, corsHeaders);
  }
});