import type { Tone } from "@/features/admin-disputes/disputesModel";
import { fmtDateTime } from "@/features/admin-finance/format";

export type { Tone };

export const PAGE_SIZE = 25;
export const dateLabel = fmtDateTime;

export type ClaimStatus = "pending" | "preparing" | "shipped" | "delivered" | "cancelled";
export type ClaimFilter = "open" | ClaimStatus | "all";

export const FILTER_PILLS: { value: ClaimFilter; label: string }[] = [
  { value: "open", label: "Em andamento" },
  { value: "pending", label: "Aguardando" },
  { value: "preparing", label: "Em preparo" },
  { value: "shipped", label: "Postados" },
  { value: "delivered", label: "Entregues" },
  { value: "cancelled", label: "Cancelados" },
  { value: "all", label: "Todos" },
];

export const STATUS_INFO: Record<ClaimStatus, { label: string; tone: Tone }> = {
  pending: { label: "Aguardando", tone: "warning" },
  preparing: { label: "Em preparo", tone: "info" },
  shipped: { label: "Postado", tone: "info" },
  delivered: { label: "Entregue", tone: "success" },
  cancelled: { label: "Cancelado", tone: "destructive" },
};

/** Estados de pedidos antigos ("approved" foi o nome de "preparing") caem no mais próximo. */
export const statusOf = (v: unknown): ClaimStatus => {
  if (v === "approved") return "preparing";
  return v === "preparing" || v === "shipped" || v === "delivered" || v === "cancelled" ? v : "pending";
};

export const isClosed = (s: ClaimStatus) => s === "delivered" || s === "cancelled";

