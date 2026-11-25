import type { Tone } from "@/features/admin-disputes/disputesModel";

export const PAGE_SIZE = 25;
export type { Tone };

export type StatusFilter = "live" | "pending_review" | "active" | "inactive" | "draft" | "deleted";
export type Classification = "white" | "gray" | "black";
export type ClassFilter = Classification | "all";
export type ProductAction = "approve" | "review" | "deactivate" | "delete" | "restore";

export const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "live", label: "Todos" },
  { value: "pending_review", label: "Em revisão" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "draft", label: "Rascunhos" },
  { value: "deleted", label: "Apagados" },
];

export const CLASS_PILLS: { value: ClassFilter; label: string }[] = [
  { value: "all", label: "Todas as classes" },
  { value: "white", label: "White" },
  { value: "gray", label: "Gray" },
  { value: "black", label: "Black" },
];

export const CLASS_INFO: Record<Classification, { label: string; tone: Tone; hint: string }> = {
  white: { label: "White", tone: "success", hint: "Produto sem ressalvas." },
  gray: { label: "Gray", tone: "warning", hint: "Nicho ou promessa que pede atenção." },
  black: { label: "Black", tone: "destructive", hint: "Produto de alto risco." },
};
export const CLASS_NOTE = "Marcador interno de risco: o seller não vê e o checkout não muda.";

