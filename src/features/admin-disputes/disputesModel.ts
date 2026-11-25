import { fmtDateTime } from "@/features/admin-finance/format";

export const PAGE_SIZE = 25;
/** Mínimo de caracteres para a busca de vendas (o servidor recusa menos que isso). */
export const SALE_SEARCH_MIN = 3;

export type DisputeType = "medpix" | "pre_med_pix" | "refund" | "chargeback";
export type TypeFilter = DisputeType | "all";
export type StatusFilter = "active" | "seller" | "buyer" | "all";

export const TYPES: { value: DisputeType; label: string; hint: string }[] = [
  { value: "medpix", label: "MED Pix", hint: "O comprador contestou um Pix no banco. Só vale para venda paga com Pix." },
  { value: "pre_med_pix", label: "Pré-MED", hint: "Aviso do banco antes do MED formal. Só vale para venda paga com Pix." },
  { value: "chargeback", label: "Chargeback", hint: "O comprador contestou a compra com a operadora do cartão. Só vale para venda no cartão." },
  { value: "refund", label: "Reembolso", hint: "O comprador pede o dinheiro de volta. Vale para qualquer forma de pagamento." },
];
export const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label ?? "Outro tipo";

/** Título e subtítulo da tela conforme o menu em que o admin entrou. */
export const PAGE_COPY: Record<TypeFilter, { title: string; subtitle: string }> = {
  all: { title: "Disputas e reembolsos", subtitle: "Todo valor contestado fica congelado no saldo do seller até você decidir." },
  medpix: { title: "MED Pix", subtitle: "Contestações de Pix feitas pelo comprador no banco. O valor fica congelado até a decisão." },
  pre_med_pix: { title: "Pré-MED", subtitle: "Avisos do banco antes do MED formal. O valor fica congelado até a decisão." },
  chargeback: { title: "Chargeback", subtitle: "Compras contestadas na operadora do cartão. O valor fica congelado até a decisão." },
  refund: { title: "Reembolsos", subtitle: "Pedidos de devolução. Decidir contra o seller tira o valor do saldo dele." },
};

export const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Em aberto" },
  { value: "seller", label: "A favor do seller" },
  { value: "buyer", label: "Contra o seller" },
  { value: "all", label: "Todas" },
];

/** Como a venda foi paga, em português. */
export const methodLabel = (m: string | null) => (m === "pix" ? "Pix" : m === "credit_card" ? "Cartão" : m === "boleto" ? "Boleto" : m ? m : "—");

