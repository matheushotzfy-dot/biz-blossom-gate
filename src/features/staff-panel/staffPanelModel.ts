/**
 * Regras puras do painel da equipe (gerentes e funcionários): leitura do JSON das RPCs, rótulos, validações de
 * taxa e de pedido de pagamento e tradução dos erros do servidor. Campo ausente vira valor neutro.
 */
import { staffActionFlags, type StaffActionFlags } from "@/features/staff/staffActions";
import { parseAmount, parsePercent } from "@/features/admin-withdrawals/withdrawalsModel";

export type StaffRole = "manager" | "employee";
export type SectionId = "carteira" | "sellers" | "vendas" | "suporte" | "comissao" | "pedidos";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/* ───────── carteira ───────── */

export interface FeeLimits { pct: number; fixed: number; withdrawal: number }
export interface PortfolioSeller { id: string; name: string; email: string | null; status: string; since: string | null; sales: number; volume: number; net: number }
export interface KycQueueItem { id: string; name: string; email: string | null; submittedAt: string | null }
export interface PortfolioMetrics {
  sellers: number; kycPending: number; sales: number; volume: number; ticket: number; refunds: number; chargebacks: number; med: number;
  commissionGenerated: number; commissionReversed: number; commissionBalance: number;
}
export interface Portfolio {
  role: StaffRole; metrics: PortfolioMetrics; commissionPct: number | null; feeLimits: FeeLimits | null;
  permissions: string[]; flags: StaffActionFlags; kycQueue: KycQueueItem[]; sellers: PortfolioSeller[]; total: number; page: number; pageSize: number;
}

export function parsePortfolio(raw: unknown): Portfolio {
  const o = isObj(raw) ? raw : {};
  const m = isObj(o.metrics) ? o.metrics : {};
  const lim = isObj(o.fee_limits) ? o.fee_limits : null;
  const permissions = Array.isArray(o.permissions) ? o.permissions.filter((p): p is string => typeof p === "string") : [];
  return {
    role: o.role === "manager" ? "manager" : "employee",
    metrics: {
      sellers: num(m.seller_count), kycPending: num(m.kyc_pending), sales: num(m.sales_count), volume: num(m.volume), ticket: num(m.ticket_average),
      refunds: num(m.refunds), chargebacks: num(m.chargebacks), med: num(m.medpix),
      commissionGenerated: num(m.commission_generated), commissionReversed: num(m.commission_reversed), commissionBalance: num(m.commission_balance),
    },
    commissionPct: numOrNull(o.commission_pct),
    feeLimits: lim ? { pct: num(lim.min_transaction_percentage), fixed: num(lim.min_transaction_fixed), withdrawal: num(lim.min_withdrawal_fee) } : null,
    permissions,
    flags: staffActionFlags(permissions),
    kycQueue: (Array.isArray(o.kyc_queue) ? o.kyc_queue : []).flatMap((k) => {
      if (!isObj(k) || !str(k.user_id)) return [];
      return [{ id: String(k.user_id), name: str(k.full_name) ?? str(k.email) ?? "Sem nome", email: str(k.email), submittedAt: str(k.submitted_at) }];
    }),
    sellers: (Array.isArray(o.sellers) ? o.sellers : []).flatMap((s) => {
      if (!isObj(s) || !str(s.seller_user_id)) return [];
      return [{
        id: String(s.seller_user_id), name: str(s.full_name) ?? str(s.email) ?? "Sem nome", email: str(s.email), status: str(s.account_status) ?? "pending",
        since: str(s.started_at), sales: num(s.sales_count), volume: num(s.volume), net: num(s.net_volume),
      }];
    }),
    total: num(o.total_sellers),
    page: Math.max(1, num(o.page) || 1),
    pageSize: num(o.page_size) || 25,
  };
}

/* ───────── ficha do seller ───────── */

export interface SellerFees { pct: number | null; fixed: number | null; withdrawal: number | null; updatedAt: string | null; byMe: boolean }
export interface WithdrawalBlock { active: boolean; reason: string | null; updatedAt: string | null; byMe: boolean }
export interface MiniWithdrawal { id: string; amount: number; status: string; createdAt: string | null }
export interface MiniDispute { id: string; type: string; status: string; amount: number; createdAt: string | null; deadline: string | null }
export interface SellerNote { id: string; content: string; createdAt: string | null; mine: boolean; author: string }
export interface SellerDetail {
  seller: { id: string; name: string; email: string | null; phone: string | null; documentType: "cpf" | "cnpj"; documentMasked: string | null; status: string; rejectionReason: string | null; createdAt: string | null; lastLoginAt: string | null; balanceFrozen: boolean };
  assignedAt: string | null;
  stats: { sales: number; volume: number; net: number; attempts: number; lastSaleAt: string | null };
  fees: SellerFees | null; withdrawalBlock: WithdrawalBlock | null; withdrawals: MiniWithdrawal[] | null; disputes: MiniDispute[] | null; notes: SellerNote[] | null;
}

