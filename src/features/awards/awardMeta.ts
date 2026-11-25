/**
 * Regras puras das premiações: etapas do resgate, estado de cada peça, posição na trilha e a soma
 * paginada do faturamento. Fica fora dos componentes para ser testada sem tela.
 */
import type { AwardItem } from "./awards-data";

export interface RewardClaim {
  id: string;
  tier_id: string;
  tier_label: string | null;
  status: string;
  created_at: string;
  delivered_at?: string | null;
  recipient_name?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  tracking_code?: string | null;
  tracking_url?: string | null;
  tracking_carrier?: string | null;
  admin_notes?: string | null;
}

/** As quatro etapas que o time realmente usa no admin (pending, preparing, shipped, delivered). */
export const CLAIM_STEPS = [
  { id: "pending", label: "Em análise" },
  { id: "preparing", label: "Preparando" },
  { id: "shipped", label: "Postado" },
  { id: "delivered", label: "Entregue" },
] as const;

export const CLAIM_SELECT =
  "id, tier_id, tier_label, status, created_at, delivered_at, recipient_name, shipping_city, shipping_state, tracking_code, tracking_url, tracking_carrier, admin_notes";

export const isCancelled = (status: string) => status === "cancelled";

/** Índice da etapa atual. "approved" é o nome antigo de "preparing". Status desconhecido cai em análise. */
export function claimStepIndex(status: string): number {
  if (status === "approved") return 1;
  const i = CLAIM_STEPS.findIndex((s) => s.id === status);
  return i < 0 ? 0 : i;
}

/** Frase curta para quem acompanha o resgate. */
export function claimHeadline(claim: Pick<RewardClaim, "status" | "tracking_code">): string {
  if (isCancelled(claim.status)) return "Resgate cancelado";
  switch (claimStepIndex(claim.status)) {
    case 1: return "Sua peça está sendo preparada";
    case 2: return claim.tracking_code ? "Sua peça foi postada" : "Sua peça foi postada, o rastreio chega em breve";
    case 3: return "Peça entregue";
    default: return "Resgate em análise";
  }
}

export type PieceKind = "sealed" | "ready" | "active" | "delivered" | "cancelled";

export interface PieceState {
  kind: PieceKind;
  unlocked: boolean;
  /** Resgate mais recente desta peça, qualquer que seja o status. */
  claim: RewardClaim | null;
}

/**
 * Situação de uma peça. O banco barra um segundo resgate da mesma peça mesmo depois de cancelado
 * (`reward_already_claimed`), então "cancelled" não volta a ser "ready".
 */
export function pieceState(award: Pick<AwardItem, "id" | "value">, revenue: number, claims: RewardClaim[]): PieceState {
  const unlocked = revenue >= award.value;
  const mine = claims
    .filter((c) => c.tier_id === award.id)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const claim = mine.find((c) => !isCancelled(c.status)) ?? mine[0] ?? null;
  if (claim) {
    if (isCancelled(claim.status)) return { kind: "cancelled", unlocked, claim };
    return { kind: claim.status === "delivered" ? "delivered" : "active", unlocked, claim };
  }
  return { kind: unlocked ? "ready" : "sealed", unlocked, claim: null };
}

/**
 * Quanto da trilha está preenchido (0 a 1). A trilha tem um ponto inicial (R$ 0) e um ponto por peça,
 * todos com o mesmo espaçamento; dentro de cada trecho o avanço é proporcional ao faturamento.
 */
export function railFraction(values: number[], revenue: number): number {
  const n = values.length;
  if (n === 0 || revenue <= 0) return 0;
  const points = [0, ...values];
  for (let i = 1; i < points.length; i += 1) {
    if (revenue < points[i]) {
      const span = points[i] - points[i - 1];
      return (i - 1 + (span > 0 ? (revenue - points[i - 1]) / span : 0)) / n;
    }
  }
  return 1;
}

/** Primeira peça ainda não conquistada, ou null quando a jornada acabou. */
export function nextAward<T extends Pick<AwardItem, "value">>(awards: T[], revenue: number): T | null {
  return awards.find((a) => revenue < a.value) ?? null;
}

/** Percentual do trecho atual (do marco anterior até o próximo), de 0 a 100. */
export function segmentPercent(awards: Pick<AwardItem, "value">[], revenue: number): number {
  const next = nextAward(awards, revenue);
  if (!next) return 100;
  const prev = [...awards].reverse().find((a) => revenue >= a.value)?.value ?? 0;
  const span = next.value - prev;
  return span > 0 ? Math.min(Math.max(((revenue - prev) / span) * 100, 0), 100) : 0;
}

/* Faturamento: soma em centavos inteiros e paginada, porque a API devolve no máximo 1.000 linhas por pedido. */

export const REVENUE_PAGE = 1000;
export const REVENUE_MAX_PAGES = 200;

type Amount = number | string | null | undefined;
export interface RevenuePage { data: { net_amount: Amount }[] | null; error: unknown }

export const toCents = (value: Amount) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export async function sumPaged(
  loadPage: (from: number, to: number) => PromiseLike<RevenuePage>,
  pageSize = REVENUE_PAGE,
  maxPages = REVENUE_MAX_PAGES,
): Promise<{ total: number; capped: boolean }> {
  let cents = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) cents += toCents(row.net_amount);
    if (rows.length < pageSize) return { total: cents / 100, capped: false };
  }
  return { total: cents / 100, capped: true };
}

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

/** Valor em reais, ou pontinhos quando "Ocultar valores" está ligado. */
export const maskedBRL = (value: number, hidden: boolean) => (hidden ? "R$ ••••" : formatBRL(value));

export const formatBRL2 = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/** "R$ 10 mil", "R$ 1 milhão", "R$ 2,5 milhões": para frases, em vez do rótulo curto "R$ 10K". */
export function spokenBRL(value: number): string {
  const one = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `R$ ${one(m)} ${m >= 2 ? "milhões" : "milhão"}`;
  }
  if (value >= 1000) return `R$ ${one(value / 1000)} mil`;
  return formatBRL(value);
}
