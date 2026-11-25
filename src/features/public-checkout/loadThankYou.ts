import { supabase } from "@/integrations/supabase/client";
import { outcomeFromStatus } from "./status";

export type PurchaseOutcome = "approved" | "pending" | "failed" | "expired" | "refunded";

/** Reembolso e chargeback não são "pendente": a compra existiu e foi desfeita. */
export function purchaseOutcome(status: unknown): PurchaseOutcome {
  if (status === "refunded" || status === "partially_refunded" || status === "chargeback") return "refunded";
  return outcomeFromStatus(status);
}

export type PurchaseSummary = {
  outcome: PurchaseOutcome;
  productName: string;
  amount: number;
  method: string | null;
  email: string | null;
  firstName: string | null;
};

export type ThankYouLoad = { kind: "missing" } | { kind: "found"; summary: PurchaseSummary };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTransactionId(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  return UUID_RE.test(value) ? value : null;
}

const METHOD_LABEL: Record<string, string> = { pix: "Pix", credit_card: "Cartão de crédito", boleto: "Boleto" };
export const methodLabel = (method: string | null): string | null => (method ? (METHOD_LABEL[method] ?? null) : null);

const clean = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * O resumo vem de get_thank_you_summary: só dados mínimos e mascarados. Erro de rede vira exceção
 * (tela de "tentar de novo"); compra que não existe (ou passou de 7 dias) é um resultado normal.
 */
export async function loadThankYou(transactionId: string): Promise<ThankYouLoad> {
  const { data, error } = await supabase.rpc("get_thank_you_summary", { _tx_id: transactionId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) return { kind: "missing" };

  let productName = "Seu pedido";
  const productId = clean(row.product_id);
  if (productId) {
    // O nome é só enfeite: se falhar, a confirmação continua valendo.
    const { data: product } = await supabase.from("products_public").select("name").eq("id", productId).maybeSingle();
    const name = clean((product as { name?: unknown } | null)?.name);
    if (name) productName = name;
  }
  const amount = Number(row.amount);
  return {
    kind: "found",
    summary: {
      outcome: purchaseOutcome(row.status),
      productName,
      amount: Number.isFinite(amount) ? amount : 0,
      method: clean(row.payment_method),
      email: clean(row.customer_email_masked),
      firstName: clean(row.customer_first_name),
    },
  };
}
