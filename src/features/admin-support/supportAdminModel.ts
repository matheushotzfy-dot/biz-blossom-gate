import type { Tone } from "@/features/admin-disputes/disputesModel";
import type { Attachment } from "@/lib/ticketAttachments";
import { MESSAGE_MAX, splitTicketBody } from "@/components/support/supportModel";

export type { Tone };
export { MESSAGE_MAX };

export const PAGE_SIZE = 25;

export type Stage = "waiting" | "answered" | "done";
export type FilterKey = "waiting" | "unread" | "urgent" | "answered" | "done" | "all";
export type Priority = "low" | "normal" | "high" | "urgent";

export const FILTER_PILLS: { value: FilterKey; label: string }[] = [
  { value: "waiting", label: "Aguardando" },
  { value: "unread", label: "Não lidos" },
  { value: "urgent", label: "Urgentes" },
  { value: "answered", label: "Respondidos" },
  { value: "done", label: "Encerrados" },
  { value: "all", label: "Todos" },
];

export const STAGE_INFO: Record<Stage, { label: string; tone: Tone }> = {
  waiting: { label: "Aguardando a equipe", tone: "warning" },
  answered: { label: "Respondido", tone: "success" },
  done: { label: "Encerrado", tone: "neutral" },
};

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function priorityInfo(p: string): { label: string; tone: Tone } {
  switch (p) {
    case "urgent": return { label: "Urgente", tone: "destructive" };
    case "high": return { label: "Alta", tone: "warning" };
    case "low": return { label: "Baixa", tone: "neutral" };
    default: return { label: "Normal", tone: "neutral" };
  }
}

/** Textos prontos. Entram no rascunho do chamado aberto e dá para editar antes de enviar. */
export const QUICK_REPLIES: { label: string; text: string }[] = [
  { label: "Recebemos", text: "Olá! Recebemos o seu chamado e já estamos analisando. Voltamos com uma resposta o quanto antes." },
  { label: "Em análise", text: "Estamos analisando o seu caso com cuidado. Assim que tivermos uma resposta definitiva, avisamos por aqui." },
  { label: "Pedir detalhes", text: "Para ajudar melhor, pode nos enviar o ID da venda, uma captura de tela e o passo a passo do que aconteceu?" },
  { label: "Resolvido", text: "Pronto, resolvemos por aqui. Se algo ainda não estiver certo, é só responder esta mensagem." },
];