/* ───────── leitura das respostas do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export interface SellerRef { user_id: string; name: string | null; email: string | null }
export interface ClaimRow {
  id: string; user_id: string; tier_id: string; tier_label: string; tier_value: number; recipient_name: string;
  shipping_city: string; shipping_state: string; status: ClaimStatus; tracking_carrier: string | null; tracking_code: string | null;
  created_at: string; delivered_at: string | null; updated_at: string; has_message: boolean; seller: SellerRef;
}
export interface ClaimProgram {
  pending: number; pending_since: string | null; in_progress: number; delivered_30d: number;
  median_days_to_deliver: number | null; delivered_sample: number; total: number;
}
export interface ClaimsPage { items: ClaimRow[]; total: number; counts: Record<ClaimFilter, number>; program: ClaimProgram }

const parseSeller = (raw: unknown): SellerRef => {
  const s = isObj(raw) ? raw : {};
  return { user_id: str(s.user_id), name: strOrNull(s.name), email: strOrNull(s.email) };
};

function parseRow(r: Record<string, unknown>): ClaimRow {
  return {
    id: str(r.id), user_id: str(r.user_id), tier_id: str(r.tier_id), tier_label: str(r.tier_label), tier_value: num(r.tier_value),
    recipient_name: str(r.recipient_name), shipping_city: str(r.shipping_city), shipping_state: str(r.shipping_state), status: statusOf(r.status),
    tracking_carrier: strOrNull(r.tracking_carrier), tracking_code: strOrNull(r.tracking_code), created_at: str(r.created_at),
    delivered_at: strOrNull(r.delivered_at), updated_at: str(r.updated_at) || str(r.created_at), has_message: r.has_message === true, seller: parseSeller(r.seller),
  };
}

export function parseClaimsPage(raw: unknown): ClaimsPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const c = isObj(raw.counts) ? raw.counts : {};
  const p = isObj(raw.program) ? raw.program : {};
  const median = p.median_days_to_deliver;
  return {
    items: raw.items.filter(isObj).map(parseRow),
    total: num(raw.total),
    counts: { open: num(c.open), pending: num(c.pending), preparing: num(c.preparing), shipped: num(c.shipped), delivered: num(c.delivered), cancelled: num(c.cancelled), all: num(c.all) },
    program: {
      pending: num(p.pending), pending_since: strOrNull(p.pending_since), in_progress: num(p.in_progress), delivered_30d: num(p.delivered_30d),
      median_days_to_deliver: median === null || median === undefined ? null : num(median), delivered_sample: num(p.delivered_sample), total: num(p.total),
    },
  };
}

export interface HistoryItem { at: string; action: string; by: string | null; details: Record<string, unknown> }
export interface OtherClaim { id: string; tier_label: string; status: ClaimStatus; created_at: string }
export interface SellerContext {
  user_id: string; name: string | null; email: string | null; account_status: string | null; joined_at: string | null; revenue: number; sales: number;
}
export interface ClaimDetail {
  id: string; user_id: string; tier_id: string; tier_label: string; tier_value: number; status: ClaimStatus; created_at: string; updated_at: string;
  delivered_at: string | null; recipient_name: string; phone: string; document: string | null; shipping_street: string; shipping_number: string;
  shipping_complement: string | null; shipping_neighborhood: string; shipping_city: string; shipping_state: string; shipping_zip: string;
  tracking_carrier: string | null; tracking_code: string | null; tracking_url: string | null; message: string | null;
  seller: SellerContext; other_claims: OtherClaim[]; history: HistoryItem[];
}

export function parseClaimDetail(raw: unknown): ClaimDetail {
  if (!isObj(raw) || !str(raw.id)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.seller) ? raw.seller : {};
  const other = (Array.isArray(raw.other_claims) ? raw.other_claims.filter(isObj) : []).map((o): OtherClaim => ({
    id: str(o.id), tier_label: str(o.tier_label), status: statusOf(o.status), created_at: str(o.created_at),
  }));
  const history = (Array.isArray(raw.history) ? raw.history.filter(isObj) : []).map((h): HistoryItem => ({
    at: str(h.at), action: str(h.action), by: strOrNull(h.by), details: isObj(h.details) ? h.details : {},
  }));
  return {
    id: str(raw.id), user_id: str(raw.user_id), tier_id: str(raw.tier_id), tier_label: str(raw.tier_label), tier_value: num(raw.tier_value), status: statusOf(raw.status),
    created_at: str(raw.created_at), updated_at: str(raw.updated_at) || str(raw.created_at), delivered_at: strOrNull(raw.delivered_at),
    recipient_name: str(raw.recipient_name), phone: str(raw.phone), document: strOrNull(raw.document), shipping_street: str(raw.shipping_street),
    shipping_number: str(raw.shipping_number), shipping_complement: strOrNull(raw.shipping_complement), shipping_neighborhood: str(raw.shipping_neighborhood),
    shipping_city: str(raw.shipping_city), shipping_state: str(raw.shipping_state), shipping_zip: str(raw.shipping_zip),
    tracking_carrier: strOrNull(raw.tracking_carrier), tracking_code: strOrNull(raw.tracking_code), tracking_url: strOrNull(raw.tracking_url), message: strOrNull(raw.message),
    seller: {
      user_id: str(s.user_id), name: strOrNull(s.name), email: strOrNull(s.email), account_status: strOrNull(s.account_status),
      joined_at: strOrNull(s.joined_at), revenue: Math.max(0, num(s.revenue)), sales: Math.max(0, num(s.sales)),
    },
    other_claims: other, history,
  };
}

export interface TierClaims { total: number; open: number; delivered: number; cancelled: number }
export interface TierItem {
  id: string; title: string; tier: string; value: number; description: string; phrase: string; rewards: string[]; image_url: string | null;
  sort_order: number; is_active: boolean; claims: TierClaims; reached: number; waiting_to_claim: number;
}

export function parseTiers(raw: unknown): TierItem[] {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  return raw.items.filter(isObj).map((t): TierItem => {
    const c = isObj(t.claims) ? t.claims : {};
    return {
      id: str(t.id), title: str(t.title), tier: str(t.tier), value: num(t.value), description: str(t.description), phrase: str(t.phrase),
      rewards: (Array.isArray(t.rewards) ? t.rewards : []).filter((r): r is string => typeof r === "string"),
      image_url: strOrNull(t.image_url), sort_order: num(t.sort_order), is_active: t.is_active === true,
      claims: { total: num(c.total), open: num(c.open), delivered: num(c.delivered), cancelled: num(c.cancelled) },
      reached: num(t.reached), waiting_to_claim: num(t.waiting_to_claim),
    };
  });
}

/* ───────── textos ───────── */

