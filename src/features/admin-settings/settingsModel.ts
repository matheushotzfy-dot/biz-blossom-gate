import { brl } from "@/features/admin-finance/types";

/* Regras e leitura das Configurações do admin. Puro (sem React), testado em src/test/admin-settings.test.tsx. */

export type FeeKind = "percentage" | "fixed";
export interface FeeRow { id: string; name: string; fee_type: FeeKind; value: number }
export interface ReleaseOverride { user_id: string; name: string; email: string | null; days: number; updated_at: string | null }
export interface HistoryItem { id: string; action: string; created_at: string; admin_name: string | null; details: Record<string, unknown> }

export interface SettingsData {
  fees: FeeRow[];
  individualFeeSellers: number;
  maxTicket: { value: number; configured: boolean; updatedAt: string | null; updatedBy: string | null; individual: number };
  release: { globalDays: number; updatedAt: string | null; updatedBy: string | null; overrides: ReleaseOverride[]; overridesTotal: number };
  signup: { requireEmailVerification: boolean; configured: boolean; updatedAt: string | null; updatedBy: string | null };
  history: HistoryItem[];
  generatedAt: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, d = 0) => { const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : d; };
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

export function parseSettings(raw: unknown): SettingsData {
  if (!isObj(raw) || !Array.isArray(raw.fees)) throw new Error("Resposta inesperada das configurações");
  const t = isObj(raw.max_ticket) ? raw.max_ticket : {};
  const r = isObj(raw.release) ? raw.release : {};
  const s = isObj(raw.signup) ? raw.signup : {};
  return {
    fees: raw.fees.filter(isObj).filter((f) => typeof f.id === "string" && typeof f.name === "string").map((f) => ({
      id: String(f.id), name: String(f.name), fee_type: f.fee_type === "percentage" ? "percentage" : "fixed", value: num(f.value),
    })),
    individualFeeSellers: num(raw.individual_fee_sellers),
    maxTicket: { value: num(t.value, 10000), configured: t.configured === true, updatedAt: strOrNull(t.updated_at), updatedBy: strOrNull(t.updated_by), individual: num(t.individual) },
    release: {
      globalDays: num(r.global_days, 7), updatedAt: strOrNull(r.updated_at), updatedBy: strOrNull(r.updated_by), overridesTotal: num(r.overrides_total),
      overrides: (Array.isArray(r.overrides) ? r.overrides : []).filter(isObj).filter((o) => typeof o.user_id === "string").map((o) => ({
        user_id: String(o.user_id), name: strOrNull(o.name) ?? "Seller sem nome", email: strOrNull(o.email), days: num(o.days, 7), updated_at: strOrNull(o.updated_at),
      })),
    },
    signup: { requireEmailVerification: s.require_email_verification !== false, configured: s.configured === true, updatedAt: strOrNull(s.updated_at), updatedBy: strOrNull(s.updated_by) },
    history: (Array.isArray(raw.history) ? raw.history : []).filter(isObj).filter((h) => typeof h.id === "string").map((h) => ({
      id: String(h.id), action: String(h.action ?? ""), created_at: String(h.created_at ?? ""), admin_name: strOrNull(h.admin_name), details: isObj(h.details) ? h.details : {},
    })),
    generatedAt: strOrNull(raw.generated_at),
  };
}

/* ───────── taxas ───────── */

export type FeeGroupId = "pix" | "card" | "boleto" | "withdrawal" | "other" | "extra";
interface FeeMeta { group: FeeGroupId; label: string; short: string; hint?: string }

// Os nomes são o contrato com o banco (o gatilho do saque e `split_transaction_fee` procuram por eles): a tela só troca o valor.
const FEE_META: Record<string, FeeMeta> = {
  "Taxa PIX": { group: "pix", label: "Percentual por venda", short: "Pix, percentual" },
  "Taxa Fixa PIX": { group: "pix", label: "Valor fixo por venda", short: "Pix, valor fixo" },
  "Taxa Cartão": { group: "card", label: "Percentual por venda", short: "Cartão, percentual" },
  "Taxa Fixa Cartão": { group: "card", label: "Valor fixo por venda", short: "Cartão, valor fixo" },
  "Taxa Boleto Percentual": { group: "boleto", label: "Percentual por venda", short: "Boleto, percentual" },
  "Taxa Fixa Boleto": { group: "boleto", label: "Valor fixo por venda", short: "Boleto, valor fixo" },
  "Taxa Boleto": { group: "boleto", label: "Valor fixo de reserva", short: "Boleto, valor fixo de reserva", hint: "Só vale quando o valor fixo por venda não existe." },
  "Taxa de Saque": { group: "withdrawal", label: "Valor por saque", short: "Saque", hint: "Descontado de cada saque pedido a partir de agora." },
  "Taxa Fixa por Transação": { group: "other", label: "Valor fixo por venda", short: "Outros meios, valor fixo", hint: "Para vendas que não são Pix, cartão nem boleto." },
};

export const FEE_GROUPS: { id: FeeGroupId; title: string }[] = [
  { id: "pix", title: "Pix" }, { id: "card", title: "Cartão de crédito" }, { id: "boleto", title: "Boleto" },
  { id: "withdrawal", title: "Saque" }, { id: "other", title: "Outros meios" }, { id: "extra", title: "Outras taxas" },
];

