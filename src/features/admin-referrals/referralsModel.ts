import type { Tone } from "@/features/admin-disputes/disputesModel";

export const PAGE_SIZE = 25;
export type { Tone };
export type Filter = "all" | "pending" | "qualified" | "paid" | "rejected" | "cancelled";
export type Outcome = "qualified" | "paid" | "rejected" | "cancelled";

export const PILLS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "qualified", label: "Qualificadas" },
  { value: "paid", label: "Pagas" },
  { value: "rejected", label: "Recusadas" },
  { value: "cancelled", label: "Canceladas" },
];

/* ───────── leitura do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);

export interface RefItem {
  id: string; referrer_user_id: string; referrer_name: string; referrer_email: string | null;
  referred_email: string; referred_user_id: string | null; referred_name: string | null;
  reward_amount: number; status: string; paid_at: string | null; created_at: string; updated_at: string;
  /** A conta do indicado já existia quando a indicação foi registrada. */
  account_before: boolean;
}
export interface RefSummary { all: number; pending: number; qualified: number; paid: number; rejected: number; cancelled: number }
export interface Program { total: number; referrers: number; pending: number; qualified: number; paid: number; owed: number; expected: number; paid_amount: number }
export interface RefPage { items: RefItem[]; total: number; summary: RefSummary; program: Program }

function parseItem(r: Record<string, unknown>): RefItem {
  return {
    id: str(r.id), referrer_user_id: str(r.referrer_user_id), referrer_name: str(r.referrer_name) || "Seller sem nome", referrer_email: strOrNull(r.referrer_email),
    referred_email: str(r.referred_email), referred_user_id: strOrNull(r.referred_user_id), referred_name: strOrNull(r.referred_name),
    reward_amount: num(r.reward_amount), status: str(r.status), paid_at: strOrNull(r.paid_at), created_at: str(r.created_at), updated_at: str(r.updated_at),
    account_before: r.account_before === true,
  };
}

export function parseRefPage(raw: unknown): RefPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  const p = isObj(raw.program) ? raw.program : {};
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total),
    summary: { all: num(s.all), pending: num(s.pending), qualified: num(s.qualified), paid: num(s.paid), rejected: num(s.rejected), cancelled: num(s.cancelled) },
    program: {
      total: num(p.total), referrers: num(p.referrers), pending: num(p.pending), qualified: num(p.qualified), paid: num(p.paid),
      owed: num(p.owed), expected: num(p.expected), paid_amount: num(p.paid_amount),
    },
  };
}

export interface HistoryRow { id: string; action: string; created_at: string; admin_name: string | null; reason: string | null }
export interface RefDetail {
  referral: { id: string; referred_email: string; status: string; reward_amount: number; paid_at: string | null; created_at: string; updated_at: string; linked: boolean };
  referrer: { user_id: string; name: string; email: string | null; account_status: string | null; created_at: string | null; referrals: number; paid: number; rejected: number };
  referred: { user_id: string; name: string; account_status: string | null; created_at: string | null; last_login_at: string | null; same_as_referrer: boolean; sales: number; volume: number } | null;
  others: { id: string; status: string; created_at: string; referrer_name: string }[];
  history: HistoryRow[];
}

export function parseRefDetail(raw: unknown): RefDetail {
  if (!isObj(raw) || !isObj(raw.referral)) throw new Error("Resposta inesperada do servidor.");
  const r = raw.referral, a = isObj(raw.referrer) ? raw.referrer : {}, b = isObj(raw.referred) ? raw.referred : null;
  return {
    referral: {
      id: str(r.id), referred_email: str(r.referred_email), status: str(r.status), reward_amount: num(r.reward_amount), paid_at: strOrNull(r.paid_at),
      created_at: str(r.created_at), updated_at: str(r.updated_at), linked: r.linked === true,
    },
    referrer: {
      user_id: str(a.user_id), name: str(a.name) || "Seller sem nome", email: strOrNull(a.email), account_status: strOrNull(a.account_status), created_at: strOrNull(a.created_at),
      referrals: num(a.referrals), paid: num(a.paid), rejected: num(a.rejected),
    },
    referred: b ? {
      user_id: str(b.user_id), name: str(b.name) || "Conta sem nome", account_status: strOrNull(b.account_status), created_at: strOrNull(b.created_at),
      last_login_at: strOrNull(b.last_login_at), same_as_referrer: b.same_as_referrer === true, sales: num(b.sales), volume: num(b.volume),
    } : null,
    others: arr(raw.others).map((o) => ({ id: str(o.id), status: str(o.status), created_at: str(o.created_at), referrer_name: str(o.referrer_name) || "Seller sem nome" })),
    history: arr(raw.history).map((h) => {
      const det = isObj(h.details) ? h.details : {};
      return { id: str(h.id), action: str(h.action), created_at: str(h.created_at), admin_name: strOrNull(h.admin_name), reason: strOrNull(det.reason) };
    }),
  };
}

export interface SellerHit { user_id: string; name: string; email: string | null }
export function parseSellers(raw: unknown): SellerHit[] {
  return Array.isArray(raw) ? raw.filter(isObj).map((s) => ({ user_id: str(s.user_id), name: str(s.name) || "Seller sem nome", email: strOrNull(s.email) })).filter((s) => s.user_id) : [];
}