const list = <T,>(v: unknown, f: (o: Record<string, unknown>) => T | null): T[] | null =>
  Array.isArray(v) ? v.flatMap((x) => { if (!isObj(x)) return []; const r = f(x); return r ? [r] : []; }) : null;

export function parseSellerDetail(raw: unknown): SellerDetail {
  const o = isObj(raw) ? raw : {};
  const s = isObj(o.seller) ? o.seller : {};
  const st = isObj(o.stats) ? o.stats : {};
  const f = isObj(o.fees) ? o.fees : null;
  const b = isObj(o.withdrawal_block) ? o.withdrawal_block : null;
  return {
    seller: {
      id: str(s.user_id) ?? "", name: str(s.full_name) ?? str(s.email) ?? "Sem nome", email: str(s.email), phone: str(s.phone),
      documentType: s.document_type === "cnpj" ? "cnpj" : "cpf", documentMasked: str(s.document_masked),
      status: str(s.account_status) ?? "pending", rejectionReason: str(s.kyc_rejection_reason), createdAt: str(s.created_at), lastLoginAt: str(s.last_login_at),
      balanceFrozen: s.balance_frozen === true,
    },
    assignedAt: str(o.assigned_at),
    stats: { sales: num(st.sales_count), volume: num(st.volume), net: num(st.net_volume), attempts: num(st.attempts), lastSaleAt: str(st.last_sale_at) },
    fees: f ? { pct: numOrNull(f.transaction_percentage), fixed: numOrNull(f.transaction_fixed), withdrawal: numOrNull(f.withdrawal_fee), updatedAt: str(f.updated_at), byMe: f.by_me === true } : null,
    withdrawalBlock: b ? { active: b.active === true, reason: str(b.reason), updatedAt: str(b.updated_at), byMe: b.by_me === true } : null,
    withdrawals: list(o.withdrawals, (w) => (str(w.id) ? { id: String(w.id), amount: num(w.amount), status: str(w.status) ?? "pending", createdAt: str(w.created_at) } : null)),
    disputes: list(o.disputes, (d) => (str(d.id) ? { id: String(d.id), type: str(d.type) ?? "", status: str(d.status) ?? "open", amount: num(d.amount), createdAt: str(d.created_at), deadline: str(d.response_deadline) } : null)),
    notes: list(o.notes, (n) => (str(n.id) ? { id: String(n.id), content: String(n.content ?? ""), createdAt: str(n.created_at), mine: n.mine === true, author: str(n.author) ?? "Equipe" } : null)),
  };
}

/* ───────── vendas ───────── */

export interface StaffTx { id: string; amount: number; net: number; status: string; method: string | null; customer: string | null; createdAt: string; seller: string }
export interface StaffTxPage { rows: StaffTx[]; total: number; page: number; pageSize: number }

export function parseTxPage(raw: unknown): StaffTxPage {
  const o = isObj(raw) ? raw : {};
  return {
    rows: (Array.isArray(o.rows) ? o.rows : []).flatMap((t) => {
      if (!isObj(t) || !str(t.id)) return [];
      return [{ id: String(t.id), amount: num(t.amount), net: num(t.net_amount), status: str(t.status) ?? "pending", method: str(t.payment_method),
        customer: str(t.customer_name), createdAt: str(t.created_at) ?? "", seller: str(t.seller_name) ?? str(t.seller_email) ?? "Seller" }];
    }),
    total: num(o.total), page: Math.max(1, num(o.page) || 1), pageSize: num(o.page_size) || 25,
  };
}

/* ───────── rótulos ───────── */

export const ROLE_LABEL: Record<StaffRole, string> = { manager: "Gerente", employee: "Funcionário" };