export interface FeeLine extends FeeRow { label: string; hint?: string }
export function groupFees(fees: FeeRow[]): { id: FeeGroupId; title: string; lines: FeeLine[] }[] {
  const rank = (n: string) => Object.keys(FEE_META).indexOf(n);
  return FEE_GROUPS.map((g) => ({
    ...g,
    lines: fees
      .filter((f) => (FEE_META[f.name]?.group ?? "extra") === g.id)
      .sort((a, b) => (rank(a.name) - rank(b.name)) || a.name.localeCompare(b.name))
      .map((f) => ({ ...f, label: FEE_META[f.name]?.label ?? f.name, hint: FEE_META[f.name]?.hint })),
  })).filter((g) => g.lines.length > 0);
}
export const feeShortName = (name: string) => FEE_META[name]?.short ?? name;

export const feeLimit = (f: Pick<FeeRow, "fee_type" | "name">) => (f.fee_type === "percentage" ? 50 : f.name === "Taxa de Saque" ? 500 : 100);

export function fmtFee(kind: FeeKind, value: number): string {
  return kind === "percentage" ? `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : brl(value);
}
/** Valor como o admin digita (vírgula decimal, sem símbolo). */
export const feeInputText = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** Lê o que foi digitado: `5`, `5,5`, `5.49`, `4,99`. Sem milhar (a maior taxa é R$ 500). */
export function checkFee(text: string, fee: Pick<FeeRow, "fee_type" | "name">): { value: number } | { error: string } {
  const t = text.trim();
  if (!t) return { error: "Informe o valor." };
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(t)) return { error: "Use só números, com até 2 casas decimais." };
  const value = Number(t.replace(",", "."));
  const max = feeLimit(fee);
  if (value > max) return { error: `O máximo é ${fmtFee(fee.fee_type, max)}.` };
  return { value };
}

/* ───────── limite de ticket ───────── */

export const TICKET_MIN = 1;
export const TICKET_MAX = 1_000_000;
export function checkTicket(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return "Informe o limite.";
  if (value < TICKET_MIN || value > TICKET_MAX) return `O limite fica entre ${brl(TICKET_MIN)} e ${brl(TICKET_MAX)}.`;
  return null;
}

export type TicketScope = "new" | "all";
export const TICKET_SCOPES: { value: TicketScope; title: string; hint: (current: number, individual: number) => string }[] = [
  { value: "new", title: "Só para quem criar conta depois", hint: (cur) => `Quem já tem conta continua com ${brl(cur)}.` },
  { value: "all", title: "Para todos os sellers", hint: (_c, ind) => (ind > 0 ? `Apaga ${ind} ${ind === 1 ? "limite individual" : "limites individuais"}.` : "Ninguém tem limite individual hoje.") },
];

/* ───────── prazo do cartão ───────── */

export const RELEASE_OPTIONS = [1, 7, 15, 30] as const;
export const releaseLabel = (d: number) => `D+${d}`;

/* ───────── motivo ───────── */

export const REASON_MIN = 5;
export const checkReason = (text: string): string | null => (text.trim().length < REASON_MIN ? "Escreva o motivo (mínimo 5 caracteres)." : null);

export const REASON_PRESETS = {
  fees: ["Acordo comercial com os sellers", "Voltar ao padrão da plataforma"],
  ticket: ["Reduzir o risco de fraude", "Liberar vendas de ticket mais alto", "Padronizar para todos"],
  release: ["Reduzir o risco de chargeback", "Seller com histórico limpo", "Voltar ao padrão"],
  email: ["Ainda sem envio de e-mail configurado", "Teste interno"],
} as const;

/* ───────── histórico ───────── */

const d = (v: unknown) => (isObj(v) ? v : {});
export interface HistoryLine { title: string; detail: string | null; reason: string | null }

export function describeHistory(h: HistoryItem): HistoryLine {
  const x = d(h.details);
  const reason = typeof x.reason === "string" && x.reason.trim() ? x.reason.trim() : null;
  switch (h.action) {
    case "platform_fee_update": {
      const kind: FeeKind = x.fee_type === "percentage" ? "percentage" : "fixed";
      return { title: "Taxa alterada", detail: `${feeShortName(String(x.name ?? "Taxa"))}: ${fmtFee(kind, num(x.from))} → ${fmtFee(kind, num(x.to))}`, reason };
    }
    case "custom_fees_reset": {
      const n = num(x.sellers);
      return { title: "Taxas individuais zeradas", detail: `${n} ${n === 1 ? "seller voltou" : "sellers voltaram"} ao padrão`, reason };
    }
    case "max_ticket_set":
      return { title: "Limite de ticket alterado", detail: `${brl(num(x.from))} → ${brl(num(x.to))} · ${x.scope === "all" ? "para todos" : "só para quem criar conta depois"}`, reason };
    case "card_release_set":
      return { title: x.scope === "seller" ? "Prazo do cartão de um seller" : "Prazo padrão do cartão", detail: `${releaseLabel(num(x.from))} → ${releaseLabel(num(x.to))}`, reason };
    case "card_release_clear":
      return { title: "Prazo individual removido", detail: `${releaseLabel(num(x.from))} → ${releaseLabel(num(x.to))} (padrão)`, reason };
    case "email_verification_set":
      return { title: x.enabled === true ? "Confirmação de e-mail ligada" : "Confirmação de e-mail desligada", detail: null, reason };
    default:
      return { title: "Mudança registrada", detail: null, reason };
  }
}

/** "há 3 min", "ontem às 14:05"… no horário de Brasília. */
export function whenLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr} h`;
  return new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " às");
}
