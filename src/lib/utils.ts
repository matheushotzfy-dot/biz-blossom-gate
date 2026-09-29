import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format numeric value as Brazilian Real currency.
 * Centralizes locale + currency to avoid hardcoded "BRL" / "R$" spread across the codebase.
 */
export function formatCurrency(
  value: number | null | undefined,
  options: { locale?: string; currency?: string; fractionDigits?: number } = {}
): string {
  const { locale = "pt-BR", currency = "BRL", fractionDigits = 2 } = options;
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function isApprovedTransaction(status: string | null | undefined): boolean {
  return status === "completed" || status === "approved" || status === "paid";
}

type TransactionStatusInput = {
  status?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  pix_expires_at?: string | null;
};

export function deriveTransactionStatus(transaction: TransactionStatusInput): string {
  const raw = String(transaction.status || "").trim().toLowerCase();
  const method = String(transaction.payment_method || "").trim().toLowerCase();
  const isPix = method === "pix";
  const isCard = method === "credit_card" || method === "card";

  const createdAt = transaction.created_at ? new Date(transaction.created_at).getTime() : NaN;
  const ageHours = Number.isFinite(createdAt) ? (Date.now() - createdAt) / 3_600_000 : 0;
  const pixExpiresAt = transaction.pix_expires_at ? new Date(transaction.pix_expires_at).getTime() : NaN;
  const isExpiredByTime = ageHours >= 24 || (Number.isFinite(pixExpiresAt) && pixExpiresAt < Date.now());

  if (raw === "approved" || raw === "completed" || raw === "paid") return "approved";
  if (raw === "refunded" || raw === "partially_refunded") return "refunded";
  if (raw === "expired") return "expired";

  if (raw === "pending" || raw === "processing" || raw === "waiting_payment" || raw === "authorized") {
    return isExpiredByTime ? "expired" : "pending";
  }

  // Final outcome of a dispute decided in favor of the buyer. A PIX sale here is a lost MED,
  // never an "expired" sale — the money was paid and then removed.
  if (raw === "chargeback" || raw === "chargedback" || raw === "charged_back") {
    if (isPix) return "med_lost";
    return "chargeback";
  }

  if (raw === "med" || raw === "mediation" || raw === "dispute" || raw === "disputed" || raw === "in_protest") {
    if (isPix) return "med";
    if (isCard) return "chargeback";
    return "error";
  }

  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  if (raw === "failed" || raw === "error" || raw === "rejected" || raw === "refused") return "error";
  return raw || "pending";
}

type TransactionConversionInput = {
  status?: string | null;
  payment_method?: string | null;
};

type ConversionBucket<T extends TransactionConversionInput> = {
  total: number;
  approved: number;
  rate: number;
  transactions: T[];
  approvedTransactions: T[];
};

const normalizePaymentMethod = (method: string | null | undefined) =>
  String(method || "").trim().toLowerCase();

const buildConversionBucket = <T extends TransactionConversionInput>(transactions: T[]): ConversionBucket<T> => {
  const approvedTransactions = transactions.filter((transaction) => isApprovedTransaction(transaction.status));

  return {
    total: transactions.length,
    approved: approvedTransactions.length,
    rate: transactions.length > 0 ? (approvedTransactions.length / transactions.length) * 100 : 0,
    transactions,
    approvedTransactions,
  };
};

export function calculateTransactionConversions<T extends TransactionConversionInput>(transactions: T[]) {
  const byMethod = (methods: string[]) => {
    const allowed = new Set(methods);
    return buildConversionBucket(
      transactions.filter((transaction) => allowed.has(normalizePaymentMethod(transaction.payment_method)))
    );
  };

  return {
    overall: buildConversionBucket(transactions),
    pix: byMethod(["pix"]),
    card: byMethod(["credit_card", "card"]),
    boleto: byMethod(["boleto"]),
  };
}
