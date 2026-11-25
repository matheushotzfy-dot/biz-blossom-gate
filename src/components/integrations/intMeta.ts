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
