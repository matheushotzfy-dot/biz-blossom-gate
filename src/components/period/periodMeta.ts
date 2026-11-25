/**
 * Regras do seletor de período (puras, sem React). O painel e os testes usam o mesmo código.
 * Datas aqui são sempre "dia do calendário" em horário local, com "hoje" tomado em São Paulo.
 */
import { addDays, differenceInCalendarDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodPresetId = "today" | "yesterday" | "7d" | "15d" | "30d" | "90d" | "month" | "last_month";

export interface PeriodValue {
  /** null = intervalo escolhido no calendário */
  presetId: PeriodPresetId | null;
  from: Date;
  to: Date;
}

/** Intervalo máximo aceito (dias, contando os dois extremos). Protege as telas de consultas enormes. */
export const MAX_PERIOD_DAYS = 366;
/** Primeiro dia que o calendário mostra. */
export const MIN_PERIOD_DATE = new Date(2020, 0, 1);

/** Data "hoje" no fuso de São Paulo, normalizada para meia-noite local. */
export function todayInSaoPaulo(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

export interface PresetDef {
  id: PeriodPresetId;
  label: string;
  hint: string;
  build: (today: Date) => { from: Date; to: Date };
}

const upTo = (today: Date, back: number) => ({ from: startOfDay(subDays(today, back)), to: endOfDay(today) });

export const PERIOD_PRESETS: PresetDef[] = [
  { id: "today", label: "Hoje", hint: "Movimento do dia", build: (t) => upTo(t, 0) },
  { id: "yesterday", label: "Ontem", hint: "O dia anterior", build: (t) => { const y = subDays(t, 1); return { from: startOfDay(y), to: endOfDay(y) }; } },
  { id: "7d", label: "7 dias", hint: "A última semana", build: (t) => upTo(t, 6) },
  { id: "15d", label: "15 dias", hint: "A última quinzena", build: (t) => upTo(t, 14) },
  { id: "30d", label: "30 dias", hint: "Os últimos 30 dias", build: (t) => upTo(t, 29) },
  { id: "90d", label: "90 dias", hint: "Os últimos 3 meses", build: (t) => upTo(t, 89) },
  { id: "month", label: "Este mês", hint: "Do dia 1 até hoje", build: (t) => ({ from: startOfMonth(t), to: endOfDay(t) }) },
  { id: "last_month", label: "Mês passado", hint: "O mês fechado", build: (t) => { const m = subMonths(t, 1); return { from: startOfMonth(m), to: endOfDay(endOfMonth(m)) }; } },
];

export function presetRange(id: PeriodPresetId, today: Date = todayInSaoPaulo()) {
  const preset = PERIOD_PRESETS.find((p) => p.id === id) ?? PERIOD_PRESETS[0];
  return preset.build(today);
}

export function buildPeriod(id: PeriodPresetId, today: Date = todayInSaoPaulo()): PeriodValue {
  const preset = PERIOD_PRESETS.find((p) => p.id === id) ?? PERIOD_PRESETS[0];
  return { presetId: preset.id, ...preset.build(today) };
}

/** Últimos 365 dias como intervalo livre: usado quando a busca global leva a uma venda que pode ser antiga. */
export function yearPeriod(today: Date = todayInSaoPaulo()): PeriodValue {
  return { presetId: null, from: startOfDay(subDays(today, 364)), to: endOfDay(today) };
}

const sameDay = (a: Date, b: Date) => differenceInCalendarDays(a, b) === 0;

/** Se o intervalo escolhido é exatamente um dos atalhos, devolve qual (para marcar o atalho e rotular certo). */
export function matchPreset(from: Date, to: Date, today: Date = todayInSaoPaulo()): PeriodPresetId | null {
  for (const p of PERIOD_PRESETS) {
    const r = p.build(today);
    if (sameDay(r.from, from) && sameDay(r.to, to)) return p.id;
  }
  return null;
}

/** Quantos dias o intervalo cobre, contando os dois extremos. */
export function spanDays(from: Date, to: Date): number {
  return Math.abs(differenceInCalendarDays(to, from)) + 1;
}

export type RangeProblem = "future" | "too_old" | "too_long" | null;

export function rangeProblem(from: Date, to: Date, today: Date = todayInSaoPaulo()): RangeProblem {
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  if (differenceInCalendarDays(hi, today) > 0) return "future";
  if (differenceInCalendarDays(lo, MIN_PERIOD_DATE) < 0) return "too_old";
  if (spanDays(lo, hi) > MAX_PERIOD_DAYS) return "too_long";
  return null;
}

export const PROBLEM_TEXT: Record<Exclude<RangeProblem, null>, string> = {
  future: "Não dá para escolher uma data que ainda não chegou.",
  too_old: "Escolha uma data a partir de 2020.",
  too_long: "O período pode ter no máximo 1 ano (366 dias).",
};

const short = (d: Date, withYear: boolean) => format(d, withYear ? "dd MMM yyyy" : "dd MMM", { locale: ptBR }).replace(/\./g, "");

/** Texto curto para o botão que abre o seletor. O ano só aparece quando não é o ano de hoje. */
export function periodLabel(value: PeriodValue | undefined, today: Date = todayInSaoPaulo()): string {
  if (!value) return "Escolher período";
  if (value.presetId) return PERIOD_PRESETS.find((p) => p.id === value.presetId)?.label ?? "Período";
  const year = today.getFullYear();
  const withYear = value.from.getFullYear() !== year || value.to.getFullYear() !== year;
  return sameDay(value.from, value.to) ? short(value.from, withYear) : `${short(value.from, withYear)} a ${short(value.to, withYear)}`;
}

/** Frase para o rodapé do painel. */
export function periodSummary(from: Date | null, to: Date | null): string {
  if (!from) return "Escolha a data inicial.";
  if (!to) return "Escolha a data final, ou aplique só este dia.";
  const days = spanDays(from, to);
  return `${short(from, true)} a ${short(to, true)} · ${days} ${days === 1 ? "dia" : "dias"}`;
}

/* ───────────── Datas digitadas ───────────── */

export const formatBrDate = (d: Date) => format(d, "dd/MM/yyyy");

/** Vai colocando as barras enquanto a pessoa digita: 24112026 → 24/11/2026. */
export function maskBrDate(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Lê dd/mm/aaaa (ou dd/mm/aa). Devolve null para data que não existe, como 31/02. */
export function parseBrDate(text: string): Date | null {
  const m = /^(\d{1,2})[/.\-\s]?(\d{1,2})[/.\-\s]?(\d{4}|\d{2})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

/** Próximo dia (para navegar com o teclado). */
export const nextDay = (d: Date, delta: number) => addDays(d, delta);
