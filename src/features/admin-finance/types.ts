/** Shapes returned by the admin finance RPCs (get_seller_360 / get_seller_balance_breakdown). */
export interface BalanceBreakdown {
  available: number;
  negative: number;
  ledger: number;
  held_disputes: number;
  retained: number;
  pending_withdrawals: number;
}

export interface Seller360 {
  sales: {
    approved_count: number; approved_amount: number; net_amount: number; fees_amount: number;
    refunded_count: number; refunded_amount: number; chargeback_count: number; total_count: number;
    last_30d_amount: number; last_sale_at: string | null;
  };
  withdrawals: { paid: number; pending: number; rejected_count: number; count: number };
  disputes: { open: number; won: number; lost: number; total: number };
  balance: BalanceBreakdown;
  account_age_days: number;
  chargeback_rate: number;
  refund_rate: number;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
}

export type DisputeType = "medpix" | "pre_med_pix" | "refund" | "chargeback";

export const DISPUTE_TYPE_LABEL: Record<DisputeType, string> = {
  medpix: "MED Pix",
  pre_med_pix: "Pré-MED",
  refund: "Reembolso",
  chargeback: "Chargeback",
};

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  in_review: "Em análise",
  resolved_seller: "Ganha pelo seller",
  resolved_buyer: "Perdida",
  closed: "Encerrada",
};

export const brl = (v: number | string | null | undefined): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

/** Converts Postgres exceptions into short, user-safe messages. */
export function rpcErrorMessage(e: unknown): string {
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  if (!msg) return "Não foi possível concluir a ação";
  if (msg.includes("not authorized")) return "Sem permissão para esta ação";
  return msg.slice(0, 160);
}
