import type { Tables } from "@/integrations/supabase/types";

/** Aprovar/pagar saque ainda não existe: sem adquirente nada é pago (a plataforma falha fechada). */
export const PAYOUTS_AVAILABLE = false;

export const NEW_SELLER_DAYS = 30;
/** A partir daqui o saque é marcado como "valor alto" (filtro e selo de risco). */
export const HIGH_VALUE = 50_000;
/** A partir daqui o valor aparece em destaque na fila. */
export const REVIEW_VALUE = 10_000;
export const MAX_ADJUSTMENT = 1_000_000;
const DAY_MS = 86_400_000;

export type WithdrawalStatus = "pending" | "approved" | "rejected";
export const STATUS_LABEL: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado" };

/** Conta sem perfil carregado conta como nova: não dá para provar que é antiga. */
export function isNewSeller(createdAt: string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return true;
  return (now - t) / DAY_MS < NEW_SELLER_DAYS;
}
export const isHighValue = (amount: number): boolean => Number(amount) >= HIGH_VALUE;

export function withdrawalFlags(amount: number, sellerCreatedAt: string | null | undefined, now = Date.now()): string[] {
  const flags: string[] = [];
  if (!sellerCreatedAt) flags.push("Perfil não carregado");
  else if (isNewSeller(sellerCreatedAt, now)) flags.push("Seller novo");
  if (isHighValue(amount)) flags.push("Valor alto");
  return flags;
}

export interface WithdrawalTotals { pendingCount: number; pendingAmount: number; paidCount: number; paidAmount: number; rejectedCount: number; fees: number; flagged: number }

/** Totais da fila. "Taxas" = só saques pagos (a taxa de um saque recusado volta ao seller). */
export function summarizeWithdrawals(rows: Pick<Tables<"withdrawals">, "status" | "amount" | "fee_amount" | "user_id">[], createdAtOf: (userId: string) => string | undefined, now = Date.now()): WithdrawalTotals {
  const t: WithdrawalTotals = { pendingCount: 0, pendingAmount: 0, paidCount: 0, paidAmount: 0, rejectedCount: 0, fees: 0, flagged: 0 };
  for (const w of rows) {
    const amount = Number(w.amount) || 0;
    if (w.status === "pending") {
      t.pendingCount += 1; t.pendingAmount += amount;
      if (withdrawalFlags(amount, createdAtOf(w.user_id), now).length > 0) t.flagged += 1;
    } else if (w.status === "approved") {
      t.paidCount += 1; t.paidAmount += amount; t.fees += Number(w.fee_amount) || 0;
    } else if (w.status === "rejected") {
      t.rejectedCount += 1;
    }
  }
  return t;
}

export interface Adjustment { id: string; user_id: string; amount: number; type: string; reason: string; admin_user_id: string; created_at: string }
export interface StatementEntry { key: string; date: string; label: string; description: string; amount: number; /** true = dinheiro entra na plataforma */ inflow: boolean }

/**
 * Extrato visto da plataforma: sai o que ela paga aos sellers (saques pagos e créditos de ajuste);
 * entra o que ela recebe (taxa de saque e débitos de ajuste). Só considera o que foi carregado na tela.
 */
export function buildStatement(
  withdrawals: Pick<Tables<"withdrawals">, "id" | "status" | "user_id" | "net_amount" | "fee_amount" | "processed_at" | "created_at">[],
  adjustments: Adjustment[],
  nameOf: (userId: string) => string,
  limit = 100,
): StatementEntry[] {
  const out: StatementEntry[] = [];
  for (const w of withdrawals) {
    if (w.status !== "approved") continue;
    const date = w.processed_at || w.created_at;
    out.push({ key: `w-${w.id}`, date, label: "Saque aprovado", description: `Saque de ${nameOf(w.user_id)}`, amount: Number(w.net_amount) || 0, inflow: false });
    if (Number(w.fee_amount) > 0) out.push({ key: `f-${w.id}`, date, label: "Taxa de saque", description: `Taxa cobrada de ${nameOf(w.user_id)}`, amount: Number(w.fee_amount), inflow: true });
  }
  for (const a of adjustments) {
    const credit = a.type === "credit";
    out.push({ key: `a-${a.id}`, date: a.created_at, label: credit ? "Ajuste de crédito" : "Ajuste de débito", description: `${a.reason} · ${nameOf(a.user_id)}`, amount: Number(a.amount) || 0, inflow: !credit });
  }
  return out.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime()).slice(0, limit);
}

/** Valor digitado como "1.234,56" ou "1234.56" → número; null se não der para entender. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!s) return null;
  const normalized = /,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function validateAdjustment(input: { userId: string; amount: string; reason: string }): string | null {
  if (!input.userId) return "Escolha o seller.";
  const amount = parseAmount(input.amount);
  if (amount === null) return "Informe o valor em reais, por exemplo 150,00.";
  if (amount <= 0) return "O valor precisa ser maior que zero.";
  if (amount > MAX_ADJUSTMENT) return "O valor máximo por ajuste é R$ 1.000.000,00.";
  if (input.reason.trim().length < 5) return "Explique o motivo em pelo menos 5 caracteres.";
  return null;
}

export function validateAutoLimit(input: string): string | null {
  const amount = parseAmount(input);
  if (amount === null || amount <= 0) return "Informe um limite em reais maior que zero.";
  if (amount > MAX_ADJUSTMENT) return "O limite máximo é R$ 1.000.000,00.";
  return null;
}

const BR_TZ = "America/Sao_Paulo";
/** Data e hora no fuso de Brasília, independente do fuso do navegador. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { timeZone: BR_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(", ", " às ");
}

/** Há quanto tempo o saque espera: "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function waitingLabel(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.max(0, Math.floor((now - t) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Fila: pendentes do mais antigo para o mais novo (quem espera há mais tempo sai primeiro); o resto, do mais novo. */
export function sortQueue<T extends { created_at: string }>(rows: T[], oldestFirst: boolean): T[] {
  const dir = oldestFirst ? 1 : -1;
  return [...rows].sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
}

export interface RejectOutcome { done: string[]; skipped: string[]; failed: { id: string; message: string }[] }