export const WITHDRAWAL_STATUS: Record<string, { label: string; tone: "success" | "warning" | "destructive" | "neutral" }> = {
  pending: { label: "Em análise", tone: "warning" },
  approved: { label: "Pago", tone: "success" },
  completed: { label: "Pago", tone: "success" },
  paid: { label: "Pago", tone: "success" },
  rejected: { label: "Recusado", tone: "destructive" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export const DISPUTE_TYPE: Record<string, string> = { medpix: "MED Pix", pre_med_pix: "Pré-MED", chargeback: "Chargeback", refund: "Reembolso" };
export function disputeStatus(s: string): { label: string; tone: "success" | "warning" | "destructive" | "neutral" } {
  if (s === "open") return { label: "Aberta", tone: "warning" };
  if (s === "in_review") return { label: "Em análise", tone: "warning" };
  if (s === "resolved_seller" || s === "won") return { label: "A favor do seller", tone: "success" };
  if (s === "resolved_buyer" || s === "lost") return { label: "Contra o seller", tone: "destructive" };
  return { label: "Encerrada", tone: "neutral" };
}

/* ───────── taxas ───────── */

export interface FeeForm { pct: string; fixed: string; withdrawal: string }
export interface FeeCheck { values: { pct: number; fixed: number; withdrawal: number } | null; errors: Partial<Record<keyof FeeForm, string>> }

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctText = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Valida as três taxas como o servidor (`set_staff_seller_fees`): número válido, dentro dos limites e acima do piso do dono. */
export function checkFees(form: FeeForm, limits: FeeLimits | null): FeeCheck {
  const errors: FeeCheck["errors"] = {};
  const pct = parsePercent(form.pct);
  const fixed = parseAmount(form.fixed);
  const withdrawal = parseAmount(form.withdrawal);
  if (pct === null) errors.pct = "Informe um percentual entre 0 e 100, com até 2 casas.";
  if (fixed === null) errors.fixed = "Informe um valor em reais, como 1,00.";
  if (withdrawal === null) errors.withdrawal = "Informe um valor em reais, como 3,00.";
  if (!limits) return { values: null, errors: { ...errors, pct: errors.pct ?? "O dono ainda não definiu o seu piso de taxas. Peça para ele configurar." } };
  if (pct !== null && pct < limits.pct) errors.pct = `O mínimo para você é ${pctText(limits.pct)}.`;
  if (fixed !== null && fixed < limits.fixed) errors.fixed = `O mínimo para você é ${brl(limits.fixed)}.`;
  if (withdrawal !== null && withdrawal < limits.withdrawal) errors.withdrawal = `O mínimo para você é ${brl(limits.withdrawal)}.`;
  if (fixed !== null && fixed > 1_000_000) errors.fixed = "Valor alto demais.";
  if (withdrawal !== null && withdrawal > 1_000_000) errors.withdrawal = "Valor alto demais.";
  return Object.keys(errors).length || pct === null || fixed === null || withdrawal === null
    ? { values: null, errors }
    : { values: { pct, fixed, withdrawal }, errors };
}

/* ───────── comissão ───────── */

export interface Payout { id: string; amount: number; status: string; method: string | null; notes: string | null; createdAt: string | null; processedAt: string | null }
export interface LedgerRow { id: string; type: string; amount: number; balanceAfter: number; description: string | null; createdAt: string | null }

export const PAYOUT_STATUS: Record<string, { label: string; tone: "success" | "warning" | "destructive" | "neutral" }> = {
  pending: { label: "Aguardando o dono", tone: "warning" },
  paid: { label: "Pago", tone: "success" },
  rejected: { label: "Recusado", tone: "destructive" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export function ledgerLabel(type: string): string {
  if (type === "accrual") return "Comissão de venda";
  if (type.startsWith("clawback")) return "Estorno de comissão";
  if (type === "payout") return "Pagamento recebido";
  if (type === "adjustment") return "Ajuste do dono";
  return "Movimento";
}

/** Quanto ainda dá para pedir: saldo menos os pedidos que o dono ainda não pagou. */
export const availableForPayout = (balance: number, payouts: Pick<Payout, "amount" | "status">[]) =>
  Math.max(0, Math.round((balance - payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0)) * 100) / 100);

export function checkPayout(raw: string, available: number): { amount: number | null; error: string | null } {
  const amount = parseAmount(raw);
  if (amount === null || amount <= 0) return { amount: null, error: "Informe o valor em reais, como 150,00." };
  if (amount > available) return { amount: null, error: `Você pode pedir até ${brl(available)}.` };
  return { amount, error: null };
}

/* ───────── erros do servidor ───────── */

export function staffError(err: unknown): string {
  const raw = (err as { message?: string } | null)?.message ?? "";
  if (/below owner minimum/i.test(raw)) return "Abaixo do piso que o dono definiu para você.";
  if (/invalid fees/i.test(raw)) return "Valores de taxa inválidos.";
  if (/only owner can release/i.test(raw)) return "Só o dono libera saques bloqueados.";
  if (/authorization and reason required/i.test(raw)) return "Explique o motivo em pelo menos 5 caracteres.";
  if (/insufficient_commission_balance/i.test(raw)) return "O valor passa da comissão disponível.";
  if (/invalid_payout_amount/i.test(raw)) return "Valor de pagamento inválido.";
  if (/fora da sua carteira/i.test(raw)) return "Esse seller não está na sua carteira.";
  if (/motivo com 5 a 1000/i.test(raw)) return "Explique o motivo com 5 a 1000 caracteres.";
  if (/muitos pedidos/i.test(raw)) return "Muitos pedidos em sequência. Espere um pouco.";
  if (/sem permissão para enviar pedidos/i.test(raw)) return "Sua conta não envia pedidos ao dono.";
  if (/adquirente inválida/i.test(raw)) return "Escolha uma adquirente válida.";
  if (/informe o seller|seller não encontrado/i.test(raw)) return "Escolha o seller.";
  if (/permission required|access denied|not authorized|row-level security|permission denied/i.test(raw)) return "Sua conta não tem permissão para isso.";
  if (/invalid period/i.test(raw)) return "Período inválido. Escolha até 366 dias.";
  if (/fetch|network|timeout/i.test(raw)) return "Sem conexão. Tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
}

export const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const int = (n: number) => n.toLocaleString("pt-BR");
export const dayTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