/* ───────── leitura das respostas do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const stageOf = (v: unknown): Stage => (v === "answered" || v === "done" ? v : "waiting");

export interface TicketUser { user_id: string; name: string | null; email: string | null }
export interface TicketRow {
  id: string; subject: string; first: string; status: string; stage: Stage; priority: string;
  created_at: string; last_message_at: string; replied_at: string | null; unread_by_staff: number;
  last_sender: "customer" | "staff" | null; last_body: string; user: TicketUser;
}
export interface SupportProgram {
  waiting: number; waiting_since: string | null; unread: number; unread_tickets: number; urgent: number;
  answered: number; done: number; total: number; median_first_reply_seconds: number | null; reply_sample: number;
}
export interface SupportPage { items: TicketRow[]; total: number; counts: Record<FilterKey, number>; can_reply: boolean; program: SupportProgram }

function parseUser(raw: unknown): TicketUser {
  const u = isObj(raw) ? raw : {};
  return { user_id: str(u.user_id), name: strOrNull(u.name), email: strOrNull(u.email) };
}

function parseRow(r: Record<string, unknown>): TicketRow {
  const sender = r.last_sender === "staff" ? "staff" : r.last_sender === "customer" ? "customer" : null;
  return {
    id: str(r.id), subject: str(r.subject), first: str(r.first), status: str(r.status), stage: stageOf(r.stage), priority: str(r.priority) || "normal",
    created_at: str(r.created_at), last_message_at: str(r.last_message_at) || str(r.created_at), replied_at: strOrNull(r.replied_at),
    unread_by_staff: Math.max(0, num(r.unread_by_staff)), last_sender: sender, last_body: str(r.last_body), user: parseUser(r.user),
  };
}

export function parseSupportPage(raw: unknown): SupportPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const c = isObj(raw.counts) ? raw.counts : {};
  const p = isObj(raw.program) ? raw.program : {};
  const median = p.median_first_reply_seconds;
  return {
    items: raw.items.filter(isObj).map(parseRow),
    total: num(raw.total),
    counts: { waiting: num(c.waiting), unread: num(c.unread), urgent: num(c.urgent), answered: num(c.answered), done: num(c.done), all: num(c.all) },
    can_reply: raw.can_reply === true,
    program: {
      waiting: num(p.waiting), waiting_since: strOrNull(p.waiting_since), unread: num(p.unread), unread_tickets: num(p.unread_tickets), urgent: num(p.urgent),
      answered: num(p.answered), done: num(p.done), total: num(p.total),
      median_first_reply_seconds: median === null || median === undefined ? null : num(median), reply_sample: num(p.reply_sample),
    },
  };
}

export interface ThreadMessage {
  id: string; sender_type: "customer" | "staff"; sender_name: string | null; sender_role: string | null;
  body: string; created_at: string; attachments: Attachment[];
}
export interface PreviousTicket { id: string; subject: string; status: string; stage: Stage; created_at: string }
export interface SellerContext {
  user_id: string; name: string | null; email: string | null; account_status: string | null; joined_at: string | null;
  sales: number; gross: number; last_sale: string | null; tickets_total: number; previous: PreviousTicket[];
}
export interface TicketDetail {
  id: string; subject: string; first: string; status: string; stage: Stage; priority: string; created_at: string; last_message_at: string;
  replied_at: string | null; unread_by_staff: number; messages: ThreadMessage[]; messages_total: number; can_reply: boolean; user: SellerContext;
}

function parseAttachments(raw: unknown): Attachment[] {
  const out: Attachment[] = [];
  for (const a of Array.isArray(raw) ? raw : []) {
    if (isObj(a) && typeof a.path === "string" && typeof a.name === "string") out.push({ path: a.path, name: a.name, size: num(a.size), type: str(a.type) });
  }
  return out;
}

export function parseTicketDetail(raw: unknown): TicketDetail {
  if (!isObj(raw) || !str(raw.id)) throw new Error("Resposta inesperada do servidor.");
  const u = isObj(raw.user) ? raw.user : {};
  const messages = (Array.isArray(raw.messages) ? raw.messages.filter(isObj) : []).map((m): ThreadMessage => ({
    id: str(m.id), sender_type: m.sender_type === "staff" ? "staff" : "customer", sender_name: strOrNull(m.sender_name), sender_role: strOrNull(m.sender_role),
    body: str(m.body), created_at: str(m.created_at), attachments: parseAttachments(m.attachments),
  }));
  const previous = (Array.isArray(u.previous) ? u.previous.filter(isObj) : []).map((p): PreviousTicket => ({
    id: str(p.id), subject: str(p.subject), status: str(p.status), stage: stageOf(p.stage), created_at: str(p.created_at),
  }));
  return {
    id: str(raw.id), subject: str(raw.subject), first: str(raw.first), status: str(raw.status), stage: stageOf(raw.stage), priority: str(raw.priority) || "normal",
    created_at: str(raw.created_at), last_message_at: str(raw.last_message_at) || str(raw.created_at), replied_at: strOrNull(raw.replied_at),
    unread_by_staff: Math.max(0, num(raw.unread_by_staff)), messages, messages_total: Math.max(messages.length, num(raw.messages_total)), can_reply: raw.can_reply === true,
    user: {
      user_id: str(u.user_id), name: strOrNull(u.name), email: strOrNull(u.email), account_status: strOrNull(u.account_status), joined_at: strOrNull(u.joined_at),
      sales: Math.max(0, num(u.sales)), gross: Math.max(0, num(u.gross)), last_sale: strOrNull(u.last_sale), tickets_total: Math.max(0, num(u.tickets_total)), previous,
    },
  };
}

/* ───────── textos ───────── */