/* ───────── dados que vêm do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);
const cls = (v: unknown): Classification => (v === "gray" || v === "black" ? v : "white");

export interface ProductItem {
  id: string; name: string; description: string; price: number; status: string; classification: Classification;
  rejection_reason: string | null; image_url: string | null; checkout_url: string | null;
  created_at: string; updated_at: string | null; deleted_at: string | null;
  seller_user_id: string; seller_name: string; seller_email: string | null;
  attempts: number; sales: number; gross: number; refunds: number; refunded: number; chargebacks: number;
}
export interface ProductsSummary { live: number; pending_review: number; active: number; draft: number; inactive: number; deleted: number }
export interface ClassCounts { all: number; white: number; gray: number; black: number }
export interface ProductsPage { items: ProductItem[]; total: number; summary: ProductsSummary; classCounts: ClassCounts }

function parseItem(r: Record<string, unknown>): ProductItem {
  return {
    id: str(r.id), name: str(r.name) || "Produto sem nome", description: str(r.description), price: num(r.price), status: str(r.status),
    classification: cls(r.classification), rejection_reason: strOrNull(r.rejection_reason), image_url: strOrNull(r.image_url), checkout_url: strOrNull(r.checkout_url),
    created_at: str(r.created_at), updated_at: strOrNull(r.updated_at), deleted_at: strOrNull(r.deleted_at),
    seller_user_id: str(r.seller_user_id), seller_name: str(r.seller_name) || str(r.seller_email) || "Seller sem nome", seller_email: strOrNull(r.seller_email),
    attempts: num(r.attempts), sales: num(r.sales), gross: num(r.gross), refunds: num(r.refunds), refunded: num(r.refunded), chargebacks: num(r.chargebacks),
  };
}

export function parseProductsPage(raw: unknown): ProductsPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  const c = isObj(raw.class_counts) ? raw.class_counts : {};
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total),
    summary: { live: num(s.live), pending_review: num(s.pending_review), active: num(s.active), draft: num(s.draft), inactive: num(s.inactive), deleted: num(s.deleted) },
    classCounts: { all: num(c.all), white: num(c.white), gray: num(c.gray), black: num(c.black) },
  };
}

export interface ProductDetail {
  product: {
    id: string; name: string; description: string; price: number; status: string; classification: Classification; rejection_reason: string | null;
    image_url: string | null; checkout_url: string | null; created_at: string; updated_at: string | null; deleted_at: string | null; delivery_type: string | null;
    pix: boolean; card: boolean; boleto: boolean; timer: number | null; guarantee: boolean; address_required: boolean;
    affiliate_enabled: boolean; affiliate_commission: number; co_production_enabled: boolean; upsell_enabled: boolean; downsell_enabled: boolean;
  };
  seller: { user_id: string; name: string; email: string | null; phone: string | null; document_masked: string | null; account_status: string | null; products_total: number };
  stats: { attempts: number; sales: number; gross: number; net: number; fees: number; pending: number; failed: number; refunds: number; refunded: number; chargebacks: number; chargeback_amount: number };
  methods: { method: string; count: number; gross: number }[];
  recent_sales: { id: string; amount: number; status: string; payment_method: string | null; created_at: string; buyer: string }[];
  bumps: { id: string; name: string; price: number; is_active: boolean }[];
  disputes: { total: number; open: number; amount: number; items: { id: string; type: string; status: string; amount: number; created_at: string }[] };
  affiliate: { sales: number; commission: number };
  courses: { id: string; title: string; is_published: boolean }[];
  history: { id: string; action: string; created_at: string; admin_name: string | null; reason: string | null; from: string | null; to: string | null }[];
}

export function parseProductDetail(raw: unknown): ProductDetail {
  if (!isObj(raw) || !isObj(raw.product)) throw new Error("Resposta inesperada do servidor.");
  const p = raw.product; const s = isObj(raw.seller) ? raw.seller : {}; const st = isObj(raw.stats) ? raw.stats : {};
  const d = isObj(raw.disputes) ? raw.disputes : {}; const a = isObj(raw.affiliate) ? raw.affiliate : {};
  return {
    product: {
      id: str(p.id), name: str(p.name) || "Produto sem nome", description: str(p.description), price: num(p.price), status: str(p.status), classification: cls(p.classification),
      rejection_reason: strOrNull(p.rejection_reason), image_url: strOrNull(p.image_url), checkout_url: strOrNull(p.checkout_url),
      created_at: str(p.created_at), updated_at: strOrNull(p.updated_at), deleted_at: strOrNull(p.deleted_at), delivery_type: strOrNull(p.delivery_type),
      pix: p.pix === true, card: p.card === true, boleto: p.boleto === true, timer: p.timer == null ? null : num(p.timer),
      guarantee: p.guarantee === true, address_required: p.address_required === true,
      affiliate_enabled: p.affiliate_enabled === true, affiliate_commission: num(p.affiliate_commission),
      co_production_enabled: p.co_production_enabled === true, upsell_enabled: p.upsell_enabled === true, downsell_enabled: p.downsell_enabled === true,
    },
    seller: { user_id: str(s.user_id), name: str(s.name) || str(s.email) || "Seller sem nome", email: strOrNull(s.email), phone: strOrNull(s.phone), document_masked: strOrNull(s.document_masked), account_status: strOrNull(s.account_status), products_total: num(s.products_total) },
    stats: {
      attempts: num(st.attempts), sales: num(st.sales), gross: num(st.gross), net: num(st.net), fees: num(st.fees), pending: num(st.pending), failed: num(st.failed),
      refunds: num(st.refunds), refunded: num(st.refunded), chargebacks: num(st.chargebacks), chargeback_amount: num(st.chargeback_amount),
    },
    methods: arr(raw.methods).map((m) => ({ method: str(m.method), count: num(m.count), gross: num(m.gross) })),
    recent_sales: arr(raw.recent_sales).map((t) => ({ id: str(t.id), amount: num(t.amount), status: str(t.status), payment_method: strOrNull(t.payment_method), created_at: str(t.created_at), buyer: str(t.buyer) })),
    bumps: arr(raw.bumps).map((b) => ({ id: str(b.id), name: str(b.name) || "Produto removido", price: num(b.price), is_active: b.is_active !== false })),
    disputes: { total: num(d.total), open: num(d.open), amount: num(d.amount), items: arr(d.items).map((x) => ({ id: str(x.id), type: str(x.type), status: str(x.status), amount: num(x.amount), created_at: str(x.created_at) })) },
    affiliate: { sales: num(a.sales), commission: num(a.commission) },
    courses: arr(raw.courses).map((c) => ({ id: str(c.id), title: str(c.title) || "Curso sem título", is_published: c.is_published === true })),
    history: arr(raw.history).map((h) => {
      const det = isObj(h.details) ? h.details : {};
      return {
        id: str(h.id), action: str(h.action), created_at: str(h.created_at), admin_name: strOrNull(h.admin_name),
        reason: strOrNull(det.reason) ?? strOrNull(det.note), from: strOrNull(det.from), to: strOrNull(det.to) ?? strOrNull(det.classification),
      };
    }),
  };
}

/* ───────── situação, ações e textos ───────── */

export interface ProductLike { status: string; deleted_at: string | null }
export const isDeleted = (p: ProductLike) => p.deleted_at !== null;

export function statusInfo(p: ProductLike): { label: string; tone: Tone } {
  if (isDeleted(p)) return { label: "Apagado", tone: "destructive" };
  switch (p.status) {
    case "active": return { label: "Ativo", tone: "success" };
    case "pending_review": return { label: "Em revisão", tone: "warning" };
    case "inactive": return { label: "Inativo", tone: "neutral" };
    case "draft": return { label: "Rascunho", tone: "info" };
    default: return { label: "Situação desconhecida", tone: "neutral" };
  }
}

