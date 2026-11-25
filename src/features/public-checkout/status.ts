import type { CheckoutMethod } from "./types";

export type CheckoutOutcome = "pending" | "approved" | "failed" | "expired";

/** Traduz o status devolvido por get_checkout_status. Qualquer coisa desconhecida segue "pendente" (nunca aprova por engano). */
export function outcomeFromStatus(status: unknown): CheckoutOutcome {
  switch (status) {
    case "completed":
    case "approved":
    case "paid":
      return "approved";
    case "expired":
      return "expired";
    case "failed":
    case "cancelled":
    case "canceled":
    case "refused":
    case "declined":
      return "failed";
    default:
      return "pending";
  }
}

/** Só https vai para o navegador do comprador (nada de javascript:, data: ou http). */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface PaymentDisplay {
  pixCode: string | null;
  boletoUrl: string | null;
  boletoCode: string | null;
  expiresAt: number | null;
}

const text = (value: unknown, max = 2000): string | null => (typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null);

/** O adquirente devolve nomes diferentes para a mesma coisa; aceitamos os conhecidos e ignoramos o resto. */
export function parsePaymentPayload(method: CheckoutMethod, payload: unknown): PaymentDisplay {
  const data = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const expires = typeof data.expiresAt === "string" || typeof data.expires_at === "string" ? Date.parse(String(data.expiresAt ?? data.expires_at)) : NaN;
  return {
    pixCode: method === "pix" ? text(data.qrCodeText) ?? text(data.qrcode) ?? text(data.copyPaste) ?? text(data.pix_copia_e_cola) ?? text(data.emv) ?? text(data.qrCode) : null,
    boletoUrl: method === "boleto" ? safeHttpsUrl(data.url ?? data.boletoUrl ?? data.boleto_url) : null,
    boletoCode: method === "boleto" ? text(data.barCode, 120) ?? text(data.barcode, 120) ?? text(data.digitableLine, 120) : null,
    expiresAt: Number.isFinite(expires) ? expires : null,
  };
}
