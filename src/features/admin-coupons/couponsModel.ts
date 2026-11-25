import type { Tone } from "@/features/admin-disputes/disputesModel";
import { brl } from "@/features/admin-finance/types";

export const PAGE_SIZE = 25;
export type { Tone };
export type StatusFilter = "all" | "active" | "paused" | "expired" | "exhausted";
export type CouponState = "active" | "paused" | "held" | "expired" | "exhausted";

export const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "paused", label: "Pausados" },
  { value: "expired", label: "Expirados" },
  { value: "exhausted", label: "Esgotados" },
];

/* ───────── dados que vêm do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);
const state = (v: unknown): CouponState => (v === "paused" || v === "held" || v === "expired" || v === "exhausted" ? v : "active");

export interface CouponItem {
  id: string; code: string; state: CouponState; discount_type: "percentage" | "fixed"; discount_value: number; apply_to_bumps: boolean;
  max_uses: number | null; current_uses: number; is_active: boolean; expires_at: string | null; created_at: string;
  hold_reason: string | null; hold_at: string | null;
  product_id: string | null; product_name: string | null; product_deleted: boolean;
  seller_user_id: string; seller_name: string; seller_email: string | null;
  sales: number; buyers: number; discount: number; gross: number; open_reservations: number;
}
export interface CouponsSummary { all: number; active: number; paused: number; expired: number; exhausted: number; held: number; full_discount: number; sales: number; buyers: number; discount: number }
export interface CouponsPage { items: CouponItem[]; total: number; summary: CouponsSummary }

function parseItem(r: Record<string, unknown>): CouponItem {
  return {
    id: str(r.id), code: str(r.code) || "(sem código)", state: state(r.state), discount_type: r.discount_type === "fixed" ? "fixed" : "percentage", discount_value: num(r.discount_value),
    apply_to_bumps: r.apply_to_bumps === true, max_uses: numOrNull(r.max_uses), current_uses: num(r.current_uses), is_active: r.is_active === true,
    expires_at: strOrNull(r.expires_at), created_at: str(r.created_at), hold_reason: strOrNull(r.hold_reason), hold_at: strOrNull(r.hold_at),
    product_id: strOrNull(r.product_id), product_name: strOrNull(r.product_name), product_deleted: r.product_deleted === true,
    seller_user_id: str(r.seller_user_id), seller_name: str(r.seller_name) || str(r.seller_email) || "Seller sem nome", seller_email: strOrNull(r.seller_email),
    sales: num(r.sales), buyers: num(r.buyers), discount: num(r.discount), gross: num(r.gross), open_reservations: num(r.open_reservations),
  };
}

export function parseCouponsPage(raw: unknown): CouponsPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total),
    summary: { all: num(s.all), active: num(s.active), paused: num(s.paused), expired: num(s.expired), exhausted: num(s.exhausted), held: num(s.held), full_discount: num(s.full_discount), sales: num(s.sales), buyers: num(s.buyers), discount: num(s.discount) },
  };
}

export interface CouponSale { id: string; status: string; amount: number; discount_amount: number; payment_method: string | null; created_at: string; buyer_name: string | null; buyer_email: string | null; simulated: boolean }
export interface CouponDetail {
  coupon: Omit<CouponItem, "product_id" | "product_name" | "product_deleted" | "seller_user_id" | "seller_name" | "seller_email" | "sales" | "buyers" | "discount" | "gross" | "open_reservations">;
  product: { id: string; name: string; price: number; deleted: boolean } | null;
  seller: { user_id: string; name: string; email: string | null; account_status: string | null };
  stats: { sales: number; buyers: number; discount: number; gross: number; refunds: number; chargebacks: number; open_reservations: number; lost: number; simulated: number };
  sales: CouponSale[];
  history: { id: string; action: string; created_at: string; admin_name: string | null; reason: string | null }[];
}

export function parseCouponDetail(raw: unknown): CouponDetail {
  if (!isObj(raw) || !isObj(raw.coupon)) throw new Error("Resposta inesperada do servidor.");
  const c = raw.coupon, s = isObj(raw.seller) ? raw.seller : {}, st = isObj(raw.stats) ? raw.stats : {}, p = isObj(raw.product) ? raw.product : null;
  return {
    coupon: {
      id: str(c.id), code: str(c.code) || "(sem código)", state: state(c.state), discount_type: c.discount_type === "fixed" ? "fixed" : "percentage", discount_value: num(c.discount_value),
      apply_to_bumps: c.apply_to_bumps === true, max_uses: numOrNull(c.max_uses), current_uses: num(c.current_uses), is_active: c.is_active === true,
      expires_at: strOrNull(c.expires_at), created_at: str(c.created_at), hold_reason: strOrNull(c.hold_reason), hold_at: strOrNull(c.hold_at),
    },
    product: p ? { id: str(p.id), name: str(p.name) || "Produto sem nome", price: num(p.price), deleted: p.deleted === true } : null,
    seller: { user_id: str(s.user_id), name: str(s.name) || "Seller sem nome", email: strOrNull(s.email), account_status: strOrNull(s.account_status) },
    stats: {
      sales: num(st.sales), buyers: num(st.buyers), discount: num(st.discount), gross: num(st.gross), refunds: num(st.refunds), chargebacks: num(st.chargebacks),
      open_reservations: num(st.open_reservations), lost: num(st.lost), simulated: num(st.simulated),
    },
    sales: arr(raw.sales).map((t) => ({
      id: str(t.id), status: str(t.status), amount: num(t.amount), discount_amount: num(t.discount_amount), payment_method: strOrNull(t.payment_method),
      created_at: str(t.created_at), buyer_name: strOrNull(t.buyer_name), buyer_email: strOrNull(t.buyer_email), simulated: t.simulated === true,
    })),
    history: arr(raw.history).map((h) => {
      const det = isObj(h.details) ? h.details : {};
      return { id: str(h.id), action: str(h.action), created_at: str(h.created_at), admin_name: strOrNull(h.admin_name), reason: strOrNull(det.reason) };
    }),
  };
}

/* ───────── textos ───────── */

