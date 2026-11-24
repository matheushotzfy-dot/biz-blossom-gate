/** Filtros de status da lista de vendas, resolvidos no servidor (a página nunca filtra só o que já carregou). */
export type SalesStatusKey = "all" | "paid" | "pending" | "expired" | "refunded" | "disputed";

export interface SalesStatusClause {
  /** Valores aceitos em `transactions.status`. */
  statusIn?: string[];
  /** Só vendas criadas depois deste instante (ISO). */
  createdAfter?: string;
  /** Expressão extra para `.or(...)` do PostgREST. */
  or?: string;
}

const PENDING_RAW = ["pending", "processing", "waiting_payment", "authorized"];
const DAY_MS = 24 * 3_600_000;

/**
 * Espelha `deriveTransactionStatus`: uma venda pendente vira "expirada" quando tem 24h ou mais,
 * ou quando o Pix passou do prazo. Por isso "Pendentes" e "Expiradas" são complementares.
 */
export function salesStatusClause(key: SalesStatusKey, now: Date = new Date()): SalesStatusClause {
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - DAY_MS).toISOString();
  const pending = PENDING_RAW.join(",");
  switch (key) {
    case "paid": return { statusIn: ["approved", "completed", "paid"] };
    case "refunded": return { statusIn: ["refunded", "partially_refunded"] };
    case "disputed": return { statusIn: ["chargeback", "chargedback", "charged_back", "med", "mediation", "dispute", "disputed", "in_protest"] };
    case "pending": return { statusIn: PENDING_RAW, createdAfter: cutoff, or: `pix_expires_at.is.null,pix_expires_at.gt.${nowIso}` };
    case "expired": return { or: `status.eq.expired,and(status.in.(${pending}),created_at.lte.${cutoff}),and(status.in.(${pending}),pix_expires_at.lt.${nowIso})` };
    default: return {};
  }
}