/* ───────── dados que vêm do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

export interface DisputeItem {
  id: string; transaction_id: string; seller_user_id: string; seller_name: string; seller_email: string | null;
  type: string; status: string; reason: string; amount: number; buyer_name: string | null; buyer_email: string | null;
  created_at: string; response_deadline: string | null; seller_response: string | null; seller_responded_at: string | null;
  admin_notes: string | null; fee_amount: number; resolved_at: string | null; external_ref: string | null; evidence: string[];
  held_amount: number; payment_method: string | null; tx_amount: number; product_name: string | null;
}
export interface DisputesSummary {
  all: number; active: number; open: number; in_review: number; seller: number; buyer: number;
  overdue: number; soon: number; held: number; active_amount: number; lost_amount: number; fees: number;
}
export interface TypeCounts { all: number; medpix: number; pre_med_pix: number; refund: number; chargeback: number }
export interface DisputesPage { items: DisputeItem[]; total: number; summary: DisputesSummary; typeCounts: TypeCounts }

function parseItem(r: Record<string, unknown>): DisputeItem {
  return {
    id: str(r.id), transaction_id: str(r.transaction_id), seller_user_id: str(r.seller_user_id),
    seller_name: str(r.seller_name) || str(r.seller_email) || "Seller sem nome", seller_email: strOrNull(r.seller_email),
    type: str(r.type), status: str(r.status), reason: str(r.reason), amount: num(r.amount),
    buyer_name: strOrNull(r.buyer_name), buyer_email: strOrNull(r.buyer_email),
    created_at: str(r.created_at), response_deadline: strOrNull(r.response_deadline),
    seller_response: strOrNull(r.seller_response), seller_responded_at: strOrNull(r.seller_responded_at),
    admin_notes: strOrNull(r.admin_notes), fee_amount: num(r.fee_amount), resolved_at: strOrNull(r.resolved_at), external_ref: strOrNull(r.external_ref),
    evidence: Array.isArray(r.evidence) ? r.evidence.filter((e): e is string => typeof e === "string" && e.trim() !== "") : [],
    held_amount: num(r.held_amount), payment_method: strOrNull(r.payment_method), tx_amount: num(r.tx_amount), product_name: strOrNull(r.product_name),
  };
}

export function parseDisputesPage(raw: unknown): DisputesPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  const c = isObj(raw.type_counts) ? raw.type_counts : {};
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total),
    summary: {
      all: num(s.all), active: num(s.active), open: num(s.open), in_review: num(s.in_review), seller: num(s.seller), buyer: num(s.buyer),
      overdue: num(s.overdue), soon: num(s.soon), held: num(s.held), active_amount: num(s.active_amount), lost_amount: num(s.lost_amount), fees: num(s.fees),
    },
    typeCounts: { all: num(c.all), medpix: num(c.medpix), pre_med_pix: num(c.pre_med_pix), refund: num(c.refund), chargeback: num(c.chargeback) },
  };
}

export interface DisputeEvent { id: string; event: string; note: string | null; created_at: string; actor_name: string | null }
export function parseEvents(raw: unknown): DisputeEvent[] {
  if (!Array.isArray(raw)) throw new Error("Resposta inesperada do servidor.");
  return raw.filter(isObj).map((e) => ({ id: str(e.id), event: str(e.event), note: strOrNull(e.note), created_at: str(e.created_at), actor_name: strOrNull(e.actor_name) }));
}

const EVENT_LABEL: Record<string, string> = {
  opened: "Disputa aberta",
  in_review: "Movida para análise",
  seller_responded: "Seller enviou a defesa",
  won_by_seller: "Decidida a favor do seller",
  lost_by_seller: "Decidida contra o seller",
};
export const eventLabel = (e: string) => EVENT_LABEL[e] ?? "Outra atualização";

export interface SaleHit {
  id: string; amount: number; refunded_amount: number; status: string; payment_method: string | null;
  customer_name: string | null; customer_email: string | null; created_at: string; is_simulated: boolean;
  seller_name: string | null; product_name: string | null; open_dispute: boolean; pending_refund: boolean;
}
export function parseSales(raw: unknown): SaleHit[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error("Resposta inesperada do servidor.");
  return raw.filter(isObj).map((s) => ({
    id: str(s.id), amount: num(s.amount), refunded_amount: num(s.refunded_amount), status: str(s.status), payment_method: strOrNull(s.payment_method),
    customer_name: strOrNull(s.customer_name), customer_email: strOrNull(s.customer_email), created_at: str(s.created_at), is_simulated: s.is_simulated === true,
    seller_name: strOrNull(s.seller_name), product_name: strOrNull(s.product_name), open_dispute: s.open_dispute === true, pending_refund: s.pending_refund === true,
  }));
}

/* ───────── situação ───────── */

export type Tone = "success" | "warning" | "info" | "neutral" | "destructive";
export const isActive = (d: Pick<DisputeItem, "status">) => d.status === "open" || d.status === "in_review";

export function statusInfo(d: Pick<DisputeItem, "status" | "seller_response">): { label: string; tone: Tone } {
  if (d.status === "resolved_seller") return { label: "A favor do seller", tone: "success" };
  if (d.status === "resolved_buyer") return { label: "Contra o seller", tone: "destructive" };
  if (d.status === "in_review") return { label: "Em análise", tone: "info" };
  if (d.status === "open") return d.seller_response ? { label: "Defesa recebida", tone: "info" } : { label: "Aguardando defesa", tone: "warning" };
  return { label: "Encerrada", tone: "neutral" };
}

/** "em 3 h", "em 2 dias", "há 5 h", "há 1 dia". */
export function relativeSpan(ms: number): string {
  const future = ms >= 0; const min = Math.floor(Math.abs(ms) / 60_000);
  let body: string;
  if (min < 1) return future ? "agora há pouco" : "agora há pouco";
  if (min < 60) body = `${min} min`;
  else if (min < 48 * 60) body = `${Math.floor(min / 60)} h`;
  else { const d = Math.floor(min / 1440); body = `${d} ${d === 1 ? "dia" : "dias"}`; }
  return future ? `em ${body}` : `há ${body}`;
}

/** Prazo que o seller tem para se defender. Some depois da decisão ou quando a defesa já chegou. */
export function deadlineInfo(d: Pick<DisputeItem, "status" | "response_deadline" | "seller_response">, now = Date.now()): { label: string; tone: Tone } | null {
  if (!isActive(d)) return null;
  if (d.seller_response) return { label: "Defesa enviada", tone: "info" };
  if (!d.response_deadline) return { label: "Sem prazo definido", tone: "neutral" };
  const t = new Date(d.response_deadline).getTime();
  if (Number.isNaN(t)) return { label: "Sem prazo definido", tone: "neutral" };
  const diff = t - now;
  if (diff < 0) return { label: `Prazo venceu ${relativeSpan(diff)}`, tone: "destructive" };
  if (diff < 48 * 3_600_000) return { label: `Prazo vence ${relativeSpan(diff)}`, tone: "warning" };
  return { label: `Prazo vence ${relativeSpan(diff)}`, tone: "neutral" };
}