export function stateInfo(s: CouponState): { label: string; tone: Tone } {
  switch (s) {
    case "active": return { label: "Ativo", tone: "success" };
    case "exhausted": return { label: "Esgotado", tone: "warning" };
    case "expired": return { label: "Expirado", tone: "neutral" };
    case "paused": return { label: "Pausado pelo seller", tone: "neutral" };
    case "held": return { label: "Pausado pela equipe", tone: "destructive" };
  }
}

/** "10%" ou "R$ 25,00": o mesmo desconto que o checkout aplica. */
export function discountLabel(c: { discount_type: string; discount_value: number }): string {
  if (c.discount_type === "fixed") return brl(c.discount_value);
  return `${c.discount_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Cupom de 100% entrega o produto de graça: vale destacar para o admin. */
export const isFullDiscount = (c: { discount_type: string; discount_value: number }) => c.discount_type === "percentage" && c.discount_value >= 100;

/** "38 de 100 usos" com limite, "2 usos" sem limite. */
export const usesLabel = (c: { current_uses: number; max_uses: number | null }) =>
  c.max_uses == null
    ? `${c.current_uses.toLocaleString("pt-BR")} ${c.current_uses === 1 ? "uso" : "usos"}`
    : `${c.current_uses.toLocaleString("pt-BR")} de ${c.max_uses.toLocaleString("pt-BR")} usos`;

/** Só o dia, no fuso de São Paulo. */
export function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Validade em uma frase curta, ou `null` quando não expira. */
export function expiryLabel(c: { expires_at: string | null }, now = Date.now()): string | null {
  if (!c.expires_at) return null;
  const t = new Date(c.expires_at).getTime();
  if (Number.isNaN(t)) return null;
  return t < now ? `Expirou em ${dayLabel(c.expires_at)}` : `Vale até ${dayLabel(c.expires_at)}`;
}

export function historyLabel(action: string): string {
  switch (action) {
    case "coupon_hold": return "Pausado pela equipe";
    case "coupon_release": return "Liberado para o seller ativar";
    default: return "Ação registrada";
  }
}

export const HOLD_PRESETS = ["Desconto usado para fraude", "Autocompra do seller", "Cupom de 100% sem justificativa", "Denúncia de comprador", "Desconto acima do combinado"];
export const REASON_MIN = 5;
export const checkReason = (text: string) => (text.trim().length < REASON_MIN ? `Escreva o motivo (mínimo ${REASON_MIN} caracteres).` : null);
