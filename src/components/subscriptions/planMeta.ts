import { parseBRL } from "@/components/seller-ui/money";
import type { PlanFormValues } from "./types";

export const PLAN_INTERVALS = [
  { value: "daily", label: "Todo dia", per: "por dia" },
  { value: "weekly", label: "Toda semana", per: "por semana" },
  { value: "monthly", label: "Todo mês", per: "por mês" },
  { value: "yearly", label: "Todo ano", per: "por ano" },
] as const;

export const PLAN_NAME_MAX = 80;
export const PLAN_MIN_PRICE = 1;
export const PLAN_MAX_TRIAL = 365;

export type PlanErrors = Partial<Record<"name" | "price" | "trial", string>>;

/** Dias de teste: só inteiros de 0 a 365 (vazio vale 0). */
export function trialDays(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), PLAN_MAX_TRIAL) : 0;
}

export function validatePlan(v: PlanFormValues): PlanErrors {
  const errors: PlanErrors = {};
  if (v.name.trim().length < 2) errors.name = "Dê um nome ao plano (pelo menos 2 letras).";
  const price = parseBRL(v.price);
  if (price < PLAN_MIN_PRICE) errors.price = "O preço mínimo é R$ 1,00.";
  const trial = Number(v.trial === "" ? 0 : v.trial);
  if (!Number.isInteger(trial) || trial < 0 || trial > PLAN_MAX_TRIAL) errors.trial = `Use um número de 0 a ${PLAN_MAX_TRIAL}.`;
  return errors;
}

/** "R$ 49,90 por mês, com 7 dias de teste grátis" — o resumo que a pessoa confere antes de criar. */
export function planSummary(v: PlanFormValues): string {
  const price = parseBRL(v.price);
  const per = PLAN_INTERVALS.find((i) => i.value === v.interval)?.per ?? "por mês";
  if (price <= 0) return "Defina o preço";
  const money = price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const trial = trialDays(v.trial);
  return `${money} ${per}${trial > 0 ? `, com ${trial} ${trial === 1 ? "dia" : "dias"} de teste grátis` : ""}`;
}

/** Erro do servidor em linguagem do seller (pausa da equipe, plano com assinantes). */
export function planErrorMessage(err: { message?: string } | null | undefined, fallback: string): string {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("equipe pausou")) return "A equipe pausou este plano. Fale com o suporte para liberar.";
  if (m.includes("tem assinantes")) return "Este plano tem assinantes e não pode ser apagado. Pause o plano em vez disso.";
  if (m.includes("pelo menos r$ 1") || m.includes("valid_price")) return "O preço do plano precisa ser de pelo menos R$ 1,00.";
  if (m.includes("produto seu")) return "Escolha um produto seu para este plano.";
  if (m.includes("jwt") || m.includes("401")) return "Sua sessão expirou. Entre de novo para continuar.";
  if (m.includes("permission") || m.includes("row-level")) return "Você não tem permissão para esta ação.";
  return fallback;
}
