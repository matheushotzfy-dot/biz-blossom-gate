import { csvCell } from "@/features/admin-finance/topSellersExport";
import { approvalRate } from "@/features/admin-products/productsModel";
import type { Classification } from "@/features/admin-products/productsModel";

export const PAGE_SIZE = 25;
export type SortKey = "gross" | "sales" | "risk";

export const SORT_PILLS: { value: SortKey; label: string }[] = [
  { value: "gross", label: "Mais faturaram" },
  { value: "sales", label: "Mais vendas" },
  { value: "risk", label: "Mais contestações" },
];

export const SORT_NOTE: Record<SortKey, string> = {
  gross: "Ordenados pelo valor das vendas pagas no período.",
  sales: "Ordenados pelo número de vendas pagas no período.",
  risk: "Ordenados por reembolsos somados a chargebacks no período.",
};

export interface TopProduct {
  product_id: string; name: string; image_url: string | null; price: number;
  product_status: string; deleted: boolean; classification: Classification;
  seller_user_id: string; seller_name: string; seller_email: string | null;
  rank: number; attempts: number; sales: number; gross: number; net: number; fees: number; buyers: number;
  refunds: number; refunded: number; chargebacks: number; chargeback_amount: number;
}

export interface TopSummary {
  gross: number; sales: number; net: number; fees: number; selling: number; without_sales: number;
  refunds: number; refunded: number; chargebacks: number; chargeback_amount: number;
}

export interface TopProductsPage { items: TopProduct[]; total: number; summary: TopSummary; generatedAt: string | null }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const cls = (v: unknown): Classification => (v === "gray" || v === "black" ? v : "white");

function parseItem(r: Record<string, unknown>): TopProduct {
  return {
    product_id: str(r.product_id), name: str(r.name) || "Produto sem nome", image_url: str(r.image_url) || null, price: num(r.price),
    product_status: str(r.product_status), deleted: r.deleted === true, classification: cls(r.classification),
    seller_user_id: str(r.seller_user_id), seller_name: str(r.seller_name) || str(r.seller_email) || "Seller sem nome", seller_email: str(r.seller_email) || null,
    rank: num(r.rank), attempts: num(r.attempts), sales: num(r.sales), gross: num(r.gross), net: num(r.net), fees: num(r.fees), buyers: num(r.buyers),
    refunds: num(r.refunds), refunded: num(r.refunded), chargebacks: num(r.chargebacks), chargeback_amount: num(r.chargeback_amount),
  };
}

export function parseTopProducts(raw: unknown): TopProductsPage {
  if (!isObj(raw) || !Array.isArray(raw.items) || !isObj(raw.summary)) throw new Error("Resposta inesperada do servidor.");
  const s = raw.summary;
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total), generatedAt: str(raw.generated_at) || null,
    summary: {
      gross: num(s.gross), sales: num(s.sales), net: num(s.net), fees: num(s.fees), selling: num(s.selling), without_sales: num(s.without_sales),
      refunds: num(s.refunds), refunded: num(s.refunded), chargebacks: num(s.chargebacks), chargeback_amount: num(s.chargeback_amount),
    },
  };
}

export const ticket = (p: Pick<TopProduct, "gross" | "sales">) => (p.sales > 0 ? p.gross / p.sales : 0);
export const approval = (p: Pick<TopProduct, "sales" | "attempts">) => approvalRate(p.sales, p.attempts);
/** Quanto do faturamento do período (de todos os produtos) é deste produto, em %, com uma casa. */
export const share = (gross: number, total: number) => (total > 0 ? Math.round((gross / total) * 1000) / 10 : 0);
export const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

export function productStateLabel(p: Pick<TopProduct, "deleted" | "product_status">): string | null {
  if (p.deleted) return "Apagado";
  if (p.product_status === "active") return null;
  if (p.product_status === "inactive") return "Inativo";
  if (p.product_status === "pending_review") return "Em revisão";
  if (p.product_status === "draft") return "Rascunho";
  return null;
}

export function topProductsCSV(rows: TopProduct[], from: string, to: string, totalGross: number): string {
  const header = ["Posição", "Início", "Fim", "Produto ID", "Produto", "Situação", "Seller", "E-mail do seller", "Vendas", "Tentativas", "Faturamento", "Líquido", "Taxas", "Ticket médio", "Aprovação %", "Compradores", "Participação %", "Reembolsos", "Valor reembolsado", "Chargebacks", "Valor chargeback"];
  const body = rows.map((p) => [
    p.rank, from, to, p.product_id, p.name, productStateLabel(p) ?? "Ativo", p.seller_name, p.seller_email ?? "",
    p.sales, p.attempts, p.gross.toFixed(2), p.net.toFixed(2), p.fees.toFixed(2), ticket(p).toFixed(2), (approval(p) ?? 0).toFixed(1), p.buyers,
    share(p.gross, totalGross).toFixed(1), p.refunds, p.refunded.toFixed(2), p.chargebacks, p.chargeback_amount.toFixed(2),
  ]);
  return "﻿" + [header, ...body].map((r) => r.map(csvCell).join(";")).join("\r\n");
}
