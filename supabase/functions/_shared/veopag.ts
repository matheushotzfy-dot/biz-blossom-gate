/**
 * VeoPag gateway helpers — used by podpay-create-transaction and quick-pix
 * when the seller is routed to VeoPag via seller_acquirer_config.
 *
 * Rules enforced here:
 * 1. Nunca enviar nome/email/domínio da plataforma para a VeoPag.
 *    O pagador (comprador) é enviado com nome + CPF reais, MAS o email
 *    é sempre substituído por um alias aleatório em provedor público
 *    (gmail/outlook/hotmail/yahoo) — sem qualquer trace de marca.
 * 2. O external_id enviado à VeoPag é o UUID interno da transação —
 *    não expõe nenhum identificador de vendedor/plataforma.
 * 3. clientCallbackUrl NÃO é enviado — a URL do webhook fica configurada
 *    exclusivamente no portal da VeoPag (o amigo já configurou).
 * 4. Token JWT (validade 1h) é cacheado em memória por até ~55 min para
 *    respeitar o rate limit de login (100 falhas/15min por IP).
 */

const VEOPAG_BASE = "https://api.veopag.com";
const TOKEN_TTL_MS = 55 * 60 * 1000;

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Fetch a fresh Bearer token, respecting the ~55min cache window. */
export async function getVeopagToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const clientId = Deno.env.get("VEOPAG_CLIENT_ID");
  const clientSecret = Deno.env.get("VEOPAG_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("VeoPag credentials not configured");
  }

  const resp = await fetch(`${VEOPAG_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!resp.ok) {
    // Do NOT log body — may contain sensitive strings.
    throw new Error(`VeoPag login failed: HTTP ${resp.status}`);
  }
  const data = await resp.json().catch(() => ({} as any));
  const token = (data as any)?.token as string | undefined;
  if (!token || typeof token !== "string") {
    throw new Error("VeoPag login returned no token");
  }
  cachedToken = { token, expiresAt: now + TOKEN_TTL_MS };
  return token;
}

/**
 * Deterministic anonymous email — no PII, no brand traces.
 * Seed is combined with a small random suffix so retries under the
 * same idempotency key still land on the same shape but stay unique
 * enough for VeoPag's internal deduplication rules.
 */
export function anonymizedEmail(seed: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  const providers = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com"];
  const suffix = Math.floor(Math.random() * 9000 + 1000).toString();
  return `user${h % 100_000_000}${suffix}@${providers[h % providers.length]}`;
}

export interface VeopagDepositInput {
  /** Amount in BRL (reais, e.g. 100.00). */
  amount: number;
  /** Idempotency key = internal transaction UUID. */
  externalId: string;
  /** Real buyer name. */
  payerName: string;
  /** Real buyer CPF/CNPJ (digits only). */
  payerDocument: string;
  /** Optional buyer phone (digits only). */
  payerPhone?: string | null;
}

export interface VeopagDepositResult {
  /** VeoPag's transaction id (UUID). */
  transactionId: string;
  /** PIX Copia e Cola (EMV BR Code). */
  qrcode: string;
  /** VeoPag status (PENDING / COMPLETED / FAILED). */
  status: string;
}

/**
 * Create a PIX deposit on VeoPag.
 * Throws on any non-2xx response. Never logs payer info or full payload.
 */
export async function createVeopagDeposit(input: VeopagDepositInput): Promise<VeopagDepositResult> {
  const token = await getVeopagToken();

  const body: Record<string, unknown> = {
    amount: Number(input.amount),
    external_id: input.externalId,
    // NOTE: clientCallbackUrl intentionally omitted — portal has the URL.
    payer: {
      name: input.payerName,
      email: anonymizedEmail(input.externalId + input.payerDocument),
      document: input.payerDocument,
      ...(input.payerPhone ? { phone: input.payerPhone } : {}),
    },
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);

  let resp: Response;
  try {
    resp = await fetch(`${VEOPAG_BASE}/api/payments/deposit`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  const data = await resp.json().catch(() => ({} as any));
  if (!resp.ok) {
    throw new Error(`VeoPag deposit HTTP ${resp.status}`);
  }

  // 201 → { qrCodeResponse: {...} } ; 200 idempotent → { transaction_id, qrcode, ... }
  const qr = ((data as any).qrCodeResponse ?? data) as Record<string, unknown>;
  const transactionId = String((qr as any).transactionId ?? (qr as any).transaction_id ?? "");
  const qrcode = String((qr as any).qrcode ?? "");
  const status = String((qr as any).status ?? "PENDING");

  if (!transactionId || !qrcode) {
    throw new Error("VeoPag deposit response missing transactionId or qrcode");
  }
  return { transactionId, qrcode, status };
}

/**
 * Resolve the active acquirer slug for a seller.
 * Returns 'veopag' when the seller has that acquirer active in seller_acquirer_config
 * (with the highest priority). Falls back to 'podpay' when nothing is configured.
 */
export async function resolveAcquirerSlug(
  supabase: any,
  userId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("seller_acquirer_config")
      .select("priority, is_active, acquirers!inner(slug, is_active)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    for (const row of (data ?? []) as any[]) {
      const slug = row?.acquirers?.slug as string | undefined;
      const acqActive = row?.acquirers?.is_active as boolean | undefined;
      if (slug && acqActive) return slug;
    }
  } catch (_) {
    // fail-open to the platform default
  }
  return "podpay";
}
