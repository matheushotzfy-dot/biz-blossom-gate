import type { Tone } from "@/features/admin-disputes/disputesModel";

export const PAGE_SIZE = 25;
export type { Tone };
export type View = "subscriptions" | "plans";
export type SubFilter = "all" | "active" | "trial" | "late" | "paused" | "canceled";
export type PlanFilter = "all" | "live" | "paused" | "held";

export const SUB_PILLS: { value: SubFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "trial", label: "Em teste" },
  { value: "late", label: "Atrasadas" },
  { value: "paused", label: "Pausadas" },
  { value: "canceled", label: "Canceladas" },
];
export const PLAN_PILLS: { value: PlanFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "live", label: "No ar" },
  { value: "paused", label: "Pausados pelo seller" },
  { value: "held", label: "Pausados pela equipe" },
];

/* ───────── leitura do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);

export interface SubItem {
  id: string; subscriber_name: string | null; subscriber_email: string; status: string; billing_method: string; cancel_at_period_end: boolean;
  completed_cycles: number; max_cycles: number | null; next_charge_at: string | null; last_payment_at: string | null; current_period_end: string | null;
  trial_end: string | null; canceled_at: string | null; created_at: string;
  plan_id: string; plan_name: string; plan_price: number; plan_interval: string; plan_interval_count: number; plan_held: boolean;
  seller_user_id: string; seller_name: string; seller_email: string | null; monthly: number;
}
export interface SubSummary { all: number; active: number; trial: number; late: number; paused: number; canceled: number }
export interface Overview {
  plans: number; plans_live: number; plans_held: number; subs: number; active: number; trial: number; late: number; canceled: number;
  monthly: number; paid_cycles: number; paid_amount: number;
}
export interface SubsPage { items: SubItem[]; total: number; summary: SubSummary; program: Overview }

function parseSub(r: Record<string, unknown>): SubItem {
  return {
    id: str(r.id), subscriber_name: strOrNull(r.subscriber_name), subscriber_email: str(r.subscriber_email), status: str(r.status), billing_method: str(r.billing_method),
    cancel_at_period_end: r.cancel_at_period_end === true, completed_cycles: num(r.completed_cycles), max_cycles: numOrNull(r.max_cycles),
    next_charge_at: strOrNull(r.next_charge_at), last_payment_at: strOrNull(r.last_payment_at), current_period_end: strOrNull(r.current_period_end),
    trial_end: strOrNull(r.trial_end), canceled_at: strOrNull(r.canceled_at), created_at: str(r.created_at),
    plan_id: str(r.plan_id), plan_name: str(r.plan_name) || "Plano sem nome", plan_price: num(r.plan_price), plan_interval: str(r.plan_interval),
    plan_interval_count: Math.max(1, num(r.plan_interval_count) || 1), plan_held: r.plan_held === true,
    seller_user_id: str(r.seller_user_id), seller_name: str(r.seller_name) || "Seller sem nome", seller_email: strOrNull(r.seller_email), monthly: num(r.monthly),
  };
}

export function parseSubsPage(raw: unknown): SubsPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  const p = isObj(raw.program) ? raw.program : {};
  return {
    items: raw.items.filter(isObj).map(parseSub), total: num(raw.total),
    summary: { all: num(s.all), active: num(s.active), trial: num(s.trial), late: num(s.late), paused: num(s.paused), canceled: num(s.canceled) },
    program: {
      plans: num(p.plans), plans_live: num(p.plans_live), plans_held: num(p.plans_held), subs: num(p.subs), active: num(p.active), trial: num(p.trial), late: num(p.late),
      canceled: num(p.canceled), monthly: num(p.monthly), paid_cycles: num(p.paid_cycles), paid_amount: num(p.paid_amount),
    },
  };
}

export interface PlanItem {
  id: string; name: string; price: number; interval: string; interval_count: number; trial_days: number; is_active: boolean;
  hold_reason: string | null; hold_at: string | null; created_at: string;
  product_id: string | null; product_name: string | null; product_deleted: boolean;
  seller_user_id: string; seller_name: string; seller_email: string | null;
  subs: number; active: number; trial: number; late: number; paused: number; canceled: number; monthly: number;
}
export interface PlansPage { items: PlanItem[]; total: number; summary: { all: number; live: number; paused: number; held: number } }

export function parsePlansPage(raw: unknown): PlansPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  return {
    items: raw.items.filter(isObj).map((r) => ({
      id: str(r.id), name: str(r.name) || "Plano sem nome", price: num(r.price), interval: str(r.interval), interval_count: Math.max(1, num(r.interval_count) || 1),
      trial_days: num(r.trial_days), is_active: r.is_active === true, hold_reason: strOrNull(r.hold_reason), hold_at: strOrNull(r.hold_at), created_at: str(r.created_at),
      product_id: strOrNull(r.product_id), product_name: strOrNull(r.product_name), product_deleted: r.product_deleted === true,
      seller_user_id: str(r.seller_user_id), seller_name: str(r.seller_name) || "Seller sem nome", seller_email: strOrNull(r.seller_email),
      subs: num(r.subs), active: num(r.active), trial: num(r.trial), late: num(r.late), paused: num(r.paused), canceled: num(r.canceled), monthly: num(r.monthly),
    })),
    total: num(raw.total),
    summary: { all: num(s.all), live: num(s.live), paused: num(s.paused), held: num(s.held) },
  };
}

export interface HistoryRow { id: string; action: string; created_at: string; admin_name: string | null; reason: string | null }
const parseHistory = (v: unknown): HistoryRow[] => arr(v).map((h) => {
  const det = isObj(h.details) ? h.details : {};
  return { id: str(h.id), action: str(h.action), created_at: str(h.created_at), admin_name: strOrNull(h.admin_name), reason: strOrNull(det.reason) };
});

export interface CycleRow { id: string; cycle_number: number; due_at: string; amount: number; status: string; attempt_count: number; last_attempt_at: string | null; paid_at: string | null; has_transaction: boolean }
export interface PlanRef { id: string; name: string; price: number; interval: string; interval_count: number; trial_days: number; is_active: boolean; hold_reason: string | null; hold_at: string | null; product_id: string | null; product_name: string | null }
export interface Person { user_id: string; name: string; email: string | null; account_status: string | null }
export interface SubDetail {
  subscription: {
    id: string; subscriber_name: string | null; subscriber_email: string; has_account: boolean; status: string; billing_method: string; cancel_at_period_end: boolean;
    completed_cycles: number; max_cycles: number | null; current_period_start: string | null; current_period_end: string | null; trial_end: string | null;
    canceled_at: string | null; next_charge_at: string | null; last_payment_at: string | null; created_at: string;
  };
  plan: PlanRef; seller: Person;
  stats: { cycles: number; paid: number; failed: number; overdue: number; paid_amount: number; monthly: number };
  cycles: CycleRow[]; history: HistoryRow[];
}

const parsePerson = (v: unknown): Person => {
  const s = isObj(v) ? v : {};
  return { user_id: str(s.user_id), name: str(s.name) || "Seller sem nome", email: strOrNull(s.email), account_status: strOrNull(s.account_status) };
};
const parsePlanRef = (v: unknown): PlanRef => {
  const p = isObj(v) ? v : {};
  return {
    id: str(p.id), name: str(p.name) || "Plano sem nome", price: num(p.price), interval: str(p.interval), interval_count: Math.max(1, num(p.interval_count) || 1), trial_days: num(p.trial_days),
    is_active: p.is_active === true, hold_reason: strOrNull(p.hold_reason), hold_at: strOrNull(p.hold_at), product_id: strOrNull(p.product_id), product_name: strOrNull(p.product_name),
  };
};

export function parseSubDetail(raw: unknown): SubDetail {
  if (!isObj(raw) || !isObj(raw.subscription)) throw new Error("Resposta inesperada do servidor.");
  const s = raw.subscription, x = isObj(raw.stats) ? raw.stats : {};
  return {
    subscription: {
      id: str(s.id), subscriber_name: strOrNull(s.subscriber_name), subscriber_email: str(s.subscriber_email), has_account: s.has_account === true, status: str(s.status),
      billing_method: str(s.billing_method), cancel_at_period_end: s.cancel_at_period_end === true, completed_cycles: num(s.completed_cycles), max_cycles: numOrNull(s.max_cycles),
      current_period_start: strOrNull(s.current_period_start), current_period_end: strOrNull(s.current_period_end), trial_end: strOrNull(s.trial_end),
      canceled_at: strOrNull(s.canceled_at), next_charge_at: strOrNull(s.next_charge_at), last_payment_at: strOrNull(s.last_payment_at), created_at: str(s.created_at),
    },
    plan: parsePlanRef(raw.plan), seller: parsePerson(raw.seller),
    stats: { cycles: num(x.cycles), paid: num(x.paid), failed: num(x.failed), overdue: num(x.overdue), paid_amount: num(x.paid_amount), monthly: num(x.monthly) },
    cycles: arr(raw.cycles).map((c) => ({
      id: str(c.id), cycle_number: num(c.cycle_number), due_at: str(c.due_at), amount: num(c.amount), status: str(c.status), attempt_count: num(c.attempt_count),
      last_attempt_at: strOrNull(c.last_attempt_at), paid_at: strOrNull(c.paid_at), has_transaction: c.has_transaction === true,
    })),
    history: parseHistory(raw.history),
  };
}

export interface PlanDetail {
  plan: PlanRef & { description: string | null; created_at: string };
  product: { id: string; name: string; status: string | null; deleted: boolean } | null;
  seller: Person;
  stats: { subs: number; active: number; trial: number; late: number; paused: number; canceled: number; monthly: number; paid_amount: number };
  subscriptions: { id: string; subscriber_name: string | null; subscriber_email: string; status: string; completed_cycles: number; created_at: string }[];
  history: HistoryRow[];
}

export function parsePlanDetail(raw: unknown): PlanDetail {
  if (!isObj(raw) || !isObj(raw.plan)) throw new Error("Resposta inesperada do servidor.");
  const x = isObj(raw.stats) ? raw.stats : {};
  const pd = isObj(raw.product) ? raw.product : null;
  return {
    plan: { ...parsePlanRef(raw.plan), description: strOrNull(raw.plan.description), created_at: str(raw.plan.created_at) },
    product: pd ? { id: str(pd.id), name: str(pd.name) || "Produto sem nome", status: strOrNull(pd.status), deleted: pd.deleted === true } : null,
    seller: parsePerson(raw.seller),
    stats: { subs: num(x.subs), active: num(x.active), trial: num(x.trial), late: num(x.late), paused: num(x.paused), canceled: num(x.canceled), monthly: num(x.monthly), paid_amount: num(x.paid_amount) },
    subscriptions: arr(raw.subscriptions).map((s) => ({
      id: str(s.id), subscriber_name: strOrNull(s.subscriber_name), subscriber_email: str(s.subscriber_email), status: str(s.status), completed_cycles: num(s.completed_cycles), created_at: str(s.created_at),
    })),
    history: parseHistory(raw.history),
  };
}

/* ───────── textos ───────── */

