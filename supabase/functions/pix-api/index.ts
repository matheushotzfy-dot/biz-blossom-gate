// Public PIX API — server-to-server gateway
// Auth: Bearer sk_live_xxx OR X-API-Key
// Versioned: /v1/*

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- Public API: restrictive CORS (server-to-server). We allow * because
// integrators call from servers; preflight still validated below.
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-api-key, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "3600",
};

const MAX_BODY_BYTES = 100 * 1024; // 100KB

// ---- Helpers ---------------------------------------------------------------

function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  extra: Record<string, unknown> = {},
) {
  return jsonResponse(status, {
    error: { code, message, request_id: requestId, ...extra },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomRequestId(): string {
  return "req_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") || "0.0.0.0";
}

function maskEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function cleanDocument(doc: string): string | null {
  const d = String(doc).replace(/\D/g, "");
  if (d.length !== 11 && d.length !== 14) return null;
  return d;
}

// ---- Logging (no PII, no secrets) -----------------------------------------

interface LogCtx {
  requestId: string;
  apiKeyId?: string;
  userId?: string;
  endpoint: string;
  method: string;
  ip: string;
  userAgent: string;
  startedAt: number;
}

async function writeRequestLog(
  admin: ReturnType<typeof createClient>,
  ctx: LogCtx,
  statusCode: number,
  errorCode?: string,
) {
  try {
    await admin.from("api_request_logs").insert({
      request_id: ctx.requestId,
      api_key_id: ctx.apiKeyId ?? null,
      user_id: ctx.userId ?? null,
      endpoint: ctx.endpoint,
      method: ctx.method,
      status_code: statusCode,
      latency_ms: Date.now() - ctx.startedAt,
      ip: ctx.ip,
      user_agent: ctx.userAgent.slice(0, 255),
      error_code: errorCode ?? null,
    });
  } catch {
    // never let logging break the response
  }
}

// ---- Rate limiting ---------------------------------------------------------

interface RateLimit {
  bucket: string;
  windowSec: number;
  max: number;
}

async function checkRateLimits(
  admin: ReturnType<typeof createClient>,
  limits: RateLimit[],
): Promise<{ blocked: boolean; resetAt?: string; remaining?: number; limit?: number }> {
  for (const l of limits) {
    const { data, error } = await admin.rpc("bump_rate_limit", {
      _bucket_key: l.bucket,
      _window_seconds: l.windowSec,
      _max_count: l.max,
    });
    if (error) continue; // fail open on rate-limit infra errors
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      return {
        blocked: true,
        resetAt: row.reset_at,
        remaining: 0,
        limit: l.max,
      };
    }
  }
  return { blocked: false };
}

// ---- Auth ------------------------------------------------------------------

interface AuthedKey {
  apiKeyId: string;
  userId: string;
  permissions: string[];
  ipAllowlist: string[];
}

function extractSecretKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token.startsWith("sk_")) return token;
  }
  const xKey = req.headers.get("x-api-key");
  if (xKey?.startsWith("sk_")) return xKey.trim();
  return null;
}

