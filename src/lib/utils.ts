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