/** Ações que o servidor aceita para cada situação (o servidor confere de novo). */
export function availableActions(p: ProductLike): ProductAction[] {
  if (isDeleted(p)) return ["restore"];
  switch (p.status) {
    case "pending_review": return ["approve", "deactivate", "delete"];
    case "active": return ["review", "deactivate", "delete"];
    case "inactive": return ["approve", "review", "delete"];
    case "draft": return ["delete"];
    default: return [];
  }
}

export const actionLabel = (a: ProductAction, p: ProductLike) =>
  a === "approve" ? (p.status === "inactive" ? "Reativar" : "Aprovar")
    : a === "review" ? "Colocar em revisão" : a === "deactivate" ? "Desativar" : a === "delete" ? "Excluir" : "Restaurar";

export const actionNeedsReason = (a: ProductAction) => a !== "approve";
export const actionIsDanger = (a: ProductAction) => a === "deactivate" || a === "delete";

export function actionEffect(a: ProductAction, p: ProductLike): string {
  switch (a) {
    case "approve": return p.status === "inactive"
      ? "O produto volta ao ar e o checkout volta a vender. O seller recebe um aviso."
      : "O produto entra no ar e o checkout passa a vender. O seller recebe um aviso de aprovação.";
    case "review": return "O produto sai do ar até você aprovar de novo: o checkout deixa de vender. O seller vê o motivo.";
    case "deactivate": return "O produto sai do ar e o checkout deixa de vender. O seller vê o motivo. Vendas já feitas não mudam.";
    case "delete": return "O produto some da lista do seller e sai do ar. O histórico de vendas fica guardado e dá para restaurar depois.";
    case "restore": return "O produto volta para a lista do seller como inativo. Ele decide quando reativar.";
  }
}

export const REASON_PRESETS: Record<"review" | "deactivate" | "delete" | "restore", string[]> = {
  review: ["Promessa irreal de resultado", "Nicho não permitido", "Conteúdo ilegal", "Direitos autorais", "Descrição ou imagens de baixa qualidade"],
  deactivate: ["Promessa irreal de resultado", "Nicho não permitido", "Conteúdo ilegal", "Direitos autorais", "Muitas contestações"],
  delete: ["Produto duplicado", "A pedido do seller", "Conteúdo ilegal"],
  restore: [],
};

export const REASON_MIN = 5;
export const checkReason = (text: string) => (text.trim().length < REASON_MIN ? `Escreva o motivo (mínimo ${REASON_MIN} caracteres).` : null);

/* ───────── textos de apoio ───────── */

export const shortId = (id: string) => id.slice(0, 8);

export function saleStatus(s: string): { label: string; tone: Tone } {
  switch (s) {
    case "approved": case "paid": case "completed": return { label: "Paga", tone: "success" };
    case "partially_refunded": return { label: "Reembolso parcial", tone: "warning" };
    case "refunded": return { label: "Reembolsada", tone: "warning" };
    case "chargeback": return { label: "Chargeback", tone: "destructive" };
    case "disputed": return { label: "Em disputa", tone: "warning" };
    case "pending": case "waiting_payment": case "processing": return { label: "Aguardando pagamento", tone: "info" };
    case "failed": case "refused": return { label: "Recusada", tone: "neutral" };
    case "expired": return { label: "Expirada", tone: "neutral" };
    case "cancelled": case "canceled": return { label: "Cancelada", tone: "neutral" };
    default: return { label: "Outro status", tone: "neutral" };
  }
}

export function historyLabel(h: { action: string; from: string | null; to: string | null }): string {
  switch (h.action) {
    case "product_active": return h.from === "inactive" ? "Reativado" : "Aprovado";
    case "product_pending_review": return "Colocado em revisão";
    case "product_inactive": return "Desativado";
    case "product_deleted": return "Excluído";
    case "product_restored": return "Restaurado";
    case "product_classified": return h.to && h.to in CLASS_INFO ? `Classificado como ${CLASS_INFO[h.to as Classification].label}` : "Classificação alterada";
    // registros da tela antiga: ela gravava a auditoria mesmo quando a alteração não pegava
    case "product_blocked": return "Registro antigo de desativação";
    case "product_rejected": return "Registro antigo de revisão";
    default: return "Ação registrada";
  }
}

export const paymentLabel = (m: string | null) => (m === "pix" ? "Pix" : m === "credit_card" || m === "card" ? "Cartão" : m === "boleto" ? "Boleto" : m ? m : "Outro");

/** Taxa de aprovação das tentativas de compra; null quando ainda não houve tentativa. */
export const approvalRate = (sales: number, attempts: number) => (attempts > 0 ? Math.round((sales / attempts) * 1000) / 10 : null);
