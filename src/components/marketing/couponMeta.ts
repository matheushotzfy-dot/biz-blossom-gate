import type { Tables } from "@/integrations/supabase/types";
import type { TxTone } from "@/components/seller-ui/txMeta";
import { formatCurrency } from "@/lib/utils";

export type Coupon = Tables<"coupons">;
export type CouponState = "active" | "paused" | "expired" | "exhausted";

const SP = "America/Sao_Paulo";

export const isExpired = (c: Coupon, now = Date.now()) => !!c.expires_at && new Date(c.expires_at).getTime() < now;
export const isExhausted = (c: Coupon) => !!c.max_uses && c.current_uses >= c.max_uses;

/** Mesma ordem de prioridade que o checkout usa para recusar um cupom. */
export function couponState(c: Coupon, now = Date.now()): CouponState {
  if (isExpired(c, now)) return "expired";
  if (isExhausted(c)) return "exhausted";
  if (!c.is_active) return "paused";
  return "active";
}

export const STATE_META: Record<CouponState, { label: string; tone: TxTone }> = {
  active: { label: "Ativo", tone: "ok" },
  paused: { label: "Pausado", tone: "idle" },
  expired: { label: "Expirado", tone: "alert" },
  exhausted: { label: "Esgotado", tone: "wait" },
};

/** Cupom que o cliente ainda consegue usar agora. */
export const isUsable = (c: Coupon, now = Date.now()) => couponState(c, now) === "active";

export const CODE_MIN = 3;
export const CODE_MAX = 30;
export const PERCENT_MAX = 99;

/** O código só aceita letras, números, hífen e sublinhado (sem espaço nem acento). */
export const cleanCode = (raw: string) => raw.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9_-]/g, "").slice(0, CODE_MAX);

/** Sugestão de código fácil de ditar: sem I, O, 0 e 1. */
export function randomCode(prefix = "OFERTA"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const discountLabel = (c: Pick<Coupon, "discount_type" | "discount_value">) =>
  c.discount_type === "percentage" ? `${Number(c.discount_value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : formatCurrency(Number(c.discount_value));

/** Mesma conta do banco (validate_coupon): o cliente nunca paga menos de R$ 0,01. */
export function applyDiscount(type: string, value: number, price: number): { discount: number; final: number } {
  const raw = type === "percentage" ? Math.round(price * value) / 100 : value;
  const discount = Math.max(Math.min(raw, price - 0.01), 0);
  const d = Math.round(discount * 100) / 100;
  return { discount: d, final: Math.round((price - d) * 100) / 100 };
}

/** Lê "12,5" ou "1.250,50" como número; vazio ou inválido vira NaN. */
export function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (s === "") return NaN;
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

/** Hoje em São Paulo no formato AAAA-MM-DD (o que o campo de data usa). */
export const todayInput = (): string => new Date().toLocaleDateString("en-CA", { timeZone: SP });

/** Fim do dia em São Paulo: o cupom vale durante todo o último dia escolhido. */
export const endOfDayIso = (date: string): string => `${date}T23:59:59-03:00`;

/** Data (AAAA-MM-DD, horário de São Paulo) de um instante guardado no banco. */
export const toDateInput = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: SP }) : "");

export function addDaysInput(days: number): string {
  const [y, m, d] = todayInput().split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}

export const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: SP }).replace(/\./g, "");

/** Texto de validade para a lista; `soon` marca cupons que vencem em até 7 dias. */
export function expiryNote(c: Coupon, now = Date.now()): { text: string; sub?: string; soon?: boolean; past?: boolean } {
  if (!c.expires_at) return { text: "Sem prazo" };
  const end = new Date(c.expires_at).getTime();
  const label = dayLabel(c.expires_at);
  if (end < now) return { text: label, sub: "Já expirou", past: true };
  const left = Math.ceil((end - now) / 864e5);
  if (left <= 1) return { text: label, sub: "Expira hoje", soon: true };
  if (left <= 7) return { text: label, sub: `Expira em ${left} dias`, soon: true };
  return { text: label, sub: `Em ${left} dias` };
}

/** Traduz os erros do banco em frases que o vendedor entende. */
export function couponErrorMessage(err: { code?: string; message?: string } | null | undefined, fallback: string): string {
  const m = (err?.message || "").toLowerCase();
  if (err?.code === "23505" || m.includes("duplicate")) return "Você já tem um cupom com esse código.";
  if (m.includes("rate_limit")) return "Você criou cupons demais em pouco tempo. Espere um minuto e tente de novo.";
  if (m.includes("porcentagem")) return "A porcentagem precisa ficar entre 1% e 99%.";
  if (m.includes("positivo")) return "O valor do desconto precisa ser maior que zero.";
  if (m.includes("jwt") || m.includes("401")) return "Sua sessão expirou. Entre de novo para continuar.";
  return fallback;
}
