import type { Tone } from "@/features/admin-disputes/disputesModel";

export const PAGE_SIZE = 25;
export type { Tone };

export type StatusFilter = "open" | "resolved" | "all";
export type AreaKey = "checkout" | "member" | "seller" | "auth" | "staff" | "site" | "unknown";
export type AreaFilter = AreaKey | "all";
export type DeleteScope = "resolved_old" | "resolved";

export const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Abertos" },
  { value: "resolved", label: "Resolvidos" },
  { value: "all", label: "Todos" },
];

/** Partes do site, em palavras de quem opera. A área sai do caminho da página, nunca da mensagem. */
export const AREAS: { value: AreaKey; label: string; long: string }[] = [
  { value: "checkout", label: "Checkout", long: "Checkout e links de pagamento" },
  { value: "member", label: "Área do aluno", long: "Área do aluno e certificados" },
  { value: "seller", label: "Painel do vendedor", long: "Painel do vendedor" },
  { value: "auth", label: "Login e cadastro", long: "Login e cadastro" },
  { value: "staff", label: "Admin e equipe", long: "Painel do admin, gerentes e sócio" },
  { value: "site", label: "Site público", long: "Página inicial e páginas públicas" },
  { value: "unknown", label: "Sem página", long: "Registros sem a página onde aconteceu" },
];

export function areaInfo(area: string): { label: string; long: string } {
  return AREAS.find((a) => a.value === area) ?? { label: "Sem página", long: "Registros sem a página onde aconteceu" };
}

/* ───────── leitura do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

export interface ErrItem {
  id: string; error_type: string; message: string; route: string | null; area: string; context: string | null;
  user_id: string | null; user_name: string | null; user_email: string | null;
  occurrences: number; created_at: string; last_seen_at: string; resolved: boolean; resolved_at: string | null;
}
export interface ErrSummary { all: number; open: number; resolved: number }
export interface ErrProgram {
  open: number; resolved: number; total: number; seen_last_hour: number; seen_today: number; occurrences_open: number;
  affected_users: number; oldest_open: string | null; oldest: string | null; size_bytes: number;
}
export interface ErrPage { items: ErrItem[]; total: number; summary: ErrSummary; areas: Record<string, number>; program: ErrProgram }

function parseItem(r: Record<string, unknown>): ErrItem {
  return {
    id: str(r.id), error_type: str(r.error_type), message: str(r.message), route: strOrNull(r.route), area: str(r.area) || "unknown", context: strOrNull(r.context),
    user_id: strOrNull(r.user_id), user_name: strOrNull(r.user_name), user_email: strOrNull(r.user_email),
    occurrences: Math.max(1, num(r.occurrences)), created_at: str(r.created_at), last_seen_at: str(r.last_seen_at) || str(r.created_at),
    resolved: r.resolved === true, resolved_at: strOrNull(r.resolved_at),
  };
}

export function parseErrorsPage(raw: unknown): ErrPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  const p = isObj(raw.program) ? raw.program : {};
  const areas: Record<string, number> = {};
  if (isObj(raw.areas)) for (const [k, v] of Object.entries(raw.areas)) areas[k] = num(v);
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total),
    summary: { all: num(s.all), open: num(s.open), resolved: num(s.resolved) },
    areas,
    program: {
      open: num(p.open), resolved: num(p.resolved), total: num(p.total), seen_last_hour: num(p.seen_last_hour), seen_today: num(p.seen_today),
      occurrences_open: num(p.occurrences_open), affected_users: num(p.affected_users), oldest_open: strOrNull(p.oldest_open), oldest: strOrNull(p.oldest),
      size_bytes: num(p.size_bytes),
    },
  };
}

export interface ErrDetail {
  id: string; error_type: string; message: string; stack_trace: string | null; metadata: Record<string, unknown>;
  route: string | null; area: string; occurrences: number; created_at: string; last_seen_at: string;
  resolved: boolean; resolved_at: string | null; resolved_by: string | null;
  user: { user_id: string; name: string; email: string | null; account_status: string | null } | null;
}

export function parseErrorDetail(raw: unknown): ErrDetail {
  if (!isObj(raw) || !str(raw.id)) throw new Error("Resposta inesperada do servidor.");
  const u = isObj(raw.user) ? raw.user : null;
  return {
    id: str(raw.id), error_type: str(raw.error_type), message: str(raw.message), stack_trace: strOrNull(raw.stack_trace),
    metadata: isObj(raw.metadata) ? raw.metadata : {}, route: strOrNull(raw.route), area: str(raw.area) || "unknown",
    occurrences: Math.max(1, num(raw.occurrences)), created_at: str(raw.created_at), last_seen_at: str(raw.last_seen_at) || str(raw.created_at),
    resolved: raw.resolved === true, resolved_at: strOrNull(raw.resolved_at), resolved_by: strOrNull(raw.resolved_by),
    user: u ? { user_id: str(u.user_id), name: str(u.name) || "Conta sem nome", email: strOrNull(u.email), account_status: strOrNull(u.account_status) } : null,
  };
}

/* ───────── textos ───────── */

