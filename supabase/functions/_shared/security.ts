// Shared security utilities for all edge functions.
// - Strict CORS allowlist
// - Standard security headers
// - PII / secret masking for logs
// - Safe error responses (never leak stack/PII)
// - Abuse event logging helper (best-effort)

const ALLOWED_ORIGINS = new Set<string>([
  "https://hotzfy.com.br",
  "https://www.hotzfy.com.br",
  "https://biz-blossom-gate.lovable.app",
  "https://id-preview--8b85380d-bbad-44c2-8000-ac99dd36affb.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);

// Allow any *.lovable.app preview/sandbox host.
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".lovable.app")) return true;
    if (u.hostname.endsWith(".lovableproject.com")) return true;
  } catch {
    return false;
  }
  return false;
}

export const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allow = isAllowedOrigin(origin) ? origin! : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key, x-secret-key, x-idempotency-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export function baseHeaders(req: Request): Record<string, string> {
  return { ...SECURITY_HEADERS, ...buildCorsHeaders(req) };
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: baseHeaders(req) });
  }
  return null;
}

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders(req), "Content-Type": "application/json", ...extra },
  });
}

// ---------- PII / secret masking ----------

const EMAIL_RE = /([a-zA-Z0-9._-]{1,3})[a-zA-Z0-9._-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const CPF_RE = /\b(\d{3})\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ_RE = /\b(\d{2})\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const CARD_RE = /\b\d{13,19}\b/g;
const PHONE_RE = /\b(\+?\d{2})\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/g;
const JWT_RE = /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER_RE = /(Bearer\s+)[A-Za-z0-9._-]+/gi;
const SECRET_RE = /\b(sk|pk|whsec|sbp)_[A-Za-z0-9]{16,}\b/g;
const IPV4_RE = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

export function maskString(input: string): string {
  return input
    .replace(JWT_RE, "[JWT_REDACTED]")
    .replace(BEARER_RE, "$1[REDACTED]")
    .replace(SECRET_RE, "[SECRET_REDACTED]")
    .replace(EMAIL_RE, "$1***@$2")
    .replace(CPF_RE, "$1.***.***-**")
    .replace(CNPJ_RE, "$1.***.***/****-**")
    .replace(CARD_RE, (m) => m.slice(0, 4) + "****" + m.slice(-2))
    .replace(PHONE_RE, "$1*****")
    .replace(IPV4_RE, "$1.$2.*.*");
}

const SENSITIVE_KEYS = new Set([
  "password", "pwd", "secret", "token", "access_token", "refresh_token",
  "api_key", "apikey", "x-api-key", "authorization", "auth",
  "credit_card", "card_number", "cvv", "cvc",
  "document", "document_number", "cpf", "cnpj",
]);

export function maskObject<T>(value: T, depth = 0): T {
  if (depth > 6) return value;
  if (value == null) return value;
  if (typeof value === "string") return maskString(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => maskObject(v, depth + 1)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = maskObject(v, depth + 1);
      }
    }
    return out as unknown as T;
  }
  return value;
}

export function safeLog(scope: string, payload: unknown) {
  try {
    console.log(`[${scope}]`, JSON.stringify(maskObject(payload)));
  } catch {
    console.log(`[${scope}] <unserializable>`);
  }
}

export function safeError(scope: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${scope}] ${maskString(msg)}`);
}

// ---------- Hashing for abuse metrics (no raw PII stored) ----------

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "0.0.0.0"
  );
}

// Best-effort abuse event log. Never throws to the caller.
export async function logAbuseEvent(opts: {
  supabaseUrl: string;
  serviceKey: string;
  event_type: string;
  endpoint: string;
  status_code: number;
  identifier?: string | null;
  req?: Request;
  metadata?: Record<string, unknown>;
}) {
  try {
    const ip = opts.req ? clientIp(opts.req) : "0.0.0.0";
    const ua = opts.req?.headers.get("user-agent")?.slice(0, 200) ?? null;
    const ip_hash = await sha256Hex(ip);
    const identifier_hash = opts.identifier ? await sha256Hex(opts.identifier.toLowerCase()) : null;
    await fetch(`${opts.supabaseUrl}/rest/v1/auth_abuse_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: opts.serviceKey,
        Authorization: `Bearer ${opts.serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type: opts.event_type,
        endpoint: opts.endpoint,
        status_code: opts.status_code,
        identifier_hash,
        ip_hash,
        user_agent: ua,
        metadata: maskObject(opts.metadata ?? {}),
      }),
    });
  } catch (e) {
    safeError("logAbuseEvent", e);
  }
}

// ---------- Abuse guard (very conservative thresholds) ----------
// Returns { blocked, until } if the IP is already blocked OR just crossed the
// surreal threshold (default 100 events / 10s → 15 min block). Innocent users
// are mathematically safe: 10 req/s sustained is not human behavior.
export async function abuseGuard(opts: {
  supabaseUrl: string;
  serviceKey: string;
  req: Request;
  endpoint: string;
  windowSeconds?: number;
  maxEvents?: number;
  blockMinutes?: number;
}): Promise<{ blocked: boolean; until?: string }> {
  try {
    const ip_hash = await sha256Hex(clientIp(opts.req));
    const res = await fetch(`${opts.supabaseUrl}/rest/v1/rpc/check_and_block_abuse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: opts.serviceKey,
        Authorization: `Bearer ${opts.serviceKey}`,
      },
      body: JSON.stringify({
        _ip_hash: ip_hash,
        _endpoint: opts.endpoint,
        _window_seconds: opts.windowSeconds ?? 10,
        _max_events: opts.maxEvents ?? 100,
        _block_minutes: opts.blockMinutes ?? 15,
      }),
    });
    if (!res.ok) return { blocked: false };
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { blocked: !!row?.blocked, until: row?.blocked_until ?? undefined };
  } catch (e) {
    safeError("abuseGuard", e);
    return { blocked: false };
  }
}

// Immutable audit log helper — writes via RPC (service_role only).
export async function logSecurityEvent(opts: {
  supabaseUrl: string;
  serviceKey: string;
  req?: Request;
  event_type: string;
  endpoint: string;
  user_id?: string | null;
  actor_role?: string | null;
  status_code?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const ip_hash = opts.req ? await sha256Hex(clientIp(opts.req)) : null;
    const ua = opts.req?.headers.get("user-agent")?.slice(0, 200) ?? null;
    await fetch(`${opts.supabaseUrl}/rest/v1/rpc/log_security_event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: opts.serviceKey,
        Authorization: `Bearer ${opts.serviceKey}`,
      },
      body: JSON.stringify({
        _event_type: opts.event_type,
        _endpoint: opts.endpoint,
        _user_id: opts.user_id ?? null,
        _actor_role: opts.actor_role ?? null,
        _ip_hash: ip_hash,
        _user_agent: ua,
        _status_code: opts.status_code ?? null,
        _metadata: maskObject(opts.metadata ?? {}),
      }),
    });
  } catch (e) {
    safeError("logSecurityEvent", e);
  }
}
