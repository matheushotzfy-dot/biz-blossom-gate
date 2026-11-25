import type { Tables } from "@/integrations/supabase/types";
import { csvCell } from "@/features/admin-finance/topSellersExport";
import { fmtDateTime } from "@/features/admin-finance/format";
import { deriveTransactionStatus } from "@/lib/utils";

export type Tx = Tables<"transactions">;
export type StatusKey = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";

export const PAGE_SIZE = 80;
export const EXPORT_PAGE = 200;
export const EXPORT_CAP = 10_000;
/** Taxa de chargeback a partir da qual o painel avisa. */
export const CHARGEBACK_ALERT_PCT = 1;

export interface TxSummary { total: number; gross: number; net: number; fees: number; approved: number; pending: number; failed: number; refunded: number; chargeback: number; chargeback_amount: number; refunded_amount: number }
export const EMPTY_SUMMARY: TxSummary = { total: 0, gross: 0, net: 0, fees: 0, approved: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0, chargeback_amount: 0, refunded_amount: 0 };

export interface TxPage { items: Tx[]; total: number; summary: TxSummary }

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function parseSummary(raw: unknown): TxSummary {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...EMPTY_SUMMARY };
  for (const k of Object.keys(out) as (keyof TxSummary)[]) out[k] = num(r[k]);
  return out;
}

/** Valida a resposta da RPC: sem lista de itens, é erro (não "nenhuma transação"). */
export function parsePage(raw: unknown): TxPage {
  const r = raw as { items?: unknown; total?: unknown; summary?: unknown; totals?: unknown } | null;
  if (!r || !Array.isArray(r.items)) throw new Error("Resposta inesperada do servidor.");
  return { items: r.items as Tx[], total: num(r.total), summary: parseSummary(r.summary ?? r.totals) };
}

export const approvalRate = (s: TxSummary): number => (s.total ? (s.approved / s.total) * 100 : 0);
/** Chargebacks sobre (aprovadas + chargebacks): é a conta que as bandeiras acompanham. */
export const chargebackRate = (s: TxSummary): number => (s.approved + s.chargeback ? (s.chargeback / (s.approved + s.chargeback)) * 100 : 0);
export const pct = (v: number, digits = 1): string => `${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const METHOD_LABEL: Record<string, string> = { pix: "Pix", credit_card: "Cartão", boleto: "Boleto" };
export const methodLabel = (m: string | null | undefined): string => (m ? METHOD_LABEL[m] ?? m : "—");

const SITUATION: Record<string, string> = { approved: "Aprovada", pending: "Pendente", expired: "Expirada", error: "Recusada", cancelled: "Cancelada", refunded: "Estornada", chargeback: "Chargeback", med: "MED Pix em análise", med_lost: "MED Pix perdido" };
export const situationLabel = (t: Pick<Tx, "status" | "payment_method" | "created_at" | "pix_expires_at">): string => {
  const s = deriveTransactionStatus(t);
  return SITUATION[s] ?? s;
};

export function exportPlan(total: number): { count: number; pages: number; truncated: boolean } {
  const count = Math.min(Math.max(0, total), EXPORT_CAP);
  return { count, pages: Math.ceil(count / EXPORT_PAGE), truncated: total > EXPORT_CAP };
}

const money = (v: unknown): string => num(v).toFixed(2).replace(".", ",");

/** CSV para Excel em português: separador ";", vírgula decimal, BOM, e células que começam com = + - @ ficam inofensivas. */
export function transactionsCsv(rows: Tx[], nameOf: (userId: string) => string, productOf: (productId: string | null) => string): string {
  const header = ["ID", "ID externo", "Data (Brasília)", "Cliente", "E-mail", "Documento", "Seller", "Produto", "Método", "Valor", "Desconto", "Taxa", "Líquido", "Situação", "Origem"];
  const body = rows.map((t) => [
    t.id, t.external_id ?? "", fmtDateTime(t.created_at), t.customer_name ?? "", t.customer_email ?? "", t.customer_document ?? "",
    nameOf(t.user_id), productOf(t.product_id), methodLabel(t.payment_method), money(t.amount), money(t.discount_amount), money(t.fee_amount), money(t.net_amount),
    situationLabel(t), t.source ?? "checkout",
  ]);
  return "﻿" + [header, ...body].map((r) => r.map(csvCell).join(";")).join("\r\n");
}
