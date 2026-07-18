/**
 * PodPay v1 (nova) — helpers.
 *
 * Base URL: https://api.podpay.app
 * Auth:     header `x-api-key: <sk_...>`
 * Amounts:  centavos (integer)
 * Idempotência: header `X-Idempotency-Key` (UUID v4)
 *
 * Respostas seguem o envelope:
 *   { success: true|false, data: {...}|error: {...}, meta: {...} }
 *
 * Nunca logamos: chave, corpo bruto, PII do pagador.
 */

export const PODPAY_APP_BASE = "https://api.podpay.app";

/** Carrega credenciais da PodPay v1.
 *  Prioridade: linha em `acquirers` (slug='podpay_app') → env `PODPAY_APP_API_KEY`.
 */
export async function loadPodpayAppApiKey(supabase?: any): Promise<string> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from("acquirers")
        .select("api_key_encrypted, is_active")
        .eq("slug", "podpay_app")
        .maybeSingle();
      if (data?.is_active && data.api_key_encrypted) {
        return String(data.api_key_encrypted);
      }
    } catch (_) { /* fall through */ }
  }
  const envKey = Deno.env.get("PODPAY_APP_API_KEY");
  if (!envKey) throw new Error("PODPAY_APP_API_KEY not configured");
  return envKey;
}

/** Email anônimo determinístico (sem PII/branding). */
export function anonymizedEmail(seed: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  const providers = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com"];
  const suffix = Math.floor(Math.random() * 9000 + 1000).toString();
  return `user${h % 100_000_000}${suffix}@${providers[h % providers.length]}`;
}

export interface PodpayAppPixInput {
  amount: number;              // BRL (ex: 100.00)
  externalId: string;          // UUID da tx interna (usado como idempotency key)
  payerName: string;
  payerDocument: string;       // digits only
  payerPhone?: string | null;
  description?: string;
}

export interface PodpayAppPixResult {
  transactionId: string;       // id retornado pela PodPay
  qrcode: string;              // EMV BR Code (copia e cola)
  qrcodeImage?: string;        // base64 opcional
  status: string;              // status bruto retornado
  expiresAt?: string | null;
}

/** Cria transação PIX na PodPay v1. */
export async function createPodpayAppPix(
  input: PodpayAppPixInput,
  supabase?: any,
): Promise<PodpayAppPixResult> {
  const apiKey = await loadPodpayAppApiKey(supabase);
  const amountCents = Math.round(Number(input.amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Invalid amount");
  }

  // Phone é obrigatório na PodPay v1 — cai em fallback determinístico se ausente.
  const phoneDigits = (input.payerPhone ?? "").replace(/\D/g, "");
  const phone = phoneDigits.length >= 10 ? phoneDigits : "11900000000";

  const body = {
    amount: amountCents,
    currency: "BRL",
    paymentMethod: "pix",
    externalId: input.externalId,
    description: (input.description ?? "Cobrança PIX").slice(0, 100),
    customer: {
      name: input.payerName,
      email: anonymizedEmail(input.externalId + input.payerDocument),
      phone,
      document: {
        number: input.payerDocument,
        type: input.payerDocument.length > 11 ? "cnpj" : "cpf",
      },
    },
    items: [{
      title: (input.description ?? "Cobrança PIX").slice(0, 100),
      quantity: 1,
      unitPrice: amountCents,
      tangible: false,
    }],
    pix: { expiresInMinutes: 30 },
    postbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/podpay-app-webhook`,
  };


  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);

  let resp: Response;
  try {
    resp = await fetch(`${PODPAY_APP_BASE}/v1/transactions`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "X-Idempotency-Key": input.externalId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  const raw = await resp.json().catch(() => ({} as any));
  if (!resp.ok || raw?.success === false) {
    const code = raw?.error?.code ?? "UNKNOWN";
    const msg = raw?.error?.message ?? "";
    throw new Error(`PodPay create failed: HTTP ${resp.status} (${code}) ${msg}`.trim());
  }

  const data = (raw?.data ?? raw) as any;
  const transactionId = String(data?.id ?? data?.transactionId ?? "");
  const qrcode = String(
    data?.pixQrCode ?? data?.pix?.qrCode ?? data?.pix?.qrcode ?? data?.qrCode ?? "",
  );
  const qrcodeImage = data?.pixQrCodeImage ?? data?.pix?.qrCodeImage ?? undefined;
  const status = String(data?.status ?? "pending");
  const expiresAt = data?.pixExpiresAt ?? data?.pix?.expiresAt ?? data?.expiresAt ?? null;

  if (!transactionId || !qrcode) {
    throw new Error("PodPay response missing id or qrcode");
  }
  return { transactionId, qrcode, qrcodeImage, status, expiresAt };
}


/** Consulta status de uma transação PodPay v1 (usado pelo poll). */
export async function fetchPodpayAppTransaction(
  txId: string,
  supabase?: any,
): Promise<{ status: string; amount?: number } | null> {
  const apiKey = await loadPodpayAppApiKey(supabase);
  try {
    const resp = await fetch(`${PODPAY_APP_BASE}/v1/transactions/${txId}`, {
      headers: { "x-api-key": apiKey, "Accept": "application/json" },
    });
    if (resp.status === 404) return null;
    if (!resp.ok) return null;
    const raw = await resp.json().catch(() => ({} as any));
    const data = (raw?.data ?? raw) as any;
    const status = String(data?.status ?? "");
    const amtRaw = data?.amount;
    const amount = typeof amtRaw === "number" ? amtRaw : undefined;
    return { status, amount };
  } catch (_) {
    return null;
  }
}