async function authenticateRequest(
  admin: ReturnType<typeof createClient>,
  req: Request,
  ip: string,
): Promise<{ key?: AuthedKey; error?: { code: string; message: string; status: number } }> {
  const secret = extractSecretKey(req);
  if (!secret) {
    return {
      error: {
        status: 401,
        code: "missing_api_key",
        message: "Authentication required. Provide a secret key via Authorization: Bearer sk_live_... or X-API-Key header.",
      },
    };
  }
  if (secret.length < 20 || secret.length > 80) {
    return {
      error: { status: 401, code: "invalid_api_key", message: "Invalid API key format." },
    };
  }

  const prefix = secret.slice(0, 12);
  const hash = await sha256Hex(secret);

  const { data, error } = await admin.rpc("verify_api_secret", {
    _prefix: prefix,
    _hash: hash,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return {
      error: { status: 401, code: "invalid_api_key", message: "Invalid or revoked API key." },
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const key: AuthedKey = {
    apiKeyId: row.api_key_id,
    userId: row.user_id,
    permissions: row.permissions || ["read", "write"],
    ipAllowlist: row.ip_allowlist || [],
  };

  if (key.ipAllowlist.length > 0 && !key.ipAllowlist.includes(ip)) {
    return {
      error: { status: 403, code: "ip_not_allowed", message: "Request IP is not in the API key allowlist." },
    };
  }

  // fire-and-forget last_used_at update
  admin.rpc("touch_api_key", { _api_key_id: key.apiKeyId }).then(() => {});

  return { key };
}

// ---- Input validation ------------------------------------------------------

interface ChargeInput {
  amount_cents: number;
  customer_name: string;
  customer_email: string;
  customer_document: string;
  customer_phone?: string;
  external_id?: string;
  expires_in_minutes?: number;
  metadata?: Record<string, unknown>;
  product_id?: string;
}

function validateChargeInput(body: unknown): { ok: true; data: ChargeInput } | { ok: false; field: string; message: string } {
  if (!body || typeof body !== "object") return { ok: false, field: "body", message: "Body must be a JSON object." };
  const b = body as Record<string, unknown>;

  const amount = Number(b.amount_cents);
  if (!Number.isInteger(amount) || amount < 100 || amount > 9_999_999) {
    return { ok: false, field: "amount_cents", message: "amount_cents must be an integer between 100 (R$1,00) and 9999999." };
  }

  const customer = (b.customer && typeof b.customer === "object" ? b.customer : b) as Record<string, unknown>;

  const name = String(customer.name ?? customer.customer_name ?? "").trim();
  if (name.length < 2 || name.length > 200) {
    return { ok: false, field: "customer.name", message: "customer.name must be 2-200 chars." };
  }

  const email = String(customer.email ?? customer.customer_email ?? "").trim().toLowerCase();
  if (!maskEmailValid(email)) {
    return { ok: false, field: "customer.email", message: "customer.email must be a valid email." };
  }

  const docRaw = String(customer.document ?? customer.customer_document ?? "");
  const document = cleanDocument(docRaw);
  if (!document) {
    return { ok: false, field: "customer.document", message: "customer.document must be a valid CPF (11) or CNPJ (14) digit string." };
  }

  const phone = customer.phone ? String(customer.phone).replace(/\D/g, "").slice(0, 11) : undefined;

  const externalId = b.external_id !== undefined ? String(b.external_id).trim().slice(0, 100) : undefined;
  if (externalId !== undefined && externalId.length === 0) {
    return { ok: false, field: "external_id", message: "external_id, if provided, must be non-empty." };
  }

  const expiresIn = b.expires_in_minutes !== undefined ? Number(b.expires_in_minutes) : 30;
  if (!Number.isInteger(expiresIn) || expiresIn < 5 || expiresIn > 1440) {
    return { ok: false, field: "expires_in_minutes", message: "expires_in_minutes must be 5-1440." };
  }

  let metadata: Record<string, unknown> = {};
  if (b.metadata !== undefined) {
    if (typeof b.metadata !== "object" || Array.isArray(b.metadata) || b.metadata === null) {
      return { ok: false, field: "metadata", message: "metadata must be an object." };
    }
    const str = JSON.stringify(b.metadata);
    if (str.length > 4000) {
      return { ok: false, field: "metadata", message: "metadata JSON must be <= 4KB." };
    }
    metadata = b.metadata as Record<string, unknown>;
  }

  const productId = b.product_id ? String(b.product_id) : undefined;

  return {
    ok: true,
    data: {
      amount_cents: amount,
      customer_name: name,
      customer_email: email,
      customer_document: document,
      customer_phone: phone,
      external_id: externalId,
      expires_in_minutes: expiresIn,
      metadata,
      product_id: productId,
    },
  };
}

// ---- Output serializers (whitelist) ---------------------------------------

interface DbTransaction {
  id: string;
  external_id: string | null;
  status: string;
  amount: number;
  net_amount: number;
  payment_method: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_document: string | null;
  metadata: Record<string, unknown> | null;
  pix_qrcode: string | null;
  pix_copy_paste: string | null;
  pix_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

function serializeCharge(t: DbTransaction) {
  return {
    id: t.id,
    object: "charge",
    external_id: t.external_id,
    status: t.status,
    amount_cents: Math.round(Number(t.amount) * 100),
    net_amount_cents: Math.round(Number(t.net_amount) * 100),
    payment_method: t.payment_method ?? "pix",
    customer: {
      name: t.customer_name,
      email: t.customer_email,
      document: t.customer_document,
    },
    pix: {
      qr_code: t.pix_qrcode,
      qr_code_image: t.pix_qrcode
        ? `data:image/svg+xml;utf8,${
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>`,
          )
        }`
        : null,
      copy_paste: t.pix_copy_paste,
      expires_at: t.pix_expires_at,
    },
    metadata: t.metadata ?? {},
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

// ---- Fee calculation -------------------------------------------------------

async function calculateFees(
  admin: ReturnType<typeof createClient>,
  amountReais: number,
): Promise<{ feeAmount: number; netAmount: number } | null> {
  const { data: fees } = await admin.from("fees").select("name, fee_type, value");
  if (!fees || fees.length === 0) return null;

  const pix = fees.find((f) => f.name === "Taxa PIX");
  const fixed = fees.find((f) => f.name === "Taxa Fixa por Transação" && f.fee_type === "fixed");

  let feeAmount = 0;
  if (pix) {
    if (pix.fee_type === "percentage") feeAmount = amountReais * Number(pix.value) / 100;
    else feeAmount = Number(pix.value);
  }
  if (fixed) feeAmount += Number(fixed.value);

  if (feeAmount < 0 || feeAmount >= amountReais) return null;

  feeAmount = Math.round(feeAmount * 100) / 100;
  const netAmount = Math.round((amountReais - feeAmount) * 100) / 100;
  return { feeAmount, netAmount };
}

// ---- PIX creation via Podpay ----------------------------------------------

async function createPixViaPodpay(
  amountCents: number,
  customer: { name: string; email: string; document: string },
  externalRef: string,
  supabaseUrl: string,
  expiresInMinutes: number,
): Promise<
  | { ok: true; podpayId: string; qrCode: string; copyPaste: string; expiresAt: string }
  | { ok: false; status: number; message: string }
> {
  const publicKey = Deno.env.get("PODPAY_PUBLIC_KEY")!;
  const secretKey = Deno.env.get("PODPAY_SECRET_KEY")!;
  const auth = "Basic " + btoa(`${publicKey}:${secretKey}`);

  const payload = {
    amount: amountCents,
    paymentMethod: "pix",
    items: [{
      externalRef,
      title: "Cobrança PIX",
      unitPrice: amountCents,
      quantity: 1,
      tangible: false,
    }],
    customer: {
      name: customer.name,
      email: customer.email,
      document: {
        number: customer.document,
        type: customer.document.length > 11 ? "cnpj" : "cpf",
      },
    },
    postbackUrl: `${supabaseUrl}/functions/v1/podpay-postback`,
    externalRef,
    pix: { expiresInMinutes },
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch("https://api.podpay.co/v1/transactions", {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, status: 502, message: "Payment provider rejected the charge." };
    }
    const inner = data.data ?? data;
    const pix = inner.pix ?? {};
    return {
      ok: true,
      podpayId: String(inner.id ?? ""),
      qrCode: String(pix.qrcode ?? pix.qrCode ?? ""),
      copyPaste: String(pix.copyPaste ?? pix.copy_paste ?? pix.qrcode ?? ""),
      expiresAt: pix.expiresAt ?? pix.expires_at ?? new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
    };
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 502,
      message: isAbort ? "Payment provider timed out." : "Payment provider unreachable.",
    };
  } finally {
    clearTimeout(t);
  }
}

// ---- Handlers --------------------------------------------------------------

async function handlePing(ctx: LogCtx, requestId: string) {
  return jsonResponse(200, {
    ok: true,
    api_version: "v1",
    request_id: requestId,
    timestamp: new Date().toISOString(),
  });
}

async function handleCreateCharge(
  admin: ReturnType<typeof createClient>,
  key: AuthedKey,
  req: Request,
  ctx: LogCtx,
  requestId: string,
  bodyText: string,
) {
  if (!key.permissions.includes("write")) {
    return errorResponse(403, "permission_denied", "API key lacks write permission.", requestId);
  }

  let parsed: unknown;
  try { parsed = JSON.parse(bodyText); } catch {
    return errorResponse(400, "invalid_json", "Request body is not valid JSON.", requestId);
  }

  const validation = validateChargeInput(parsed);
  if (!validation.ok) {
    return errorResponse(400, "validation_error", validation.message, requestId, { field: validation.field });
  }
  const input = validation.data;

  // Idempotency
  const idemHeader = req.headers.get("idempotency-key")?.trim();
  const requestHash = await sha256Hex(bodyText);

  if (idemHeader) {
    if (idemHeader.length > 255) {
      return errorResponse(400, "invalid_idempotency_key", "Idempotency-Key too long.", requestId);
    }
    const { data: existing } = await admin
      .from("api_idempotency_keys")
      .select("response_body, response_status, request_hash, expires_at")
      .eq("api_key_id", key.apiKeyId)
      .eq("key", idemHeader)
      .maybeSingle();

    if (existing && new Date(existing.expires_at) > new Date()) {
      if (existing.request_hash !== requestHash) {
        return errorResponse(409, "idempotency_conflict", "Idempotency-Key was reused with a different request body.", requestId);
      }
      return jsonResponse(existing.response_status, existing.response_body, { "Idempotent-Replay": "true" });
    }
  }

  // Anti-fraud: blacklist
  const { data: blCheck } = await admin.rpc("check_blacklist", {
    _email: input.customer_email,
    _document: input.customer_document,
    _ip: ctx.ip,
  });
  if (blCheck && blCheck.length > 0 && blCheck[0].blocked) {
    return errorResponse(403, "fraud_blocked", "Charge could not be processed.", requestId);
  }

  // Fees
  const amountReais = input.amount_cents / 100;
  const fees = await calculateFees(admin, amountReais);
  if (!fees) {
    return errorResponse(503, "fee_config_unavailable", "Fee configuration unavailable.", requestId);
  }

  // Optional product validation (only if product_id provided)
  let productId: string | null = null;
  if (input.product_id) {
    const { data: product } = await admin
      .from("products")
      .select("id, user_id, status")
      .eq("id", input.product_id)
      .eq("user_id", key.userId)
      .maybeSingle();
    if (!product || product.status !== "active") {
      return errorResponse(400, "invalid_product", "product_id does not belong to this account or is not active.", requestId);
    }
    productId = product.id;
  }

  // Create Podpay PIX
  const externalRef = `api_${crypto.randomUUID()}`;
  const podpay = await createPixViaPodpay(
    input.amount_cents,
    {
      name: input.customer_name,
      email: input.customer_email,
      document: input.customer_document,
    },
    externalRef,
    Deno.env.get("SUPABASE_URL")!,
    input.expires_in_minutes!,
  );

  if (!podpay.ok) {
    return errorResponse(podpay.status, "provider_error", podpay.message, requestId);
  }

  // Persist transaction
  const insertPayload = {
    user_id: key.userId,
    product_id: productId,
    api_key_id: key.apiKeyId,
    amount: amountReais,
    fee_amount: fees.feeAmount,
    net_amount: fees.netAmount,
    status: "pending",
    payment_method: "pix",
    customer_name: input.customer_name,
    customer_email: input.customer_email,
    customer_document: input.customer_document,
    customer_phone: input.customer_phone ?? null,
    podpay_payment_id: podpay.podpayId || null,
    external_id: input.external_id ?? null,
    metadata: input.metadata ?? {},
    source: "api",
    pix_qrcode: podpay.qrCode,
    pix_copy_paste: podpay.copyPaste,
    pix_expires_at: podpay.expiresAt,
  };

  const { data: tx, error: txErr } = await admin
    .from("transactions")
    .insert(insertPayload)
    .select("id, external_id, status, amount, net_amount, payment_method, customer_name, customer_email, customer_document, metadata, pix_qrcode, pix_copy_paste, pix_expires_at, created_at, updated_at")
    .single();

  if (txErr || !tx) {
    if (txErr?.code === "23505") {
      return errorResponse(409, "duplicate_external_id", "A charge with this external_id already exists.", requestId);
    }
    return errorResponse(500, "internal_error", "Could not persist charge.", requestId);
  }

  const responseBody = { data: serializeCharge(tx as DbTransaction) };

  if (idemHeader) {
    await admin.from("api_idempotency_keys").upsert({
      api_key_id: key.apiKeyId,
      key: idemHeader,
      request_hash: requestHash,
      response_body: responseBody,
      response_status: 201,
    }, { onConflict: "api_key_id,key" });
  }

  return jsonResponse(201, responseBody);
}

async function handleGetCharge(
  admin: ReturnType<typeof createClient>,
  key: AuthedKey,
  id: string,
  requestId: string,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return errorResponse(400, "invalid_id", "Invalid charge id format.", requestId);
  }
  const { data: tx, error } = await admin
    .from("transactions")
    .select("id, external_id, status, amount, net_amount, payment_method, customer_name, customer_email, customer_document, metadata, pix_qrcode, pix_copy_paste, pix_expires_at, created_at, updated_at, user_id")
    .eq("id", id)
    .eq("user_id", key.userId)
    .maybeSingle();

  if (error || !tx) {
    return errorResponse(404, "not_found", "Charge not found.", requestId);
  }
  return jsonResponse(200, { data: serializeCharge(tx as DbTransaction) });
}

async function handleListCharges(
  admin: ReturnType<typeof createClient>,
  key: AuthedKey,
  url: URL,
  requestId: string,
) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20"), 1), 100);
  const status = url.searchParams.get("status");
  const cursor = url.searchParams.get("starting_after");

  let q = admin
    .from("transactions")
    .select("id, external_id, status, amount, net_amount, payment_method, customer_name, customer_email, customer_document, metadata, pix_qrcode, pix_copy_paste, pix_expires_at, created_at, updated_at")
    .eq("user_id", key.userId)
    .eq("source", "api")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (status) q = q.eq("status", status);
  if (cursor) {
    const { data: c } = await admin.from("transactions").select("created_at").eq("id", cursor).maybeSingle();
    if (c) q = q.lt("created_at", c.created_at);
  }

  const { data, error } = await q;
  if (error) return errorResponse(500, "internal_error", "Could not list charges.", requestId);

  const rows = (data || []) as DbTransaction[];
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);

  return jsonResponse(200, {
    data: slice.map(serializeCharge),
    has_more: hasMore,
    next_cursor: hasMore ? slice[slice.length - 1].id : null,
  });
}

async function handleRefund(
  admin: ReturnType<typeof createClient>,
  key: AuthedKey,
  id: string,
  requestId: string,
) {
  if (!key.permissions.includes("write")) {
    return errorResponse(403, "permission_denied", "API key lacks write permission.", requestId);
  }
  // Minimal MVP: mark as refunded; integration with Podpay refund endpoint can be added later
  const { data: tx } = await admin
    .from("transactions")
    .select("id, status, user_id")
    .eq("id", id)
    .eq("user_id", key.userId)
    .maybeSingle();
  if (!tx) return errorResponse(404, "not_found", "Charge not found.", requestId);
  if (tx.status !== "completed") {
    return errorResponse(409, "invalid_status", "Only completed charges can be refunded.", requestId);
  }
  // Placeholder — actual provider refund call should go here
  return errorResponse(501, "not_implemented", "Refund via API is coming soon. Use the dashboard for now.", requestId);
}

// ---- Router ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = randomRequestId();
  const url = new URL(req.url);
  // Edge function path comes as /pix-api/v1/... — strip the function name
  const path = url.pathname.replace(/^\/pix-api/, "") || "/";
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ctx: LogCtx = {
    requestId,
    endpoint: path,
    method: req.method,
    ip,
    userAgent,
    startedAt: Date.now(),
  };

  // IP-level rate limit (anti brute-force on invalid keys)
  const ipLimit = await checkRateLimits(admin, [
    { bucket: `ip:${ip}`, windowSec: 10, max: 100 },
  ]);
  if (ipLimit.blocked) {
    await writeRequestLog(admin, ctx, 429, "rate_limited_ip");
    return errorResponse(429, "rate_limited", "Too many requests from this IP.", requestId);
  }

  // Method/body guards
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      await writeRequestLog(admin, ctx, 415, "unsupported_media");
      return errorResponse(415, "unsupported_media_type", "Content-Type must be application/json.", requestId);
    }
    const cl = parseInt(req.headers.get("content-length") || "0");
    if (cl > MAX_BODY_BYTES) {
      await writeRequestLog(admin, ctx, 413, "body_too_large");
      return errorResponse(413, "payload_too_large", "Request body exceeds 100KB.", requestId);
    }
  }

  let bodyText = "";
  if (req.method === "POST") {
    bodyText = await req.text();
    if (bodyText.length > MAX_BODY_BYTES) {
      await writeRequestLog(admin, ctx, 413, "body_too_large");
      return errorResponse(413, "payload_too_large", "Request body exceeds 100KB.", requestId);
    }
  }

  // Public: nothing. All endpoints require auth.
  const authResult = await authenticateRequest(admin, req, ip);
  if (!authResult.key) {
    const e = authResult.error!;
    await writeRequestLog(admin, ctx, e.status, e.code);
    return errorResponse(e.status, e.code, e.message, requestId);
  }
  const key = authResult.key;
  ctx.apiKeyId = key.apiKeyId;
  ctx.userId = key.userId;

  // Per-key rate limits
  const keyLimits: RateLimit[] = [
    { bucket: `key:${key.apiKeyId}:burst`, windowSec: 10, max: 30 },
    { bucket: `key:${key.apiKeyId}:sustained`, windowSec: 60, max: 600 },
  ];
  if (req.method === "POST" && path.includes("/charges")) {
    keyLimits.push({ bucket: `key:${key.apiKeyId}:create`, windowSec: 60, max: 60 });
  }
  const keyLimit = await checkRateLimits(admin, keyLimits);
  if (keyLimit.blocked) {
    await writeRequestLog(admin, ctx, 429, "rate_limited_key");
    return errorResponse(
      429,
      "rate_limited",
      "Rate limit exceeded for this API key.",
      requestId,
      { reset_at: keyLimit.resetAt },
    );
  }

  try {
    // Routing
    let resp: Response;

    if (path === "/v1/ping" && req.method === "GET") {
      resp = await handlePing(ctx, requestId);
    } else if (path === "/v1/pix/charges" && req.method === "POST") {
      resp = await handleCreateCharge(admin, key, req, ctx, requestId, bodyText);
    } else if (path === "/v1/pix/charges" && req.method === "GET") {
      resp = await handleListCharges(admin, key, url, requestId);
    } else if (path.match(/^\/v1\/pix\/charges\/[^/]+$/) && req.method === "GET") {
      const id = path.split("/").pop()!;
      resp = await handleGetCharge(admin, key, id, requestId);
    } else if (path.match(/^\/v1\/pix\/charges\/[^/]+\/refund$/) && req.method === "POST") {
      const id = path.split("/")[4];
      resp = await handleRefund(admin, key, id, requestId);
    } else {
      resp = errorResponse(404, "route_not_found", `No route for ${req.method} ${path}`, requestId);
    }

    await writeRequestLog(admin, ctx, resp.status);
    return resp;
  } catch (err) {
    console.log(`[pix-api] internal error req=${requestId}`, err instanceof Error ? err.message : "unknown");
    await writeRequestLog(admin, ctx, 500, "internal_error");
    return errorResponse(500, "internal_error", "An internal error occurred.", requestId);
  }
});