export const ticketRef = (id: string): string => `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export const sellerName = (u: Pick<TicketUser, "name" | "email">): string => u.name ?? u.email ?? "Seller sem nome";

/** "12 min", "3 h 20 min", "2 dias": o tempo em palavras, sem casas decimais. */
export function durationLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return "menos de 1 min";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24) return rest ? `${h} h ${rest} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 dia" : `${d} dias`;
}

/** Uma linha de prévia: quem falou por último e o começo do texto, sem o cabeçalho de categoria. */
export function previewLine(r: Pick<TicketRow, "last_sender" | "last_body">): string {
  const text = splitTicketBody(r.last_body).text.replace(/\s+/g, " ").trim();
  return `${r.last_sender === "staff" ? "Equipe: " : ""}${text}`;
}

export function accountStatusLabel(status: string | null): string {
  switch (status) {
    case "approved": return "Cadastro aprovado";
    case "pending": return "Cadastro em análise";
    case "rejected": return "Cadastro reprovado";
    case "blocked": case "suspended": return "Conta bloqueada";
    default: return status ? "Situação do cadastro: " + status : "Sem cadastro";
  }
}

export const salesText = (n: number): string => (n === 1 ? "1 venda paga" : `${n.toLocaleString("pt-BR")} vendas pagas`);

export function emptyCopy(filter: FilterKey, searching: boolean, hasAny: boolean): { title: string; subtitle: string } {
  if (searching) return { title: "Nada por aqui", subtitle: "Nenhum chamado bate com essa busca." };
  if (!hasAny) return { title: "Nenhum chamado ainda", subtitle: "Quando um seller abrir um chamado, ele aparece aqui." };
  switch (filter) {
    case "waiting": return { title: "Todos os chamados foram respondidos", subtitle: "Nenhum chamado está esperando a equipe agora." };
    case "unread": return { title: "Nenhuma mensagem sem ler", subtitle: "Você abriu todas as conversas com mensagem nova." };
    case "urgent": return { title: "Nenhum chamado urgente", subtitle: "Os chamados marcados como urgentes e ainda abertos aparecem aqui." };
    case "answered": return { title: "Nenhum chamado respondido", subtitle: "Os que a equipe respondeu e o seller ainda não retornou aparecem aqui." };
    case "done": return { title: "Nenhum chamado encerrado", subtitle: "Os chamados encerrados ficam guardados aqui." };
    default: return { title: "Nenhum chamado", subtitle: "Não há chamados nesta lista." };
  }
}

/* ───────── resposta ───────── */

/** O que impede de enviar a resposta agora; nulo quando pode enviar. */
export function replyProblem(text: string, files: number): string | null {
  const t = text.trim();
  if (!t && files === 0) return "Escreva a resposta.";
  if (t.length > MESSAGE_MAX) return `A resposta passa de ${MESSAGE_MAX.toLocaleString("pt-BR")} caracteres.`;
  return null;
}

/** Insere o texto pronto no rascunho: se já há texto, entra depois, separado por uma linha em branco. */
export function withQuickReply(draft: string, text: string): string {
  const cur = draft.trimEnd();
  return cur ? `${cur}\n\n${text}` : text;
}

export function messageLabel(m: ThreadMessage, sellerLabel: string, roleLabels: Record<string, string>): { who: string; role: string | null } {
  if (m.sender_type === "customer") return { who: sellerLabel, role: null };
  const role = m.sender_role ? (roleLabels[m.sender_role] ?? "Suporte") : "Suporte";
  return { who: m.sender_name ?? role, role };
}
