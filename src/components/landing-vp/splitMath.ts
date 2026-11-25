/**
 * Divisão de uma venda entre quem vende, o coprodutor e o afiliado.
 * Espelha `apply_transaction_splits` do banco: cada parte é calculada sobre o valor LÍQUIDO,
 * arredondada ao centavo, e a comissão do afiliado nunca passa do que sobra depois do coprodutor.
 */
export const CO_MAX = 99;
export const AFF_MAX = 90;

export interface SplitResult {
  /** Centavos que ficam com quem vende. */
  owner: number;
  /** Centavos do coprodutor. */
  partner: number;
  /** Centavos do afiliado, já limitados ao que sobra. */
  affiliate: number;
  /** A comissão pedida passou do que sobrava e foi reduzida. */
  capped: boolean;
}

const clampPct = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0);

export function computeSplit(netCents: number, coPct: number, affPct: number): SplitResult {
  const net = Number.isFinite(netCents) ? Math.max(0, Math.round(netCents)) : 0;
  const co = clampPct(coPct, CO_MAX);
  const aff = clampPct(affPct, AFF_MAX);
  const partner = Math.min(Math.round((net * co) / 100), net);
  const wanted = Math.round((net * aff) / 100);
  const room = Math.max(net - partner, 0);
  const affiliate = Math.min(wanted, room);
  return { owner: net - partner - affiliate, partner, affiliate, capped: wanted > room };
}

/** "R$ 1.234,56" a partir de centavos. */
export const brlFromCents = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