/* ───────── textos e regras ───────── */

export function refStatus(s: string): { label: string; tone: Tone } {
  switch (s) {
    case "pending": return { label: "Pendente", tone: "info" };
    case "qualified": return { label: "Qualificada", tone: "warning" };
    case "paid": return { label: "Paga", tone: "success" };
    case "rejected": return { label: "Recusada", tone: "destructive" };
    case "cancelled": return { label: "Cancelada", tone: "neutral" };
    default: return { label: "Outro status", tone: "neutral" };
  }
}

/** O que dá para fazer a partir de cada status. Paga, recusada e cancelada são finais. */
export function nextOutcomes(status: string): Outcome[] {
  if (status === "pending") return ["qualified", "rejected", "cancelled"];
  if (status === "qualified") return ["paid", "rejected", "cancelled"];
  return [];
}

export const OUTCOME: Record<Outcome, { cta: string; title: string; effect: string; hint: string; presets: string[] }> = {
  qualified: {
    cta: "Qualificar", title: "Qualificar indicação",
    effect: "O indicado precisa ter conta na plataforma. A indicação passa para qualificada e o seller é avisado da recompensa prevista. Nada é pago ainda.",
    hint: "Fica no histórico da indicação.",
    presets: ["Indicado criou conta e vendeu", "Confirmado com o seller"],
  },
  paid: {
    cta: "Registrar pagamento", title: "Registrar pagamento",
    effect: "Isto só registra que a recompensa foi paga por fora, por exemplo num Pix manual: nenhum valor entra no saldo do seller. A indicação é encerrada e o seller é avisado.",
    hint: "Fica no histórico da indicação.",
    presets: ["Pix manual feito", "Pagamento combinado com o seller"],
  },
  rejected: {
    cta: "Recusar", title: "Recusar indicação",
    effect: "A indicação é encerrada e não volta. O e-mail fica livre para outra indicação. O seller é avisado com o motivo.",
    hint: "O seller lê o motivo.",
    presets: ["Indicado nunca criou conta", "Indicação duplicada", "Conta do indicado já existia", "Suspeita de fraude"],
  },
  cancelled: {
    cta: "Cancelar", title: "Cancelar indicação",
    effect: "A indicação é encerrada e não volta. O e-mail fica livre para outra indicação. O seller é avisado com o motivo.",
    hint: "O seller lê o motivo.",
    presets: ["Pedido do seller", "Registrada por engano"],
  },
};

export const CREATE_PRESETS = ["Seller avisou pelo suporte", "Combinado por mensagem"];
export const REASON_MIN = 5;
export const checkReason = (text: string) => (text.trim().length < REASON_MIN ? `Escreva o motivo (mínimo ${REASON_MIN} caracteres).` : null);

export const DEFAULT_REWARD = 50;
export const MAX_REWARD = 10000;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const SELLER_SEARCH_MIN = 2;

export interface CreateInput { seller: SellerHit | null; email: string; reward: number; reason: string }
export interface CreateProblems { seller?: string; email?: string; reward?: string; reason?: string }

/** Confere o formulário de registro; espelha as regras de `admin_create_referral`. */
export function checkCreate(i: CreateInput): CreateProblems {
  const p: CreateProblems = {};
  const email = i.email.trim().toLowerCase();
  if (!i.seller) p.seller = "Escolha quem indicou.";
  if (!email) p.email = "Informe o e-mail do indicado.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) p.email = "Esse e-mail não parece válido.";
  else if (i.seller?.email && i.seller.email.toLowerCase() === email) p.email = "O indicado não pode ser o próprio indicador.";
  if (!(i.reward >= 0 && i.reward <= MAX_REWARD)) p.reward = "A recompensa fica entre R$ 0 e R$ 10.000.";
  const r = checkReason(i.reason);
  if (r) p.reason = r;
  return p;
}

export function historyLabel(action: string): string {
  switch (action) {
    case "referral_create": return "Registrada pela equipe";
    case "referral_qualified": return "Qualificada";
    case "referral_paid": return "Pagamento registrado";
    case "referral_rejected": return "Recusada";
    case "referral_cancelled": return "Cancelada";
    default: return "Ação registrada";
  }
}

/** Situação da conta (cadastro/KYC) em português; o banco guarda em inglês. */
export function accountLabel(s: string | null): string {
  switch (s) {
    case "active": case "approved": return "Aprovada";
    case "pending": case "pending_review": return "KYC pendente";
    case "blocked": return "Bloqueada";
    case "rejected": return "KYC recusado";
    default: return "—";
  }
}

export function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Uma linha curta sobre o indicado: conta ligada, conta antiga ou ainda sem conta. */
export function referredNote(r: Pick<RefItem, "referred_user_id" | "referred_name" | "account_before" | "status">): { text: string; tone: "warning" | "muted" } {
  if (r.account_before) return { text: "A conta já existia antes da indicação", tone: "warning" };
  if (r.referred_user_id || r.referred_name) return { text: `Tem conta${r.referred_name ? `: ${r.referred_name}` : ""}`, tone: "muted" };
  return { text: "Ainda sem conta na plataforma", tone: "muted" };
}
