/**
 * Calculate a fee amount from a percentage + fixed component, rounded to cents.
 * Amount, percent and fixed are all expressed in reais (not cents).
 */
export function calcFee(amount: number, percent: number, fixed: number): number {
  const raw = amount * (percent / 100) + fixed;
  return Math.round(raw * 100) / 100;
}
