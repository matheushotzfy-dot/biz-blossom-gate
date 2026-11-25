import { csvCell } from "./topSellersExport";

export interface AuditRow {
  id: string; created_at: string; action: string; actor_role: string | null; actor_name: string | null; actor_email: string | null;
  seller_name: string | null; seller_email: string | null; reason: string | null; amount: number;
  balance_before: number | null; balance_after: number | null;
}
export type AuditGroup = "all" | "ajuste" | "reembolso" | "chargeback" | "disputa";
export interface AuditSummary { total: number; ajuste: number; reembolso: number; chargeback: number; disputa: number }
export interface AuditPage { rows: AuditRow[]; total: number; summary: AuditSummary }

export const PAGE = 50;
export const EXPORT_PAGE = 200;
export const EXPORT_CAP = 5000;

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function parseAuditPage(raw: unknown): AuditPage {
  const r = raw as { rows?: unknown; total?: unknown; summary?: Record<string, unknown> } | null;
  if (!r || !Array.isArray(r.rows)) throw new Error("Resposta inesperada do servidor.");
  const s = r.summary ?? {};
  return {
    rows: (r.rows as AuditRow[]).map((x) => ({ ...x, amount: num(x.amount), balance_before: x.balance_before == null ? null : num(x.balance_before), balance_after: x.balance_after == null ? null : num(x.balance_after) })),
    total: num(r.total),
    summary: { total: num(s.total), ajuste: num(s.ajuste), reembolso: num(s.reembolso), chargeback: num(s.chargeback), disputa: num(s.disputa) },
  };
}

const ACTION_LABEL: Record<string, string> = {
  ajuste_credito: "Ajuste de saldo: crédito", ajuste_debito: "Ajuste de saldo: débito", reembolso: "Reembolso", chargeback: "Chargeback",
  disputa_bloqueio: "Disputa: saldo bloqueado", disputa_liberacao: "Disputa: saldo liberado", disputa_taxa: "Disputa: taxa",
  disputa_em_analise: "Disputa: em análise", disputa_ganha: "Disputa: ganha", disputa_perdida: "Disputa: perdida",
};
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? "Ação registrada";
const ROLE_LABEL: Record<string, string> = { admin: "Dono", manager: "Gerente", employee: "Funcionário", sistema: "Sistema", seller: "Seller" };
export const roleLabel = (r: string | null) => (r ? ROLE_LABEL[r] ?? r : "");
export const who = (r: Pick<AuditRow, "actor_name" | "actor_email" | "actor_role">) => r.actor_name || r.actor_email || (r.actor_role === "sistema" ? "Sistema" : "—");

const money = (v: number | null) => (v == null ? "" : v.toFixed(2).replace(".", ","));

/** CSV para Excel em português: ";" como separador, vírgula decimal, BOM, e células iniciadas por = + - @ ficam inofensivas. */
export function auditCsv(rows: AuditRow[], fmtDate: (iso: string) => string): string {
  const head = ["Data", "Ação", "Seller", "E-mail do seller", "Responsável", "Cargo", "Justificativa", "Valor", "Saldo antes", "Saldo depois"].map(csvCell).join(";");
  const lines = rows.map((r) => [fmtDate(r.created_at), actionLabel(r.action), r.seller_name ?? "", r.seller_email ?? "", who(r), roleLabel(r.actor_role), r.reason ?? "", money(r.amount), money(r.balance_before), money(r.balance_after)].map(csvCell).join(";"));
  return "﻿" + [head, ...lines].join("\r\n");
}
