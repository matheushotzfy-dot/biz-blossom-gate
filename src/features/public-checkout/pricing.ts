import type { AppliedCoupon } from "./types";

/**
 * Preço do pedido, em reais com duas casas. É a ÚNICA conta do checkout:
 * o resumo, o botão, o builder do vendedor e a prévia das parcelas leem daqui.
 * O servidor continua sendo quem decide o valor cobrado; esta conta só mostra o que ele vai calcular.
 */
export const INSTALLMENT_MAX = 12;
/** 1,99% sobre cada parcela além da primeira (regra que o checkout já usava). Não é uma taxa lida da plataforma. */
export const INSTALLMENT_RATE = 0.0199;
/** O menor valor que o checkout cobra (mesmo piso do validate_coupon: nunca R$ 0,00). */
export const MIN_CHARGE = 0.01;

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

export function formatBRL(value: number): string {
  return finite(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Desconto do cupom. Espelha app_private.validate_coupon: base, arredondamento e piso de R$ 0,01 restante. */
export function couponDiscount(
  coupon: Pick<AppliedCoupon, "discountType" | "discountValue" | "applyToBumps"> | null,
  price: number,
  bumpsTotal: number,
): number {
  if (!coupon) return 0;
  const base = coupon.applyToBumps ? price + bumpsTotal : price;
  if (base <= 0) return 0;
  const raw = coupon.discountType === "percentage" ? roundMoney((base * coupon.discountValue) / 100) : coupon.discountValue;
  return Math.max(Math.min(finite(raw), base - MIN_CHARGE), 0);
}

export interface OrderTotals {
  price: number;
  bumpsTotal: number;
  subtotal: number;
  discount: number;
  total: number;
}

export function orderTotals(price: number, bumpPrices: number[], coupon: AppliedCoupon | null): OrderTotals {
  const bumpsTotal = roundMoney(bumpPrices.reduce((sum, value) => sum + finite(value), 0));
  const subtotal = roundMoney(price + bumpsTotal);
  const discount = roundMoney(couponDiscount(coupon, price, bumpsTotal));
  return { price, bumpsTotal, subtotal, discount, total: Math.max(roundMoney(subtotal - discount), MIN_CHARGE) };
}

export interface InstallmentOption {
  count: number;
  perInstallment: number;
  /** O que o comprador paga no total (com juros, quando há). */
  total: number;
  withInterest: boolean;
}

export function installmentOption(total: number, count: number): InstallmentOption {
  if (count <= 1) return { count: 1, perInstallment: total, total, withInterest: false };
  const perInstallment = roundMoney((total * (1 + INSTALLMENT_RATE * (count - 1))) / count);
  return { count, perInstallment, total: roundMoney(perInstallment * count), withInterest: true };
}

export function installmentOptions(total: number, max = INSTALLMENT_MAX): InstallmentOption[] {
  return Array.from({ length: max }, (_, index) => installmentOption(total, index + 1));
}
