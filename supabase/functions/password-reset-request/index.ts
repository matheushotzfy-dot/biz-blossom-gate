/**
 * Gate de recuperação de senha.
 *
 * O cliente não chama mais `resetPasswordForEmail` direto: sem um limitador
 * próprio, o endpoint vira vetor de abuso de volume (spam de e-mail) e de
 * sondagem de contas. Aqui aplicamos rate limit por IP e por e-mail, validamos
 * o destino do redirect contra uma allowlist e devolvemos SEMPRE a mesma
 * resposta, exista ou não a conta.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { json, preflight, safeError } from "../_shared/security.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  redirectTo: z.string().trim().url().max(500).optional(),
}).strict();

const ALLOWED_REDIRECT_HOSTS = [
  "hotzfy.com.br",
  "www.hotzfy.com.br",
  "biz-blossom-gate.lovable.app",
  "localhost",
];

function isAllowedRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    if (ALLOWED_REDIRECT_HOSTS.includes(u.hostname)) return true;
    return u.hostname.endsWith(".lovable.app") || u.hostname.endsWith(".lovableproject.com");
  } catch {
    return false;
  }
}

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "0.0.0.0";
}

// Resposta idêntica em todos os caminhos — nunca revela se a conta existe.
const GENERIC = { success: true, message: "Se o e-mail estiver cadastrado, você receberá um código de recuperação." };

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { success: false, error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(req, { success: false, error: "Serviço indisponível." }, 503);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      // Mesmo com payload inválido devolvemos a resposta genérica para não
      // diferenciar formatos aceitos de contas existentes.
      return json(req, GENERIC);
    }
    const email = parsed.data.email.toLowerCase();

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [byIp, byEmail] = await Promise.all([
      admin.rpc("bump_rate_limit", { _bucket_key: `pwd_reset_ip:${clientIp(req)}`, _window_seconds: 900, _max_count: 10 }),
      admin.rpc("bump_rate_limit", { _bucket_key: `pwd_reset_email:${email}`, _window_seconds: 900, _max_count: 3 }),
    ]);
    const blocked = [byIp, byEmail].some((r) =>
      Array.isArray(r.data) ? (r.data[0] as { allowed?: boolean } | undefined)?.allowed === false : false
    );
    if (blocked) {
      await admin.from("security_audit_log").insert({
        event_type: "password_reset_rate_limited",
        endpoint: "password-reset-request",
        status_code: 429,
      }).then(() => undefined, () => undefined);
      // Ainda assim resposta genérica, com 429 apenas para o cliente recuar.
      return json(req, GENERIC, 429, { "Retry-After": "900" });
    }

    const redirectTo = parsed.data.redirectTo && isAllowedRedirect(parsed.data.redirectTo)
      ? parsed.data.redirectTo
      : undefined;

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await authClient.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) safeError("password-reset-request", error);

    await admin.from("security_audit_log").insert({
      event_type: "password_reset_requested",
      endpoint: "password-reset-request",
      status_code: 200,
    }).then(() => undefined, () => undefined);

    return json(req, GENERIC);
  } catch (error) {
    safeError("password-reset-request", error);
    return json(req, GENERIC);
  }
});