export const dateLabel = fmtDateTime;

/* ───────── regras que o servidor também confere ───────── */

/** Tipo que não combina com a forma de pagamento da venda, ou `null` se tudo certo. */
export function typeProblem(type: DisputeType, sale: Pick<SaleHit, "payment_method"> | null): string | null {
  if (!sale) return null;
  if ((type === "medpix" || type === "pre_med_pix") && sale.payment_method !== "pix") return `${typeLabel(type)} só vale para venda no Pix. Esta foi paga com ${methodLabel(sale.payment_method)}.`;
  if (type === "chargeback" && sale.payment_method !== "credit_card") return `Chargeback só vale para venda no cartão. Esta foi paga com ${methodLabel(sale.payment_method)}.`;
  return null;
}

const PAID = new Set(["approved", "paid", "completed", "partially_refunded"]);
export const remainingOf = (s: Pick<SaleHit, "amount" | "refunded_amount">) => Math.max(0, Math.round((s.amount - s.refunded_amount) * 100) / 100);

/** Motivo de a venda não poder receber uma disputa nova, ou `null`. */
export function saleBlockedForDispute(s: SaleHit): string | null {
  if (s.is_simulated) return "Venda simulada não gera disputa.";
  if (s.open_dispute) return "Já existe uma disputa em aberto nesta venda.";
  if (!PAID.has(s.status) && s.status !== "disputed") return "Esta venda não está paga.";
  if (remainingOf(s) <= 0) return "Esta venda já foi toda reembolsada.";
  return null;
}
export function saleBlockedForRefund(s: SaleHit): string | null {
  if (s.is_simulated) return "Venda simulada não é reembolsada.";
  if (s.open_dispute || s.status === "disputed") return "Venda em disputa: decida a disputa antes de reembolsar.";
  if (s.pending_refund) return "Já existe um reembolso aguardando confirmação nesta venda.";
  if (!PAID.has(s.status)) return "Esta venda não está paga.";
  if (remainingOf(s) <= 0) return "Esta venda já foi toda reembolsada.";
  return null;
}

export function checkOpen(sale: SaleHit | null, type: DisputeType, reason: string, days: number): string | null {
  if (!sale) return "Escolha a venda.";
  const blocked = saleBlockedForDispute(sale);
  if (blocked) return blocked;
  const t = typeProblem(type, sale);
  if (t) return t;
  if (reason.trim().length < 5) return "Explique o motivo (mínimo 5 caracteres).";
  if (!Number.isInteger(days) || days < 1 || days > 30) return "O prazo de defesa vai de 1 a 30 dias.";
  return null;
}

export function checkRefund(sale: SaleHit | null, amount: number, reason: string): string | null {
  if (!sale) return "Escolha a venda.";
  const blocked = saleBlockedForRefund(sale);
  if (blocked) return blocked;
  if (!(amount > 0)) return "Informe o valor a reembolsar.";
  if (amount > remainingOf(sale) + 0.001) return "O valor passa do que ainda pode ser reembolsado.";
  if (reason.trim().length < 5) return "Explique o motivo (mínimo 5 caracteres).";
  return null;
}

export function checkDecision(outcome: "seller" | "buyer", note: string, fee: number, amount: number): string | null {
  if (note.trim().length < 5) return "Escreva a justificativa da decisão (mínimo 5 caracteres).";
  if (outcome === "buyer") {
    if (!(fee >= 0)) return "A taxa não pode ser negativa.";
    if (fee > amount) return "A taxa não pode passar do valor da disputa.";
  }
  return null;
}

/** Texto do que a decisão provoca no saldo do seller — mostrado antes de confirmar. */
export function decisionEffect(outcome: "seller" | "buyer", d: Pick<DisputeItem, "held_amount" | "type">, fee: number, fmt: (n: number) => string): string {
  if (outcome === "seller") return `O seller ganha: ${fmt(d.held_amount)} voltam para o saldo dele e a venda volta a ser aprovada.`;
  const feeText = fee > 0 ? ` e uma taxa de ${fmt(fee)} é debitada` : "";
  return `O seller perde: ${fmt(d.held_amount)} deixam o saldo dele${feeText}. A venda vira chargeback e as comissões de quem participou dela são estornadas.`;
}

/** Tipo que serve para a venda escolhida (Pix → MED Pix, cartão → chargeback, o resto → reembolso). Mantém o atual se já combina. */
export function fitType(current: DisputeType, sale: Pick<SaleHit, "payment_method">): DisputeType {
  if (!typeProblem(current, sale)) return current;
  return sale.payment_method === "pix" ? "medpix" : sale.payment_method === "credit_card" ? "chargeback" : "refund";
}

export const shortId = (id: string) => id.slice(0, 8);
