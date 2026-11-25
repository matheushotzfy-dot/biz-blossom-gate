import type { Tone } from "@/features/admin-disputes/disputesModel";

export const PAGE_SIZE = 25;
export type { Tone };
export type View = "affiliates" | "products";
export type FilterValue = "all" | "selling" | "idle" | "held";

export const FILTER_PILLS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "selling", label: "Com vendas" },
  { value: "idle", label: "Sem vendas" },
  { value: "held", label: "Pausados" },
];

/* ───────── dados que vêm do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);

export interface AffiliateItem {
  user_id: string; name: string; email: string | null; account_status: string | null;
  links: number; links_active: number; links_held: number; clicks: number; products: number; sellers: number;
  sales: number; refunded: number; revenue: number; commission: number; reversed: number; last_sale_at: string | null; hold_reason: string | null;
}
export interface AffiliatesSummary { all: number; selling: number; idle: number; held: number }
export interface ProgramTotals { affiliates: number; links: number; links_active: number; links_held: number; clicks: number; sales: number; refunded: number; revenue: number; commission: number; reversed: number }
export interface AffiliatesPage { items: AffiliateItem[]; total: number; summary: AffiliatesSummary; program: ProgramTotals }

function parseAffiliate(r: Record<string, unknown>): AffiliateItem {
  return {
    user_id: str(r.user_id), name: str(r.name) || str(r.email) || "Afiliado sem nome", email: strOrNull(r.email), account_status: strOrNull(r.account_status),
    links: num(r.links), links_active: num(r.links_active), links_held: num(r.links_held), clicks: num(r.clicks), products: num(r.products), sellers: num(r.sellers),
    sales: num(r.sales), refunded: num(r.refunded), revenue: num(r.revenue), commission: num(r.commission), reversed: num(r.reversed),
    last_sale_at: strOrNull(r.last_sale_at), hold_reason: strOrNull(r.hold_reason),
  };
}

export function parseAffiliatesPage(raw: unknown): AffiliatesPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  const p = isObj(raw.program) ? raw.program : {};
  return {
    items: raw.items.filter(isObj).map(parseAffiliate), total: num(raw.total),
    summary: { all: num(s.all), selling: num(s.selling), idle: num(s.idle), held: num(s.held) },
    program: {
      affiliates: num(p.affiliates), links: num(p.links), links_active: num(p.links_active), links_held: num(p.links_held), clicks: num(p.clicks),
      sales: num(p.sales), refunded: num(p.refunded), revenue: num(p.revenue), commission: num(p.commission), reversed: num(p.reversed),
    },
  };
}

export interface ProductItem {
  product_id: string; name: string; price: number | null; status: string | null; deleted: boolean; affiliate_enabled: boolean; commission_pct: number | null;
  seller_user_id: string | null; seller_name: string; seller_email: string | null;
  affiliates: number; links: number; links_active: number; clicks: number; sales: number; refunded: number; revenue: number; commission: number;
}
export interface ProductsPage { items: ProductItem[]; total: number; summary: { open: number; with_links: number; with_sales: number } }

export function parseProductsPage(raw: unknown): ProductsPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  return {
    items: raw.items.filter(isObj).map((r) => ({
      product_id: str(r.product_id), name: str(r.name) || "Produto sem nome", price: numOrNull(r.price), status: strOrNull(r.status), deleted: r.deleted === true,
      affiliate_enabled: r.affiliate_enabled === true, commission_pct: numOrNull(r.commission_pct),
      seller_user_id: strOrNull(r.seller_user_id), seller_name: str(r.seller_name) || str(r.seller_email) || "Seller sem nome", seller_email: strOrNull(r.seller_email),
      affiliates: num(r.affiliates), links: num(r.links), links_active: num(r.links_active), clicks: num(r.clicks),
      sales: num(r.sales), refunded: num(r.refunded), revenue: num(r.revenue), commission: num(r.commission),
    })),
    total: num(raw.total),
    summary: { open: num(s.open), with_links: num(s.with_links), with_sales: num(s.with_sales) },
  };
}

export interface LinkRow {
  id: string; slug: string; clicks: number; commission_pct: number; is_active: boolean; paused_by_owner: boolean; created_at: string;
  hold_reason: string | null; hold_at: string | null;
  product_id: string; product_name: string | null; product_deleted: boolean; product_status: string | null; product_open: boolean;
  seller_user_id: string; seller_name: string; sales: number; commission: number;
}
export interface SaleRow { id: string; status: string; sale_amount: number; commission_pct: number; commission_amount: number; created_at: string; product_name: string | null; seller_name: string }
export interface AffiliateDetail {
  affiliate: { user_id: string; name: string; email: string | null; account_status: string | null };
  stats: { links: number; links_active: number; links_held: number; clicks: number; sales: number; refunded: number; revenue: number; commission: number; reversed: number };
  links: LinkRow[]; sales: SaleRow[];
  history: { id: string; action: string; created_at: string; admin_name: string | null; reason: string | null; links: number | null }[];
}

export function parseAffiliateDetail(raw: unknown): AffiliateDetail {
  if (!isObj(raw) || !isObj(raw.affiliate)) throw new Error("Resposta inesperada do servidor.");
  const a = raw.affiliate, s = isObj(raw.stats) ? raw.stats : {};
  return {
    affiliate: { user_id: str(a.user_id), name: str(a.name) || "Afiliado sem nome", email: strOrNull(a.email), account_status: strOrNull(a.account_status) },
    stats: {
      links: num(s.links), links_active: num(s.links_active), links_held: num(s.links_held), clicks: num(s.clicks), sales: num(s.sales), refunded: num(s.refunded),
      revenue: num(s.revenue), commission: num(s.commission), reversed: num(s.reversed),
    },
    links: arr(raw.links).map((l) => ({
      id: str(l.id), slug: str(l.slug), clicks: num(l.clicks), commission_pct: num(l.commission_pct), is_active: l.is_active === true, paused_by_owner: l.paused_by_owner === true,
      created_at: str(l.created_at), hold_reason: strOrNull(l.hold_reason), hold_at: strOrNull(l.hold_at),
      product_id: str(l.product_id), product_name: strOrNull(l.product_name), product_deleted: l.product_deleted === true, product_status: strOrNull(l.product_status), product_open: l.product_open === true,
      seller_user_id: str(l.seller_user_id), seller_name: str(l.seller_name) || "Seller sem nome", sales: num(l.sales), commission: num(l.commission),
    })),
    sales: arr(raw.sales).map((t) => ({
      id: str(t.id), status: str(t.status), sale_amount: num(t.sale_amount), commission_pct: num(t.commission_pct), commission_amount: num(t.commission_amount),
      created_at: str(t.created_at), product_name: strOrNull(t.product_name), seller_name: str(t.seller_name) || "Seller sem nome",
    })),
    history: arr(raw.history).map((h) => {
      const det = isObj(h.details) ? h.details : {};
      return { id: str(h.id), action: str(h.action), created_at: str(h.created_at), admin_name: strOrNull(h.admin_name), reason: strOrNull(det.reason), links: numOrNull(det.links) };
    }),
  };
}

/* ───────── textos ───────── */

