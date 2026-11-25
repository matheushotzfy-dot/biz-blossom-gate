export type DeliveryStatus = "pending" | "failed" | "delivered" | "revoked";
export type DeliveryFilter = "all" | DeliveryStatus;

export interface Delivery {
  id: string;
  transaction_id: string;
  product_id: string | null;
  seller_user_id: string;
  buyer_user_id: string | null;
  customer_email: string;
  status: DeliveryStatus;
  attempt_count: number;
  last_error: string | null;
  delivered_at: string | null;
  last_attempt_at: string | null;
  created_at: string;
  product_name: string | null;
  seller_name: string | null;
  seller_email: string | null;
  tx_amount: number | null;
  tx_status: string | null;
}
export interface DeliverySummary { total: number; pending: number; failed: number; delivered: number; revoked: number; oldest_open: string | null }
export interface DeliveriesPage { items: Delivery[]; total: number; summary: DeliverySummary }

export const PAGE_SIZE = 50;
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const PAID = new Set(["approved", "paid", "completed"]);

export function parseDeliveriesPage(raw: unknown): DeliveriesPage {
  const r = raw as { items?: unknown; total?: unknown; summary?: Record<string, unknown> } | null;
  if (!r || !Array.isArray(r.items)) throw new Error("Resposta inesperada do servidor.");
  const s = r.summary ?? {};
  return {
    items: (r.items as Delivery[]).map((d) => ({ ...d, attempt_count: num(d.attempt_count), tx_amount: d.tx_amount == null ? null : num(d.tx_amount) })),
    total: num(r.total),
    summary: { total: num(s.total), pending: num(s.pending), failed: num(s.failed), delivered: num(s.delivered), revoked: num(s.revoked), oldest_open: typeof s.oldest_open === "string" ? s.oldest_open : null },
  };
}

export const STATUS_LABEL: Record<DeliveryStatus, string> = { pending: "Aguardando", failed: "Falhou", delivered: "Entregue", revoked: "Revogada" };
export const STATUS_TONE: Record<DeliveryStatus, "warning" | "destructive" | "success" | "muted"> = { pending: "warning", failed: "destructive", delivered: "success", revoked: "muted" };
export const statusLabel = (s: string) => STATUS_LABEL[s as DeliveryStatus] ?? "Desconhecido";
export const statusTone = (s: string) => STATUS_TONE[s as DeliveryStatus] ?? "muted";

export const isPaid = (txStatus: string | null) => !!txStatus && PAID.has(txStatus);

/** Só dá para reprocessar o que está em aberto e cujo pagamento continua confirmado. */
export function canRetry(d: Pick<Delivery, "status" | "tx_status">): boolean {
  return (d.status === "pending" || d.status === "failed") && isPaid(d.tx_status);
}

/** Explica em português o que aconteceu e o que fazer. O texto técnico do banco só aparece quando não conhecemos o caso. */
export function explain(d: Pick<Delivery, "status" | "last_error" | "tx_status">): string {
  if (d.status === "delivered") return "Acesso liberado ao comprador.";
  if (d.status === "revoked") return "Acesso retirado. Não dá para reprocessar daqui.";
  if (!isPaid(d.tx_status)) return "O pagamento não está confirmado, então não há o que entregar.";
  const err = (d.last_error ?? "").toLowerCase();
  if (err.includes("aguardando conta")) return "O comprador ainda não tem conta com o e-mail confirmado. Quando ele confirmar, reprocesse para liberar o acesso.";
  if (err.includes("sem curso")) return "O produto não tem curso vinculado. O vendedor precisa vincular um curso; depois reprocesse.";
  return d.last_error?.trim() || (d.status === "failed" ? "A liberação falhou sem detalhe registrado." : "Aguardando a primeira tentativa.");
}

export interface RetryResult { status: string; reason?: string }
export function retryOutcome(raw: unknown, email: string): { kind: "success" | "warning"; message: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as RetryResult;
  if (r.status === "delivered") return { kind: "success", message: `Acesso liberado para ${email}.` };
  if (r.status === "pending") return { kind: "warning", message: "Continua aguardando: o comprador ainda não tem conta com o e-mail confirmado." };
  if (r.status === "failed") return { kind: "warning", message: r.reason === "course_not_linked" ? "Não foi possível liberar: o produto não tem curso vinculado." : "Não foi possível liberar o acesso." };
  return { kind: "warning", message: "O servidor respondeu algo inesperado. Atualize a lista para ver como ficou." };
}
