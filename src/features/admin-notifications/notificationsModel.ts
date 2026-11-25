import type { Tone } from "@/features/admin-disputes/disputesModel";
import type { SellerHit } from "@/features/admin-referrals/referralsModel";

export type { Tone };

export const PAGE_SIZE = 25;
export const TITLE_MAX = 100;
export const MESSAGE_MAX = 500;
/** Acima disso o registro de notificações merece um aviso no topo da tela. */
export const BIG_TABLE_BYTES = 50 * 1024 * 1024;

export type ViewKey = "avisos" | "todas";
export type AudienceKey = "all" | "approved" | "pending" | "one";
export type ComposeType = "info" | "announcement" | "warning" | "success" | "alert";
export type CleanScope = "read_old" | "read_all";

export const VIEW_PILLS: { value: ViewKey; label: string }[] = [
  { value: "avisos", label: "Avisos enviados" },
  { value: "todas", label: "Todas as notificações" },
];

/** Os tipos que a equipe pode mandar. O painel do seller põe comunicado, atenção e urgente em destaque até serem abertos. */
export const COMPOSE_TYPES: { value: ComposeType; label: string; hint: string; tone: Tone }[] = [
  { value: "info", label: "Aviso", hint: "Informação comum. Aparece no sino do painel.", tone: "info" },
  { value: "announcement", label: "Comunicado", hint: "Fica em destaque no topo do sino até o seller abrir.", tone: "info" },
  { value: "warning", label: "Atenção", hint: "Pede cuidado. Fica em destaque no sino até o seller abrir.", tone: "warning" },
  { value: "success", label: "Boa notícia", hint: "Algo positivo, como uma liberação.", tone: "success" },
  { value: "alert", label: "Urgente", hint: "Problema que precisa de ação. Fica em destaque, em vermelho.", tone: "destructive" },
];

const TYPE_INFO: Record<string, { label: string; tone: Tone }> = {
  info: { label: "Aviso", tone: "info" },
  announcement: { label: "Comunicado", tone: "info" },
  warning: { label: "Atenção", tone: "warning" },
  success: { label: "Boa notícia", tone: "success" },
  alert: { label: "Urgente", tone: "destructive" },
  sale_paid: { label: "Venda aprovada", tone: "success" },
  sale: { label: "Venda", tone: "success" },
  withdrawal: { label: "Saque", tone: "neutral" },
  product: { label: "Produto", tone: "neutral" },
  referral: { label: "Indicação", tone: "neutral" },
  coupon: { label: "Cupom", tone: "neutral" },
  course: { label: "Curso", tone: "neutral" },
  subscription: { label: "Assinatura", tone: "neutral" },
  affiliate: { label: "Afiliado", tone: "neutral" },
  dispute_opened: { label: "Disputa aberta", tone: "warning" },
  dispute_won: { label: "Disputa ganha", tone: "success" },
  dispute_lost: { label: "Disputa perdida", tone: "destructive" },
};