export function subStatus(s: string): { label: string; tone: Tone } {
  switch (s) {
    case "active": return { label: "Ativa", tone: "success" };
    case "trialing": return { label: "Em teste", tone: "info" };
    case "past_due": return { label: "Atrasada", tone: "warning" };
    case "paused": return { label: "Pausada", tone: "neutral" };
    case "canceled": return { label: "Cancelada", tone: "neutral" };
    default: return { label: "Outro status", tone: "neutral" };
  }
}

export function cycleStatus(s: string): { label: string; tone: Tone } {
  switch (s) {
    case "scheduled": return { label: "Agendado", tone: "neutral" };
    case "pending": return { label: "Aguardando pagamento", tone: "info" };
    case "paid": return { label: "Pago", tone: "success" };
    case "failed": return { label: "Falhou", tone: "destructive" };
    case "overdue": return { label: "Atrasado", tone: "warning" };
    case "canceled": return { label: "Cancelado", tone: "neutral" };
    default: return { label: "Outro status", tone: "neutral" };
  }
}

export function planState(p: Pick<PlanItem, "is_active" | "hold_at">): { label: string; tone: Tone } {
  if (p.hold_at) return { label: "Pausado pela equipe", tone: "destructive" };
  if (!p.is_active) return { label: "Pausado pelo seller", tone: "neutral" };
  return { label: "No ar", tone: "success" };
}

