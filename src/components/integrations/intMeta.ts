import type { TxTone } from "@/components/seller-ui/txMeta";

const TZ = "America/Sao_Paulo";

/** Mensagem de erro de uma edge function (o corpo vem em `error.context`). */
export async function functionErrorMessage(err: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (err as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json()) as { error?: string; message?: string };
      const msg = body?.error || body?.message;
      if (msg && msg.length < 160) return msg;
    }
  } catch { /* corpo ilegível: usa o texto padrão */ }
  return fallback;
}

export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }).replace(/\./g, "");

/** "18 jan 2027": curta, sem os "de" do dateLabel, para linhas apertadas. */
export const dateShort = (iso: string) => {
  const parts = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((x) => x.type === t)?.value.replace(/\./g, "") ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`;
};

export const dateTimeLabel = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(/\./g, "");

/** "agora", "há 5 min", "há 3 h", "há 2 dias" e, depois de uma semana, a data. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 8) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return dateLabel(iso);
}

/** Dias inteiros até uma data (negativo se já passou). */
export const daysUntil = (iso: string, now = Date.now()) => Math.ceil((new Date(iso).getTime() - now) / 86_400_000);

/* ── Chaves de API ── */
export interface ApiKeyRow {
  id: string; name: string; public_key: string; secret_key_prefix: string; is_active: boolean;
  created_at: string; last_used_at: string | null; expires_at: string | null; revoked_at: string | null;
}
export type KeyState = "active" | "paused" | "expired" | "revoked";

export const KEY_STATE: Record<KeyState, { label: string; tone: TxTone }> = {
  active: { label: "Ativa", tone: "ok" },
  paused: { label: "Pausada", tone: "idle" },
  expired: { label: "Expirada", tone: "alert" },
  revoked: { label: "Revogada", tone: "idle" },
};

export function keyState(k: ApiKeyRow, now = Date.now()): KeyState {
  if (k.revoked_at) return "revoked";
  if (k.expires_at && new Date(k.expires_at).getTime() <= now) return "expired";
  return k.is_active ? "active" : "paused";
}

/** "pk_live_AbCd…WxYz": o suficiente para reconhecer a chave sem mostrar tudo. */
export const shortKey = (key: string) => (key.length > 18 ? `${key.slice(0, 12)}…${key.slice(-4)}` : key);

export const KEY_NAME_MAX = 100;
/** Faltando até isto, a chave pede troca. */
export const KEY_EXPIRING_DAYS = 14;
const DAY_MS = 86_400_000;

/** Quanto da validade ainda resta (0 a 1) e quantos dias inteiros faltam; sem validade, a vida é cheia e `days` fica nulo. */
export function keyLife(k: Pick<ApiKeyRow, "created_at" | "expires_at">, now = Date.now()): { fraction: number; days: number | null } {
  if (!k.expires_at) return { fraction: 1, days: null };
  const end = new Date(k.expires_at).getTime();
  const total = Math.max(DAY_MS, end - new Date(k.created_at).getTime());
  const left = end - now;
  return { fraction: Math.min(1, Math.max(0, left / total)), days: left <= 0 ? 0 : Math.ceil(left / DAY_MS) };
}

/** O que pedir ao vendedor na própria linha: trocar uma chave vencida ou prestes a vencer (pausada ou revogada não pede nada). */
export function keyAttention(k: ApiKeyRow, now = Date.now()): "expired" | "soon" | null {
  const st = keyState(k, now);
  if (st === "expired") return "expired";
  if (st === "active" && k.expires_at && daysUntil(k.expires_at, now) <= KEY_EXPIRING_DAYS) return "soon";
  return null;
}

/** Nome sugerido para a chave que substitui outra: "Produção" vira "Produção 2", e assim por diante, sem repetir nome. */
export function nextKeyName(name: string, existing: string[]): string {
  const base = name.replace(/\s+(\(nova\)|\d+)$/i, "").trim() || "Chave";
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  for (let i = 2; i < 100; i++) {
    const tail = ` ${i}`;
    const candidate = `${base.slice(0, KEY_NAME_MAX - tail.length)}${tail}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base.slice(0, KEY_NAME_MAX);
}

/** Limite aplicado pelo banco (enforce_max_api_keys): conta também as chaves revogadas. */
export const MAX_API_KEYS = 5;

/* ── Abas do hub ── */
export type IntegrationTab = "apps" | "webhooks" | "keys" | "api";
const TABS: IntegrationTab[] = ["apps", "webhooks", "keys", "api"];
/** Nomes de links antigos que ainda circulam (e-mails, favoritos). */
const TAB_ALIASES: Record<string, IntegrationTab> = { documentacao: "api", credenciais: "keys", integracoes: "apps" };

export function parseIntegrationTab(raw: string | null): IntegrationTab {
  const v = (raw ?? "").toLowerCase();
  return TABS.find((t) => t === v) ?? TAB_ALIASES[v] ?? "apps";
}
