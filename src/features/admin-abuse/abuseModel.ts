export const PAGE_SIZE = 25;
export const HOURS = [1, 6, 24, 72, 168] as const;
export type Hours = (typeof HOURS)[number];

export const hoursLabel = (h: number) => (h === 1 ? "1 hora" : h < 48 ? `${h} horas` : `${h / 24} dias`);
/** "na última hora", "nas últimas 6 horas", "nos últimos 3 dias" (concordância certa em cada janela). */
export const lastLabel = (h: number) => (h === 1 ? "na última hora" : h < 48 ? `nas últimas ${h} horas` : `nos últimos ${h / 24} dias`);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : []);

/* ───────── nomes em português ───────── */

const EVENT_LABEL: Record<string, string> = {
  login_failed: "E-mail ou senha errados",
  login_rate_limited: "Barrado por excesso de tentativas",
};
export const eventLabel = (t: string) => EVENT_LABEL[t] ?? "Outro evento";

const ENDPOINT_LABEL: Record<string, string> = { "gated-login": "Login de vendedores e alunos" };
export const endpointLabel = (e: string) => (e ? ENDPOINT_LABEL[e] ?? e : "Rota não informada");

export const scopeLabel = (s: string | null) => (s === "member" ? "Área do aluno" : s === "seller" ? "Área do vendedor" : "Login");

/** O IP nunca chega à tela: só o código (os 32 primeiros caracteres do SHA-256). */
export const shortHash = (h: string) => (h.length > 12 ? `${h.slice(0, 12)}…` : h);

/** "Auto-block: 120 events in 10s" vira português; bloqueio manual mostra só o motivo escrito. */
export function blockReasonLabel(reason: string | null): { manual: boolean; text: string } {
  const r = (reason ?? "").trim();
  if (r.startsWith("Bloqueio manual:")) return { manual: true, text: r.slice("Bloqueio manual:".length).trim() || "Sem motivo registrado" };
  const m = /^Auto-block:\s*(\d+)\s+events? in\s+(\d+)s/i.exec(r);
  if (m) return { manual: false, text: `${Number(m[1]).toLocaleString("pt-BR")} tentativas em ${m[2]} segundos` };
  return { manual: false, text: r || "Sem motivo registrado" };
}

/* ───────── tempo ───────── */

const TZ = "America/Sao_Paulo";
const parts = (iso: string, opts: Intl.DateTimeFormatOptions) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hourCycle: "h23", ...opts }).formatToParts(d).map((p) => [p.type, p.value]));
};
/** "25/11 08h", sempre no horário de Brasília. */
export function hourLabel(iso: string): string {
  const p = parts(iso, { day: "2-digit", month: "2-digit", hour: "2-digit" });
  return p ? `${p.day}/${p.month} ${p.hour}h` : "—";
}
export function clockLabel(iso: string): string {
  const p = parts(iso, { hour: "2-digit", minute: "2-digit" });
  return p ? `${p.hour}:${p.minute}` : "—";
}
/** "faltam 12 min", "faltam 2 h 10 min", "termina agora". */
export function timeLeft(untilIso: string, now: number): string {
  const ms = new Date(untilIso).getTime() - now;
  if (!Number.isFinite(ms)) return "—";
  const min = Math.ceil(ms / 60000);
  if (min <= 0) return "termina agora";
  if (min < 60) return `faltam ${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  if (h < 48) return m ? `faltam ${h} h ${m} min` : `faltam ${h} h`;
  return `faltam ${Math.ceil(h / 24)} dias`;
}

/* ───────── resumo ───────── */

export interface HourBucket { bucket: string; count: number }
export interface Overview {
  hours: number; total: number; failed: number; rate_limited: number; distinct_ips: number; distinct_accounts: number;
  blocks_active: number; lockouts_active: number;
  by_type: { event_type: string; count: number }[]; by_endpoint: { endpoint: string; count: number }[]; hourly: HourBucket[];
}
export function parseOverview(raw: unknown): Overview {
  if (!isObj(raw)) throw new Error("Resposta inesperada do servidor.");
  return {
    hours: num(raw.hours), total: num(raw.total), failed: num(raw.failed), rate_limited: num(raw.rate_limited),
    distinct_ips: num(raw.distinct_ips), distinct_accounts: num(raw.distinct_accounts), blocks_active: num(raw.blocks_active), lockouts_active: num(raw.lockouts_active),
    by_type: list(raw.by_type).map((r) => ({ event_type: str(r.event_type), count: num(r.count) })),
    by_endpoint: list(raw.by_endpoint).map((r) => ({ endpoint: str(r.endpoint), count: num(r.count) })),
    hourly: list(raw.hourly).map((r) => ({ bucket: str(r.bucket), count: num(r.count) })),
  };
}
/** A hora mais movimentada da série (a mais recente em caso de empate); `null` sem nenhum evento. */
export function peakOf(hourly: HourBucket[]): HourBucket | null {
  let best: HourBucket | null = null;
  for (const h of hourly) if (h.count > 0 && (!best || h.count >= best.count)) best = h;
  return best;
}
export const share = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/* ───────── em espera agora ───────── */

export interface Block { id: string; ip_hash: string; endpoint: string | null; reason: string | null; blocked_until: string; created_at: string }
export interface Lockout { kind: "email" | "ip"; scope: string | null; email: string | null; ip_hash: string | null; fails: number; resets_at: string }
export function parseWaiting(raw: unknown): { blocks: Block[]; lockouts: Lockout[] } {
  if (!isObj(raw)) throw new Error("Resposta inesperada do servidor.");
  return {
    blocks: list(raw.blocks).map((r) => ({ id: str(r.id), ip_hash: str(r.ip_hash), endpoint: strOrNull(r.endpoint), reason: strOrNull(r.reason), blocked_until: str(r.blocked_until), created_at: str(r.created_at) })),
    lockouts: list(raw.lockouts).map((r) => ({ kind: r.kind === "ip" ? "ip" : "email", scope: strOrNull(r.scope), email: strOrNull(r.email), ip_hash: strOrNull(r.ip_hash), fails: num(r.fails), resets_at: str(r.resets_at) })),
  };
}

/* ───────── IPs mais ativos ───────── */

export interface IpRow {
  ip_hash: string; events: number; failed: number; rate_limited: number; accounts: number; last_at: string; block_id: string | null; blocked_until: string | null;
}
export interface IpSummary { ips: number; blocked: number }
export function parseIps(raw: unknown): { items: IpRow[]; total: number; summary: IpSummary } {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  return {
    items: list(raw.items).map((r) => ({ ip_hash: str(r.ip_hash), events: num(r.events), failed: num(r.failed), rate_limited: num(r.rate_limited), accounts: num(r.accounts), last_at: str(r.last_at), block_id: strOrNull(r.block_id), blocked_until: strOrNull(r.blocked_until) })),
    total: num(raw.total), summary: { ips: num(s.ips), blocked: num(s.blocked) },
  };
}

/* ───────── bloqueio manual ───────── */

export const DURATIONS = [
  { value: 15, label: "15 minutos" }, { value: 60, label: "1 hora" }, { value: 1440, label: "24 horas" }, { value: 10080, label: "7 dias" },
] as const;
export const durationLabel = (m: number) => DURATIONS.find((d) => d.value === m)?.label ?? `${m} minutos`;
export function checkBlockReason(reason: string): string | null {
  return reason.trim().length < 3 ? "Explique o motivo (mínimo 3 caracteres)." : null;
}