const PER: Record<string, [string, string]> = { daily: ["dia", "dias"], weekly: ["semana", "semanas"], monthly: ["mês", "meses"], yearly: ["ano", "anos"] };
/** "por mês", "a cada 3 meses". */
export function intervalLabel(interval: string, count: number): string {
  const [one, many] = PER[interval] ?? ["período", "períodos"];
  return count <= 1 ? `por ${one}` : `a cada ${count} ${many}`;
}

export function methodLabel(m: string): string { return m === "credit_card" ? "Cartão" : m === "pix" ? "Pix" : "—"; }

export function cyclesLabel(done: number, max: number | null): string {
  const d = `${done} ${done === 1 ? "cobrança paga" : "cobranças pagas"}`;
  return max ? `${d} de ${max}` : d;
}

export function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** O que a coluna "Próxima cobrança" deve dizer: cancelada não tem próxima; cancelamento agendado avisa. */
export function nextChargeLabel(s: Pick<SubItem, "status" | "next_charge_at" | "cancel_at_period_end" | "current_period_end">): string {
  if (s.status === "canceled") return "Sem nova cobrança";
  if (s.cancel_at_period_end) return s.current_period_end ? `Encerra em ${dayLabel(s.current_period_end)}` : "Encerra no fim do período";
  return s.next_charge_at ? dayLabel(s.next_charge_at) : "Não agendada";
}

export function historyLabel(action: string): string {
  switch (action) {
    case "subscription_cancel": return "Cancelada pela equipe";
    case "plan_hold": return "Plano pausado pela equipe";
    case "plan_release": return "Plano liberado para o seller reativar";
    default: return "Ação registrada";
  }
}

export const HOLD_PRESETS = ["Promessa enganosa", "Cobrança indevida", "Plano duplicado", "Pedido do seller"];
export const CANCEL_PRESETS = ["Pedido do assinante", "Fraude", "Cobrança indevida", "Plano pausado pela equipe"];
export const REASON_MIN = 5;
export const checkReason = (text: string) => (text.trim().length < REASON_MIN ? `Escreva o motivo (mínimo ${REASON_MIN} caracteres).` : null);
