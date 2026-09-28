// Single source for fee math used by all payment functions (values in reais).
// Rounds to cents exactly like the previous inline formulas.
export function computeFee(amount: number, percent: number, fixed: number): number {
  return Math.round(((amount * percent) / 100 + fixed) * 100) / 100;
}

export function computeNet(amount: number, fee: number): number {
  return Math.round((amount - fee) * 100) / 100;
}
