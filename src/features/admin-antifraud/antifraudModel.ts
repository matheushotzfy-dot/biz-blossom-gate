import { useEffect, useState } from "react";

export const PAGE_SIZE = 25;
export const RADAR_WINDOWS = [30, 90, 180, 365] as const;
export type RadarWindow = (typeof RADAR_WINDOWS)[number];
/** Abaixo disso o seller fica em "poucas vendas": 1 chargeback em 1 venda não é 100% de risco. */
export const RADAR_MIN_SALES = 10;
export const RADAR_HIGH = 1.5;
export const RADAR_WATCH = 0.5;

/** Valor com atraso, para a busca não consultar o banco a cada tecla. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

function page<T, S>(raw: unknown, row: (r: Record<string, unknown>) => T, summary: (s: Record<string, unknown>) => S): { items: T[]; total: number; summary: S } {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  return { items: raw.items.filter(isObj).map(row), total: num(raw.total), summary: summary(isObj(raw.summary) ? raw.summary : {}) };
}

/* ───────── blacklist ───────── */

export type EntryType = "cpf" | "cnpj" | "email" | "ip" | "bin";
export const ENTRY_TYPES: { value: EntryType; label: string; placeholder: string; hint: string }[] = [
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00", hint: "Barra qualquer compra feita com esse CPF." },
  { value: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00", hint: "Barra qualquer compra feita com esse CNPJ." },
  { value: "email", label: "E-mail", placeholder: "pessoa@exemplo.com", hint: "Maiúsculas e minúsculas contam como o mesmo e-mail." },
  { value: "ip", label: "IP", placeholder: "203.0.113.7", hint: "Um endereço só, sem faixa. Cuidado: redes de operadora dividem o mesmo IP entre muitas pessoas." },
  { value: "bin", label: "BIN do cartão", placeholder: "411111", hint: "Os 6 primeiros dígitos do cartão. Barra todos os cartões desse emissor/produto." },
];
export const entryLabel = (t: string) => ENTRY_TYPES.find((e) => e.value === t)?.label ?? "Outro";

/** Espelha as regras do servidor para avisar antes de enviar; quem decide é `admin_blacklist_add`. */
export function checkBlacklistInput(type: EntryType, rawValue: string, reason: string): string | null {
  const v = rawValue.trim();
  if (!v) return "Informe o valor que será bloqueado.";
  const digits = v.replace(/\D/g, "");
  if (type === "cpf" && digits.length !== 11) return "O CPF precisa ter 11 dígitos.";
  if (type === "cnpj" && digits.length !== 14) return "O CNPJ precisa ter 14 dígitos.";
  if (type === "bin" && digits.length !== 6) return "O BIN precisa ter 6 dígitos.";
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "E-mail inválido.";
  if (type === "ip" && (v.includes("/") || !/^[\d.]+$|^[0-9a-fA-F:]+$/.test(v))) return "Informe um IP único, sem faixa (/24).";
  if (reason.trim().length < 3) return "Explique o motivo (mínimo 3 caracteres).";
  return null;
}

export interface BlacklistItem {
  id: string; entry_type: string; entry_value: string; reason: string; is_active: boolean;
  created_at: string; updated_at: string; added_by_name: string | null;
}
export interface BlacklistSummary { all: number; active: number; removed: number }
export type BlacklistStatus = "active" | "removed" | "all";
export const parseBlacklistPage = (raw: unknown) => page<BlacklistItem, BlacklistSummary>(raw,
  (r) => ({ id: str(r.id), entry_type: str(r.entry_type), entry_value: str(r.entry_value), reason: str(r.reason), is_active: r.is_active === true,
    created_at: str(r.created_at), updated_at: str(r.updated_at), added_by_name: strOrNull(r.added_by_name) }),
  (s) => ({ all: num(s.all), active: num(s.active), removed: num(s.removed) }));

/* ───────── radar de chargeback ───────── */

export type RadarLevel = "high" | "watch" | "ok" | "few";
export type RadarFilter = RadarLevel | "all";
export interface RadarItem {
  user_id: string; full_name: string | null; email: string | null; frozen: boolean; sales: number; chargebacks: number; refunds: number;
  chargeback_amount: number; cb_rate: number; refund_rate: number; level: RadarLevel;
}
export interface RadarSummary { sellers: number; high: number; watch: number; ok: number; few: number; sales: number; chargebacks: number; chargeback_amount: number }
const LEVELS: RadarLevel[] = ["high", "watch", "ok", "few"];
export const parseRadarPage = (raw: unknown) => page<RadarItem, RadarSummary>(raw,
  (r) => ({ user_id: str(r.user_id), full_name: strOrNull(r.full_name), email: strOrNull(r.email), frozen: r.frozen === true, sales: num(r.sales),
    chargebacks: num(r.chargebacks), refunds: num(r.refunds), chargeback_amount: num(r.chargeback_amount), cb_rate: num(r.cb_rate), refund_rate: num(r.refund_rate),
    level: LEVELS.includes(r.level as RadarLevel) ? (r.level as RadarLevel) : "few" }),
  (s) => ({ sellers: num(s.sellers), high: num(s.high), watch: num(s.watch), ok: num(s.ok), few: num(s.few), sales: num(s.sales), chargebacks: num(s.chargebacks), chargeback_amount: num(s.chargeback_amount) }));

export const levelLabel = (l: RadarLevel) => ({ high: "Em risco", watch: "Atenção", ok: "Em dia", few: "Poucas vendas" })[l];
export const levelTone = (l: RadarLevel): "destructive" | "warning" | "success" | "muted" => ({ high: "destructive", watch: "warning", ok: "success", few: "muted" } as const)[l];
export const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/** Frase que explica por que o seller está nessa faixa (a tela nunca mostra só a cor). */
export function levelReason(i: Pick<RadarItem, "level" | "chargebacks" | "sales" | "cb_rate">): string {
  const base = `${plural(i.chargebacks, "chargeback", "chargebacks")} em ${plural(i.sales, "venda paga", "vendas pagas")}`;
  if (i.level === "few") return `${base}. Com menos de ${RADAR_MIN_SALES} vendas a taxa não diz nada ainda.`;
  if (i.level === "high") return `${base}: ${pct(i.cb_rate)}, acima do limite de ${pct(RADAR_HIGH)}.`;
  if (i.level === "watch") return `${base}: ${pct(i.cb_rate)}, acima de ${pct(RADAR_WATCH)}.`;
  return `${base}: ${pct(i.cb_rate)}.`;
}

/* ───────── velocity ───────── */

export type RuleAction = "block" | "flag";
export interface VelocityRule {
  id: string; rule_name: string; rule_type: string; is_enabled: boolean; max_attempts: number;
  time_window_minutes: number; threshold_amount: number | null; action: RuleAction;
}
export const parseRules = (raw: unknown): VelocityRule[] => {
  if (!Array.isArray(raw)) throw new Error("Resposta inesperada do servidor.");
  return raw.filter(isObj).map((r) => ({
    id: str(r.id), rule_name: str(r.rule_name), rule_type: str(r.rule_type), is_enabled: r.is_enabled === true,
    max_attempts: num(r.max_attempts), time_window_minutes: num(r.time_window_minutes),
    threshold_amount: r.threshold_amount === null || r.threshold_amount === undefined ? null : num(r.threshold_amount),
    action: r.action === "block" ? "block" : "flag",
  }));
};

export function fmtWindow(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes % 1440 === 0) { const d = minutes / 1440; return d === 1 ? "1 dia" : `${d} dias`; }
  if (minutes % 60 === 0) { const h = minutes / 60; return h === 1 ? "1 hora" : `${h} horas`; }
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

const RULE_COPY: Record<string, { title: string; who: string }> = {
  ip_card_fail: { title: "Cartões recusados em sequência", who: "o mesmo IP ou e-mail" },
  ip_attempts: { title: "Muitas tentativas do mesmo IP", who: "o mesmo IP" },
  email_high_value: { title: "Muitas compras do mesmo e-mail", who: "o mesmo e-mail" },
};
export const ruleTitle = (r: Pick<VelocityRule, "rule_type" | "rule_name">) => RULE_COPY[r.rule_type]?.title ?? r.rule_name;

/** "Barra a compra quando o mesmo IP já fez 10 tentativas nos últimos 5 minutos." */
export function ruleSentence(r: Pick<VelocityRule, "rule_type" | "max_attempts" | "time_window_minutes" | "threshold_amount" | "action">): string {
  const who = RULE_COPY[r.rule_type]?.who ?? "o mesmo comprador";
  const win = fmtWindow(r.time_window_minutes);
  const verb = r.action === "block" ? "Barra a compra" : "Só registra na trilha, sem barrar,";
  const what = r.rule_type === "ip_card_fail" ? "recusas de cartão" : r.rule_type === "ip_attempts" ? "tentativas de compra" : r.threshold_amount ? "compras de valor alto" : "compras";
  const min = r.rule_type === "email_high_value" && r.threshold_amount ? ` (cada uma de pelo menos R$ ${r.threshold_amount.toLocaleString("pt-BR")})` : "";
  return `${verb} quando ${who} já tem ${r.max_attempts} ${what}${min} nos últimos ${win}.`;
}

export interface RuleDraft { enabled: boolean; max: string; window: string; threshold: string; action: RuleAction }
export const draftFromRule = (r: VelocityRule): RuleDraft => ({
  enabled: r.is_enabled, max: String(r.max_attempts), window: String(r.time_window_minutes),
  threshold: r.threshold_amount === null ? "" : String(r.threshold_amount), action: r.action,
});
export const hasThreshold = (r: Pick<VelocityRule, "rule_type">) => r.rule_type === "email_high_value";
export function draftDirty(r: VelocityRule, d: RuleDraft): boolean {
  const t = hasThreshold(r) ? d.threshold.trim() : "";
  const was = r.threshold_amount === null ? "" : String(r.threshold_amount);
  return d.enabled !== r.is_enabled || d.max.trim() !== String(r.max_attempts) || d.window.trim() !== String(r.time_window_minutes)
    || d.action !== r.action || (hasThreshold(r) && t !== was);
}
export interface RuleValue { enabled: boolean; max: number; window: number; threshold: number | null; action: RuleAction }
export function validateDraft(r: VelocityRule, d: RuleDraft): { error: string | null; value?: RuleValue } {
  const max = Number(d.max); const win = Number(d.window);
  if (!/^\d+$/.test(d.max.trim()) || max < 1 || max > 1000) return { error: "O máximo de tentativas deve ficar entre 1 e 1000." };
  if (!/^\d+$/.test(d.window.trim()) || win < 1 || win > 10080) return { error: "A janela deve ficar entre 1 minuto e 7 dias (10.080 minutos)." };
  let threshold: number | null = null;
  if (hasThreshold(r) && d.threshold.trim()) {
    threshold = Number(d.threshold.replace(",", "."));
    if (!Number.isFinite(threshold) || threshold < 0) return { error: "O valor mínimo precisa ser um número igual ou maior que zero." };
  }
  return { error: null, value: { enabled: d.enabled, max, window: win, threshold, action: d.action } };
}

/* ───────── trilha de bloqueios ───────── */

export type TrailType = "all" | "blacklist" | "velocity" | "manual";
export interface TrailItem {
  id: string; created_at: string; block_type: string; block_reason: string; matched_type: string | null; matched_value: string | null;
  customer_email: string | null; customer_document: string | null; customer_ip: string | null; seller_name: string | null;
  product_name: string | null; outcome: "blocked" | "flagged";
}
export interface TrailSummary { all: number; blacklist: number; velocity: number; manual: number; today: number }
export const parseTrailPage = (raw: unknown) => page<TrailItem, TrailSummary>(raw,
  (r) => ({ id: str(r.id), created_at: str(r.created_at), block_type: str(r.block_type), block_reason: str(r.block_reason), matched_type: strOrNull(r.matched_type),
    matched_value: strOrNull(r.matched_value), customer_email: strOrNull(r.customer_email), customer_document: strOrNull(r.customer_document),
    customer_ip: strOrNull(r.customer_ip), seller_name: strOrNull(r.seller_name), product_name: strOrNull(r.product_name), outcome: r.outcome === "flagged" ? "flagged" : "blocked" }),
  (s) => ({ all: num(s.all), blacklist: num(s.blacklist), velocity: num(s.velocity), manual: num(s.manual), today: num(s.today) }));

export const trailTypeLabel = (t: string) => ({ blacklist: "Blacklist", velocity: "Velocidade", manual: "Manual" } as Record<string, string>)[t] ?? "Outro";
/** "email = x@y.com" / "regra: Cartões recusados" em português simples. */
export function trailMatch(i: Pick<TrailItem, "block_type" | "matched_type" | "matched_value">): string {
  if (!i.matched_value) return "—";
  if (i.block_type === "blacklist") return `${entryLabel(i.matched_type ?? "")}: ${i.matched_value}`;
  return `Regra: ${RULE_COPY[i.matched_type ?? ""]?.title ?? i.matched_value}`;
}

/* ───────── resumo do topo ───────── */

export interface Overview { blacklist_active: number; rules_enabled: number; rules_total: number; blocked_today: number; sellers_high: number; sellers_watch: number }
export function parseOverview(raw: unknown): Overview {
  if (!isObj(raw)) throw new Error("Resposta inesperada do servidor.");
  return { blacklist_active: num(raw.blacklist_active), rules_enabled: num(raw.rules_enabled), rules_total: num(raw.rules_total),
    blocked_today: num(raw.blocked_today), sellers_high: num(raw.sellers_high), sellers_watch: num(raw.sellers_watch) };
}
