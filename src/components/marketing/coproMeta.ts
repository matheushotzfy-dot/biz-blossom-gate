import type { TxTone } from "@/components/seller-ui/txMeta";

export interface CoProduction {
  id: string; product_id: string; owner_user_id: string; co_producer_user_id: string | null;
  co_producer_email: string; split_percentage: number; status: string;
  accepted_at: string | null; created_at: string; updated_at: string;
}

export const SPLIT_MIN = 1;
export const SPLIT_MAX = 99;
export const SPLIT_DEFAULT = 50;

export type CoDirection = "sent" | "received";
export type CoState = "active" | "unlinked" | "pending" | "rejected";

export const STATE_META: Record<CoState, { label: string; tone: TxTone }> = {
  active: { label: "Ativa", tone: "ok" },
  // Aceita, mas o servidor ainda não vinculou a conta do parceiro: a divisão só roda com o vínculo.
  unlinked: { label: "Aceita, falta vincular", tone: "wait" },
  pending: { label: "Aguardando resposta", tone: "wait" },
  rejected: { label: "Recusada", tone: "idle" },
};

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const cleanEmail = (v: string) => v.trim().toLowerCase();

export function directionOf(cp: CoProduction, userId: string): CoDirection {
  return cp.owner_user_id === userId ? "sent" : "received";
}

export function coState(cp: CoProduction): CoState {
  if (cp.status === "accepted") return cp.co_producer_user_id ? "active" : "unlinked";
  if (cp.status === "rejected") return "rejected";
  return "pending";
}

/** Convite que ainda ocupa o produto (impede um segundo convite). */
export const holdsProduct = (cp: CoProduction) => cp.status === "pending" || cp.status === "accepted";

/** O parceiro recebe uma parte do valor líquido da venda, como em apply_transaction_splits. */
export const partnerShare = (net: number, pct: number) => Math.round(net * pct) / 100;

/** Parte de quem olha: o dono fica com o que sobra, o parceiro com a porcentagem combinada. */
export const yourPct = (cp: CoProduction, dir: CoDirection) => (dir === "sent" ? 100 - Number(cp.split_percentage) : Number(cp.split_percentage));

export const partnerCode = (userId: string) => userId.replace(/-/g, "").slice(0, 4).toUpperCase();

export function coErrorMessage(err: { message?: string } | null | undefined, fallback: string): string {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("jwt") || m.includes("401")) return "Sua sessão expirou. Entre de novo para continuar.";
  if (m.includes("permission") || m.includes("row-level")) return "Você não tem permissão para esta ação.";
  if (m.includes("duplicate") || m.includes("unique")) return "Este produto já tem uma coprodução em andamento.";
  return fallback;
}

export function parseSplit(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= SPLIT_MIN && n <= SPLIT_MAX ? n : null;
}