export function affiliateState(a: Pick<AffiliateItem, "links" | "links_active" | "links_held">): { label: string; tone: Tone } {
  if (a.links_held > 0) return { label: "Pausado pela equipe", tone: "destructive" };
  if (a.links_active > 0) return { label: "Link no ar", tone: "success" };
  return { label: a.links === 0 ? "Sem link" : "Nenhum link no ar", tone: "neutral" };
}

/** Aviso quando uma parte grande das vendas do afiliado foi estornada (pouca venda não conta). */
export function refundAttention(a: { sales: number; refunded: number }): string | null {
  const total = a.sales + a.refunded;
  if (total < 4 || a.refunded === 0 || a.refunded / total < 0.25) return null;
  return `${a.refunded} de ${total} vendas estornadas`;
}

/** Situação real de um link: o que o checkout faz com ele agora. */
export function linkState(l: Pick<LinkRow, "is_active" | "paused_by_owner" | "hold_at" | "product_deleted" | "product_status" | "product_open">): { label: string; tone: Tone } {
  if (l.hold_at) return { label: "Pausado pela equipe", tone: "destructive" };
  if (l.product_deleted) return { label: "Produto apagado", tone: "neutral" };
  if (l.product_status !== "active") return { label: "Produto fora do ar", tone: "warning" };
  if (!l.product_open) return { label: "Programa fechado", tone: "warning" };
  if (!l.is_active) return { label: l.paused_by_owner ? "Pausado pelo seller" : "Pausado", tone: "neutral" };
  return { label: "No ar", tone: "success" };
}

export function productProgramState(p: Pick<ProductItem, "deleted" | "status" | "affiliate_enabled">): { label: string; tone: Tone } {
  if (p.deleted) return { label: "Produto apagado", tone: "neutral" };
  if (p.status !== "active") return { label: "Produto fora do ar", tone: "warning" };
  if (!p.affiliate_enabled) return { label: "Programa fechado", tone: "neutral" };
  return { label: "Aberto a afiliados", tone: "success" };
}

export function saleStatus(s: string): { label: string; tone: Tone } {
  if (s === "approved") return { label: "Paga", tone: "success" };
  if (s === "refunded") return { label: "Estornada", tone: "warning" };
  return { label: "Outro status", tone: "neutral" };
}

export function pctLabel(v: number | null): string {
  return v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Vendas pagas ÷ cliques, limitado a 100% (o clique é contado com limite por link). */
export function conversionLabel(sales: number, clicks: number): string {
  if (clicks <= 0) return "sem cliques ainda";
  const pct = Math.min(100, (sales / clicks) * 100);
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% viraram venda`;
}

export function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function historyLabel(action: string, links: number | null = null): string {
  const n = links == null ? "" : links === 1 ? " (1 link)" : ` (${links} links)`;
  switch (action) {
    case "affiliate_hold": return `Pausado pela equipe${n}`;
    case "affiliate_release": return `Liberado para o seller reativar${n}`;
    default: return "Ação registrada";
  }
}

export const HOLD_PRESETS = ["Autoafiliação suspeita", "Venda com cartão de terceiros", "Muitos estornos", "Divulgação enganosa", "Pedido do seller"];
export const REASON_MIN = 5;
export const checkReason = (text: string) => (text.trim().length < REASON_MIN ? `Escreva o motivo (mínimo ${REASON_MIN} caracteres).` : null);