/** Nome e cor do tipo. Tipo que não conhecemos aparece como está, sem os sublinhados. */
export function typeInfo(type: string): { label: string; tone: Tone } {
  const known = TYPE_INFO[type];
  if (known) return known;
  const raw = type.replace(/_/g, " ").trim();
  return { label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Outro", tone: "neutral" };
}

export const AUDIENCES: { value: AudienceKey; label: string; hint: string }[] = [
  { value: "all", label: "Todos os sellers", hint: "Todas as contas de seller, aprovadas ou ainda em análise." },
  { value: "approved", label: "Cadastro aprovado", hint: "Só quem já tem o cadastro aprovado." },
  { value: "pending", label: "Aguardando aprovação", hint: "Só quem ainda não teve o cadastro aprovado." },
  { value: "one", label: "Um seller", hint: "Uma conta só. Não pede a senha de novo." },
];

export const CLEAN_SCOPES: { value: CleanScope; label: string; effect: string }[] = [
  { value: "read_old", label: "Lidas há mais de 30 dias", effect: "Apaga só as notificações que o seller já abriu e que têm mais de 30 dias." },
  { value: "read_all", label: "Todas as lidas", effect: "Apaga todas as notificações que o seller já abriu, de qualquer data." },
];
export const CLEAN_PRESETS = ["Limpeza de notificações antigas", "Registros de teste"] as const;

/* ───────── leitura do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

export interface AvisoItem {
  batch_id: string; title: string; message: string; type: string; sent_at: string; sent_by_name: string | null;
  recipients: number; read: number; one: SellerHit | null;
}
export interface NotifItem {
  id: string; type: string; title: string; message: string; is_read: boolean; created_at: string;
  batch_id: string | null; user_id: string | null; user_name: string | null; user_email: string | null;
}
export interface NotifProgram {
  total: number; unread: number; read: number; read_old: number; last_24h: number; oldest: string | null;
  avisos: number; avisos_rows: number; avisos_read: number; last_sent: string | null; size_bytes: number;
}
export interface NotifPage { view: ViewKey; avisos: AvisoItem[]; todas: NotifItem[]; total: number; types: Record<string, number>; program: NotifProgram }

function parseAviso(r: Record<string, unknown>): AvisoItem {
  const one = isObj(r.one) ? r.one : null;
  return {
    batch_id: str(r.batch_id), title: str(r.title), message: str(r.message), type: str(r.type) || "info", sent_at: str(r.sent_at),
    sent_by_name: strOrNull(r.sent_by_name), recipients: Math.max(0, num(r.recipients)), read: Math.max(0, num(r.read)),
    one: one ? { user_id: str(one.user_id), name: str(one.name) || "Seller sem nome", email: strOrNull(one.email) } : null,
  };
}
function parseNotif(r: Record<string, unknown>): NotifItem {
  return {
    id: str(r.id), type: str(r.type) || "info", title: str(r.title), message: str(r.message), is_read: r.is_read === true, created_at: str(r.created_at),
    batch_id: strOrNull(r.batch_id), user_id: strOrNull(r.user_id), user_name: strOrNull(r.user_name), user_email: strOrNull(r.user_email),
  };
}

export function parseNotificationsPage(raw: unknown): NotifPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const p = isObj(raw.program) ? raw.program : {};
  const types: Record<string, number> = {};
  if (isObj(raw.types)) for (const [k, v] of Object.entries(raw.types)) types[k] = num(v);
  const view: ViewKey = raw.view === "todas" ? "todas" : "avisos";
  const rows = raw.items.filter(isObj);
  return {
    view, avisos: view === "avisos" ? rows.map(parseAviso) : [], todas: view === "todas" ? rows.map(parseNotif) : [],
    total: num(raw.total), types,
    program: {
      total: num(p.total), unread: num(p.unread), read: num(p.read), read_old: num(p.read_old), last_24h: num(p.last_24h), oldest: strOrNull(p.oldest),
      avisos: num(p.avisos), avisos_rows: num(p.avisos_rows), avisos_read: num(p.avisos_read), last_sent: strOrNull(p.last_sent), size_bytes: num(p.size_bytes),
    },
  };
}

export interface Audiences { all: number; approved: number; pending: number }
export function parseAudiences(raw: unknown): Audiences {
  if (!isObj(raw)) throw new Error("Resposta inesperada do servidor.");
  return { all: num(raw.all), approved: num(raw.approved), pending: num(raw.pending) };
}

export interface BatchRecipient { user_id: string; name: string; email: string | null; is_read: boolean }
export interface BatchDetail {
  batch_id: string; title: string; message: string; type: string; sent_at: string; sent_by_name: string | null;
  recipients: number; read: number; items: BatchRecipient[];
}
export function parseBatch(raw: unknown): BatchDetail {
  if (!isObj(raw) || !str(raw.batch_id)) throw new Error("Resposta inesperada do servidor.");
  const items = Array.isArray(raw.items) ? raw.items.filter(isObj) : [];
  return {
    batch_id: str(raw.batch_id), title: str(raw.title), message: str(raw.message), type: str(raw.type) || "info", sent_at: str(raw.sent_at),
    sent_by_name: strOrNull(raw.sent_by_name), recipients: Math.max(0, num(raw.recipients)), read: Math.max(0, num(raw.read)),
    items: items.map((i) => ({ user_id: str(i.user_id), name: str(i.name) || "Seller sem nome", email: strOrNull(i.email), is_read: i.is_read === true })),
  };
}

export function parseSendResult(raw: unknown): { delivered: number; name: string | null } {
  if (!isObj(raw)) return { delivered: 0, name: null };
  return { delivered: num(raw.delivered), name: strOrNull(raw.name) };
}
export function parseCleanResult(raw: unknown): { deleted: number; remaining: number } {
  if (!isObj(raw)) return { deleted: 0, remaining: 0 };
  return { deleted: Math.max(0, num(raw.deleted)), remaining: Math.max(0, num(raw.remaining)) };
}

/* ───────── textos ───────── */

export const sellersText = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "seller" : "sellers"}`;

export function audienceCount(a: Audiences | undefined, key: AudienceKey): number | null {
  if (key === "one") return 1;
  return a ? a[key] : null;
}

/** Para quem o aviso foi: o nome de quem recebeu, quando é um só, ou quantos sellers. */
export function recipientsLabel(a: Pick<AvisoItem, "recipients" | "one">): string {
  return a.recipients === 1 && a.one ? a.one.name : sellersText(a.recipients);
}

/** Quem já abriu o aviso, em palavras. */
export function readText(read: number, recipients: number): string {
  if (recipients === 1) return read > 0 ? "Já leu" : "Ainda não leu";
  if (read <= 0) return "Ninguém leu ainda";
  if (read >= recipients) return "Todos leram";
  return `${read.toLocaleString("pt-BR")} de ${recipients.toLocaleString("pt-BR")} leram`;
}
/** Porcentagem de leitura, de 0 a 100, sempre inteira. */
export function readPct(read: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((read / total) * 100)));
}

/** A mesma limpeza que o banco faz no texto: tira o que está entre < e > e o "javascript:". */
export function cleanText(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/javascript:/gi, "").trim();
}

export interface ComposeInput { audience: AudienceKey; seller: SellerHit | null; title: string; message: string; count: number | null }
export type ComposeProblems = Partial<Record<"seller" | "title" | "message" | "audience", string>>;

export function checkCompose(i: ComposeInput): ComposeProblems {
  const p: ComposeProblems = {};
  const title = cleanText(i.title);
  const message = cleanText(i.message);
  if (i.audience === "one" && !i.seller) p.seller = "Escolha o seller que vai receber.";
  if (i.audience !== "one" && i.count === 0) p.audience = "Ninguém está nessa lista agora.";
  if (!title) p.title = "Escreva o título do aviso.";
  else if (title.length > TITLE_MAX) p.title = `O título passa de ${TITLE_MAX} caracteres.`;
  if (!message) p.message = "Escreva a mensagem do aviso.";
  else if (message.length > MESSAGE_MAX) p.message = `A mensagem passa de ${MESSAGE_MAX} caracteres.`;
  return p;
}

/** Texto do toast depois do envio. */
export function sentText(delivered: number, name: string | null): string {
  if (name && delivered === 1) return `Aviso enviado para ${name}.`;
  return `Aviso enviado para ${sellersText(delivered)}.`;
}

/** Frase da confirmação de senha, antes de um aviso para vários sellers. */
export function sendConfirmText(title: string, audience: AudienceKey, count: number): string {
  const who = audience === "all" ? sellersText(count) : `${sellersText(count)} (${audience === "approved" ? "cadastro aprovado" : "aguardando aprovação"})`;
  return `Enviar o aviso “${cleanText(title).slice(0, 60)}” para ${who}. Se mudar de ideia, dá para recolher depois.`;
}

export function cleanedText(n: number): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "notificação apagada" : "notificações apagadas"}.`;
}
export function retractedText(n: number): string {
  return `Aviso recolhido da caixa de ${sellersText(n)}.`;
}
