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
  return status === "completed" || status === "approved";
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
