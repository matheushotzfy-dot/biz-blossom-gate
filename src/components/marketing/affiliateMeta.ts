import type { TxTone } from "@/components/seller-ui/txMeta";
import { getCheckoutLink } from "@/components/products/productPresentation";

export type AffiliateLink = {
  id: string; product_id: string; affiliate_user_id: string; owner_user_id: string;
  slug: string; commission_pct: number; clicks: number; is_active: boolean; created_at: string;
  /** true quando foi o produtor (ou o encerramento do programa) que pausou: o afiliado não consegue reativar sozinho. */
  paused_by_owner: boolean;
};
export type AffiliateSale = {
  id: string; affiliate_link_id: string; transaction_id: string; product_id: string;
  affiliate_user_id: string; seller_user_id: string; sale_amount: number;
  commission_amount: number; commission_pct: number; status: string; created_at: string;
};
/** Produto como o afiliado enxerga (catálogo público). */
export type CatalogProduct = {
  id: string; name: string; price: number; image_url: string | null; affiliate_commission: number | null;
  display_name: string | null; delivery_type: string | null; checkout_url: string | null; created_at?: string | null;
};

export const COMMISSION_MIN = 1;
export const COMMISSION_MAX = 90;
export const COMMISSION_DEFAULT = 30;

export const SALE_STATUS: Record<string, { label: string; tone: TxTone }> = {
  approved: { label: "Paga", tone: "ok" },
  pending: { label: "Pendente", tone: "wait" },
  refunded: { label: "Reembolsada", tone: "idle" },
};

/** Código curto e estável para identificar um afiliado sem mostrar dados dele. */
export const affiliateCode = (userId: string): string => userId.replace(/-/g, "").slice(0, 4).toUpperCase();

/** Link que o afiliado divulga: a página de pagamento do produto com a referência dele. */
export function affiliateUrl(checkoutUrl: string | null | undefined, slug: string): string {
  const base = checkoutUrl ? getCheckoutLink(checkoutUrl) : "";
  return base ? `${base}?aff=${encodeURIComponent(slug)}` : "";
}

/** A comissão incide sobre o valor líquido da venda (depois das taxas), como em apply_transaction_splits. */
export const commissionOf = (net: number, pct: number) => Math.round(net * pct) / 100;

export const shortUrl = (url: string) => url.replace(/^https?:\/\//, "");

/** Produto aprovado (pago) e ainda não reembolsado conta como venda do programa. */
export const isPaidSale = (s: AffiliateSale) => s.status === "approved";

export const sinceLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(/\./g, "");

export function affiliateErrorMessage(err: { code?: string; message?: string } | null | undefined, fallback: string): string {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("jwt") || m.includes("401")) return "Sua sessão expirou. Entre de novo para continuar.";
  if (m.includes("rate") && m.includes("limit")) return "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.";
  if (m.includes("permission") || m.includes("row-level")) return "Você não tem permissão para esta ação.";
  return fallback;
}