export const claimRef = (id: string): string => `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
export const sellerLabel = (u: Pick<SellerRef, "name" | "email">): string => u.name ?? u.email ?? "Seller sem nome";
export const brl0 = (v: number): string => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export const place = (c: Pick<ClaimRow, "shipping_city" | "shipping_state">): string => [c.shipping_city, c.shipping_state].filter(Boolean).join("/");

/** O tempo que o pedido espera, em palavras: "agora", "2 dias", "3 semanas". */
export function waitLabel(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const h = Math.floor((now - t) / 3_600_000);
  if (h < 1) return "menos de 1 hora";
  if (h < 24) return h === 1 ? "1 hora" : `${h} horas`;
  const d = Math.floor(h / 24);
  if (d < 14) return d === 1 ? "1 dia" : `${d} dias`;
  const w = Math.floor(d / 7);
  return `${w} semanas`;
}

export function daysLabel(days: number): string {
  if (days < 1) return "menos de 1 dia";
  const r = Math.round(days * 10) / 10;
  return r === 1 ? "1 dia" : `${String(r).replace(".", ",")} dias`;
}

export function accountStatusLabel(status: string | null): string {
  switch (status) {
    case "approved": return "Cadastro aprovado";
    case "pending": return "Cadastro em análise";
    case "rejected": return "Cadastro reprovado";
    case "blocked": case "suspended": return "Conta bloqueada";
    default: return status ? "Situação do cadastro: " + status : "Sem cadastro";
  }
}

export function emptyCopy(filter: ClaimFilter, searching: boolean, hasAny: boolean): { title: string; subtitle: string } {
  if (searching) return { title: "Nada por aqui", subtitle: "Nenhum pedido bate com essa busca." };
  if (!hasAny) return { title: "Nenhum pedido ainda", subtitle: "Quando um seller bater uma meta e pedir a premiação, o pedido aparece aqui." };
  switch (filter) {
    case "open": return { title: "Nenhum pedido em andamento", subtitle: "Todos os pedidos foram entregues ou cancelados." };
    case "pending": return { title: "Nenhum pedido aguardando", subtitle: "Os pedidos novos, ainda sem análise, aparecem aqui." };
    case "preparing": return { title: "Nenhum pedido em preparo", subtitle: "Os que você já aceitou e ainda não postou aparecem aqui." };
    case "shipped": return { title: "Nenhum pedido postado", subtitle: "Os pedidos a caminho, com código de rastreio, aparecem aqui." };
    case "delivered": return { title: "Nenhum pedido entregue", subtitle: "Os pedidos concluídos ficam guardados aqui." };
    case "cancelled": return { title: "Nenhum pedido cancelado", subtitle: "Os pedidos cancelados, com o motivo, ficam guardados aqui." };
    default: return { title: "Nenhum pedido", subtitle: "Não há pedidos nesta lista." };
  }
}

/* ───────── endereço ───────── */

export function fullAddress(c: Pick<ClaimDetail, "shipping_street" | "shipping_number" | "shipping_complement" | "shipping_neighborhood" | "shipping_city" | "shipping_state" | "shipping_zip">): string {
  const line1 = [c.shipping_street, c.shipping_number].filter(Boolean).join(", ");
  return [line1, c.shipping_complement, c.shipping_neighborhood, [c.shipping_city, c.shipping_state].filter(Boolean).join("/"), c.shipping_zip ? `CEP ${c.shipping_zip}` : ""]
    .filter(Boolean).join(" · ");
}

export const mapsUrl = (addr: string): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

/** O bloco que vai na etiqueta da postagem: quem recebe, contato e endereço, uma informação por linha. */
export function labelText(c: ClaimDetail): string {
  return [
    c.recipient_name,
    [c.phone, c.document].filter(Boolean).join(" · "),
    [c.shipping_street, c.shipping_number].filter(Boolean).join(", ") + (c.shipping_complement ? ` - ${c.shipping_complement}` : ""),
    c.shipping_neighborhood,
    `${c.shipping_city}/${c.shipping_state}`,
    `CEP ${c.shipping_zip}`,
  ].filter((l) => l.trim()).join("\n");
}

/* ───────── andamento ───────── */

export type StepKind = "prepare" | "ship" | "deliver" | "cancel" | "reopen";

/** O que dá para fazer com o pedido agora, na ordem em que aparece. O servidor confere as mesmas regras. */
export function stepsFor(status: ClaimStatus): StepKind[] {
  switch (status) {
    case "pending": return ["prepare", "cancel"];
    case "preparing": return ["ship", "cancel"];
    case "shipped": return ["deliver", "cancel"];
    case "cancelled": return ["reopen"];
    default: return [];
  }
}

export const STEP_LABEL: Record<StepKind, string> = {
  prepare: "Aceitar e preparar", ship: "Marcar como postado", deliver: "Marcar como entregue", cancel: "Cancelar pedido", reopen: "Reabrir pedido",
};

/* ───────── regras dos formulários (o servidor confere as mesmas) ───────── */

export const MESSAGE_MAX = 500;
export const REASON_MIN = 5;
const URL_RE = /^https?:\/\/[^\s<>"'\\]+$/i;

export interface TrackingForm { carrier: string; code: string; url: string; message: string }

export function trackingErrors(f: TrackingForm): Partial<Record<keyof TrackingForm, string>> {
  const e: Partial<Record<keyof TrackingForm, string>> = {};
  const carrier = f.carrier.trim(); const code = f.code.trim(); const url = f.url.trim(); const msg = f.message.trim();
  if (!code) e.code = "Informe o código de rastreio.";
  else if (code.length > 100) e.code = "O código passa de 100 caracteres.";
  if (carrier.length > 60) e.carrier = "O nome da transportadora passa de 60 caracteres.";
  if (url && (url.length > 2048 || !URL_RE.test(url))) e.url = "O link precisa começar com http:// ou https://.";
  if (msg.length > MESSAGE_MAX) e.message = `A mensagem passa de ${MESSAGE_MAX} caracteres.`;
  return e;
}

export const reasonProblem = (text: string): string | null => {
  const t = text.trim();
  if (t.length < REASON_MIN) return `Escreva o motivo (mínimo ${REASON_MIN} caracteres).`;
  if (t.length > MESSAGE_MAX) return `O motivo passa de ${MESSAGE_MAX} caracteres.`;
  return null;
};

export const noteProblem = (text: string): string | null => {
  const t = text.trim();
  if (t.length < 2) return "Escreva a anotação.";
  if (t.length > MESSAGE_MAX) return `A anotação passa de ${MESSAGE_MAX} caracteres.`;
  return null;
};

/* ───────── histórico ───────── */

const d = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function historyEntry(h: HistoryItem): { title: string; text: string | null; internal: boolean } {
  const x = h.details;
  switch (h.action) {
    case "reward_claim_preparing": return { title: "Pedido aceito, em preparo", text: d(x.message) || null, internal: false };
    case "reward_claim_shipped": {
      const track = [d(x.carrier), d(x.code)].filter(Boolean).join(" ");
      return { title: "Marcado como postado", text: [track && `Rastreio: ${track}`, d(x.message)].filter(Boolean).join("\n") || null, internal: false };
    }
    case "reward_claim_delivered": return { title: "Marcado como entregue", text: d(x.message) || null, internal: false };
    case "reward_claim_cancelled": return { title: "Pedido cancelado", text: d(x.message) ? `Motivo: ${d(x.message)}` : null, internal: false };
    case "reward_claim_reopened": return { title: "Pedido reaberto", text: null, internal: false };
    case "reward_claim_update": {
      const track = [d(x.carrier), d(x.code)].filter(Boolean).join(" ");
      return { title: "Rastreio ou mensagem atualizados", text: [track && `Rastreio: ${track}`, d(x.message)].filter(Boolean).join("\n") || null, internal: false };
    }
    case "reward_claim_address": {
      const fields = Array.isArray(x.fields) ? x.fields.filter((f): f is string => typeof f === "string") : [];
      return { title: "Endereço corrigido", text: [fields.length ? `Mudou: ${fields.join(", ")}.` : "", d(x.reason) ? `Motivo: ${d(x.reason)}` : ""].filter(Boolean).join("\n") || null, internal: false };
    }
    case "reward_claim_note": return { title: "Anotação interna", text: d(x.note) || null, internal: true };
    default: return { title: "Alteração no pedido", text: null, internal: false };
  }
}

/* ───────── marcos ───────── */

export interface TierForm { title: string; tier: string; value: string; description: string; phrase: string; rewards: string; image_url: string }

export const TIER_LIMITS = { title: 60, tier: 30, description: 300, phrase: 160, rewardItem: 80, rewardCount: 8, valueMax: 100_000_000 } as const;

export const rewardsFromText = (text: string): string[] => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
export const rewardsToText = (rewards: string[]): string => rewards.join("\n");

export function tierErrors(f: TierForm, value: number): Partial<Record<keyof TierForm, string>> {
  const e: Partial<Record<keyof TierForm, string>> = {};
  const title = f.title.trim();
  if (title.length < 2) e.title = "Dê um nome à peça (mínimo 2 caracteres).";
  else if (title.length > TIER_LIMITS.title) e.title = `O nome passa de ${TIER_LIMITS.title} caracteres.`;
  if (f.tier.trim().length > TIER_LIMITS.tier) e.tier = `O nível passa de ${TIER_LIMITS.tier} caracteres.`;
  if (!(value > 0)) e.value = "Informe a meta de faturamento.";
  else if (value > TIER_LIMITS.valueMax) e.value = "A meta máxima é R$ 100.000.000.";
  if (f.description.trim().length > TIER_LIMITS.description) e.description = `A descrição passa de ${TIER_LIMITS.description} caracteres.`;
  if (f.phrase.trim().length > TIER_LIMITS.phrase) e.phrase = `A frase passa de ${TIER_LIMITS.phrase} caracteres.`;
  const rewards = rewardsFromText(f.rewards);
  if (rewards.length > TIER_LIMITS.rewardCount) e.rewards = `No máximo ${TIER_LIMITS.rewardCount} itens.`;
  else if (rewards.some((r) => r.length > TIER_LIMITS.rewardItem)) e.rewards = `Cada item pode ter até ${TIER_LIMITS.rewardItem} caracteres.`;
  const url = f.image_url.trim();
  if (url && !/^https?:\/\//i.test(url)) e.image_url = "O link da imagem precisa começar com http:// ou https://.";
  return e;
}

/** Subir a meta ou ligar a peça muda o que os sellers veem e alcançam: pede a senha. Só texto, não. */
export function tierNeedsPassword(prev: TierItem | null, value: number, active: boolean): boolean {
  if (!prev) return false;
  return prev.value !== value || (!prev.is_active && active);
}

export function tierImpact(t: TierItem): string {
  if (t.claims.total > 0) return `${t.claims.total} ${t.claims.total === 1 ? "pedido" : "pedidos"} já feitos: esta peça não pode ser apagada, só ocultada.`;
  if (t.reached > 0) return `${t.reached} ${t.reached === 1 ? "seller já bateu" : "sellers já bateram"} esta meta.`;
  return "Nenhum pedido nem seller na meta ainda.";
}