/** O que aconteceu, em palavras comuns, a partir de onde o erro foi capturado. */
export function kindLabel(context: string | null, errorType = "client_error"): string {
  if (errorType !== "client_error") return errorType.replace(/_/g, " ");
  const c = (context ?? "").trim();
  if (c.startsWith("ErrorBoundary")) return "A tela quebrou";
  if (c === "window.onerror") return "Erro no código da página";
  if (c === "unhandledrejection") return "Falha sem tratamento";
  return "Erro no navegador";
}

export function userLabel(i: { user_id: string | null; user_name: string | null; user_email: string | null }): string {
  return i.user_name ?? i.user_email ?? (i.user_id ? "Conta sem nome" : "Visitante sem login");
}

export function timesLabel(n: number): string {
  return n === 1 ? "1 vez" : `${n.toLocaleString("pt-BR")} vezes`;
}

/** "há 5 min", "há 3 h", "ontem" ou a data. `now` existe para os testes. */
export function agoLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

export function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function sizeLabel(bytes: number): string {
  if (!(bytes > 0)) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Navegador e sistema do usuário, a partir do user agent. */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Não informado";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const system = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  if (browser && system) return `${browser} no ${system}`;
  return browser ?? system ?? "Não identificado";
}

/** Primeira linha útil da pilha (o lugar do código onde estourou), para a lista e o relatório. */
export function firstFrame(stack: string | null): string | null {
  if (!stack) return null;
  const line = stack.split("\n").map((l) => l.trim()).find((l) => l.startsWith("at ") || /@https?:\/\//.test(l));
  return line ? line.slice(0, 160) : null;
}

/** Texto para colar numa conversa ou num chamado: tudo o que quem for consertar precisa. */
export function reportText(d: ErrDetail): string {
  const ua = typeof d.metadata.ua === "string" ? d.metadata.ua : null;
  const context = typeof d.metadata.context === "string" ? d.metadata.context : null;
  return [
    d.message,
    `Página: ${d.route ?? "não registrada"} (${areaInfo(d.area).label})`,
    `Origem: ${kindLabel(context, d.error_type)}`,
    `Vezes: ${d.occurrences} · primeira em ${d.created_at} · última em ${d.last_seen_at}`,
    `Navegador: ${deviceLabel(ua)}`,
    d.stack_trace ? `\n${d.stack_trace}` : "",
  ].filter(Boolean).join("\n");
}

/* ───────── limpeza ───────── */

export const DELETE_SCOPES: { value: DeleteScope; label: string; effect: string }[] = [
  { value: "resolved_old", label: "Resolvidos há mais de 30 dias", effect: "Apaga só os erros já resolvidos e sem ocorrência nova nos últimos 30 dias." },
  { value: "resolved", label: "Todos os resolvidos", effect: "Apaga todos os erros resolvidos, inclusive os de ontem. Os abertos não são tocados." },
];
export const DELETE_PRESETS = ["Limpeza de registros antigos", "Registros de teste"] as const;

/** Frase da confirmação de "Resolver todos", com a área quando há filtro. */
export function resolveAllText(area: AreaFilter, open: number): string {
  const n = open.toLocaleString("pt-BR");
  return area === "all"
    ? `Marcar ${n} ${open === 1 ? "erro aberto" : "erros abertos"} como resolvidos?`
    : `Marcar os erros abertos de "${areaInfo(area).label}" como resolvidos?`;
}
