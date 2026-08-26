export const FINAL_TRANSACTION_STATUSES = new Set([
  "completed",
  "refunded",
  "chargeback",
  "expired",
]);

const ALLOWED_TRANSITIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  pending: new Set(["pending", "completed", "failed", "cancelled", "expired"]),
  waiting_payment: new Set(["pending", "completed", "failed", "cancelled", "expired"]),
  processing: new Set(["pending", "completed", "failed", "cancelled", "expired"]),
  failed: new Set(["failed"]),
  cancelled: new Set(["cancelled"]),
  expired: new Set(["expired", "completed"]),
  completed: new Set(["completed", "refunded", "chargeback", "dispute"]),
  dispute: new Set(["dispute", "completed", "refunded", "chargeback"]),
  refunded: new Set(["refunded"]),
  chargeback: new Set(["chargeback"]),
};

export function isAllowedTransactionTransition(current: string, next: string): boolean {
  if (current === next) return false;
  return ALLOWED_TRANSITIONS[current]?.has(next) ?? false;
}

export function normalizeRequiredAmount(raw: unknown, expectedAmount: number): number | null {
  const parsed = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (Number.isInteger(parsed) && parsed > expectedAmount * 10) return parsed / 100;
  return parsed;
}

export function amountMatches(raw: unknown, expectedAmount: number): boolean {
  const normalized = normalizeRequiredAmount(raw, expectedAmount);
  return normalized !== null && Math.abs(normalized - expectedAmount) <= 0.01;
}

export async function verifyHmacSha256(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const clean = signature.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(clean)) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const supplied = Uint8Array.from(clean.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
    return await crypto.subtle.verify("HMAC", key, supplied, encoder.encode(rawBody));
  } catch {
    return false;
  }
}