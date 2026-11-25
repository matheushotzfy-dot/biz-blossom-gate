import type { Tables } from '@/integrations/supabase/types';
import type { Attachment } from '@/lib/ticketAttachments';
import { ACCEPTED_EXT, MAX_FILES_PER_MESSAGE, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/ticketLimits';

/* Regras puras do Suporte (sem React e sem Supabase): situação do chamado, "não lido", assunto,
   anexos, busca e ajuda. Testadas em src/test/support-model.test.ts. */

export type SupportTicket = Tables<'support_tickets'>;
export interface SupportMessage extends Omit<Tables<'ticket_messages'>, 'attachments'> {
  attachments: Attachment[];
}
export type SupportFilter = 'all' | 'open' | 'answered' | 'closed';
export type Tone = 'ok' | 'wait' | 'alert' | 'idle' | 'info';

export const SUBJECT_MAX = 100;
export const SUBJECT_MIN = 3;
export const MESSAGE_MAX = 2000;
export const MESSAGE_MIN = 10;
export const REFERENCE_MAX = 80;

export const PRIORITIES: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
/** O que o vendedor escolhe ao abrir um chamado (baixa continua existindo para chamados antigos). */
export const URGENCY_OPTIONS = [
  { value: 'normal', label: 'Normal', hint: 'Dúvidas e pedidos do dia a dia' },
  { value: 'high', label: 'Alta', hint: 'Algo está atrapalhando suas vendas' },
  { value: 'urgent', label: 'Urgente', hint: 'Vendas ou saques parados' },
] as const;
export const ROLE_LABEL: Record<string, string> = { admin: 'Equipe Vemprapay', manager: 'Gerente de suporte', employee: 'Atendente', staff: 'Suporte' };

export const priorityTone = (priority: string): Tone => (priority === 'urgent' ? 'alert' : priority === 'high' ? 'wait' : 'idle');

/* ───────── Situação do chamado ───────── */

export type TicketStage = 'waiting' | 'answered' | 'done';

/** Com quem está a bola: equipe (waiting), você (answered) ou encerrado (done). Vem das datas, porque
 *  o banco mantém `status = 'answered'` mesmo depois de o cliente escrever de novo. */
export function ticketStage(t: Pick<SupportTicket, 'status' | 'replied_at' | 'last_message_at'>): TicketStage {
  if (t.status === 'closed' || t.status === 'resolved') return 'done';
  const answered = t.status === 'answered' || Boolean(t.replied_at);
  if (!answered) return 'waiting';
  const replied = t.replied_at ? Date.parse(t.replied_at) : NaN;
  const last = t.last_message_at ? Date.parse(t.last_message_at) : NaN;
  if (!Number.isNaN(replied) && !Number.isNaN(last) && last - replied > 1500) return 'waiting';
  return 'answered';
}

export function ticketBadge(t: Pick<SupportTicket, 'status' | 'replied_at' | 'last_message_at'>): { label: string; tone: Tone } {
  const stage = ticketStage(t);
  if (stage === 'done') return { label: t.status === 'resolved' ? 'Resolvido' : 'Encerrado', tone: 'idle' };
  if (stage === 'answered') return { label: 'Respondido', tone: 'ok' };
  if (t.status === 'in_progress') return { label: 'Em andamento', tone: 'info' };
  return { label: 'Aguardando a equipe', tone: 'wait' };
}

export const ticketCode = (id: string): string => `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export function matchesFilter(t: SupportTicket, filter: SupportFilter): boolean {
  if (filter === 'all') return true;
  const stage = ticketStage(t);
  return filter === 'open' ? stage === 'waiting' : filter === 'answered' ? stage === 'answered' : stage === 'done';
}

const plain = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Todas as palavras digitadas precisam aparecer (assunto, mensagem, última resposta ou número). */
export function matchesQuery(t: SupportTicket, query: string): boolean {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = plain(`${t.subject} ${splitTicketBody(t.message).text} ${t.admin_reply ?? ''} ${ticketCode(t.id)} ${t.id}`);
  return words.every((w) => hay.includes(w.replace(/^#/, '')));
}

export function filterTickets(tickets: SupportTicket[], filter: SupportFilter, query: string): SupportTicket[] {
  return tickets.filter((t) => matchesFilter(t, filter) && matchesQuery(t, query));
}

export function ticketCounts(tickets: SupportTicket[]): Record<SupportFilter, number> {
  return {
    all: tickets.length,
    open: tickets.filter((t) => matchesFilter(t, 'open')).length,
    answered: tickets.filter((t) => matchesFilter(t, 'answered')).length,
    closed: tickets.filter((t) => matchesFilter(t, 'closed')).length,
  };
}

export function ticketPreview(t: SupportTicket): { who: 'team' | 'you' | 'none'; text: string } {
  const stage = ticketStage(t);
  if (stage === 'waiting' && t.replied_at) return { who: 'none', text: 'Você respondeu. A equipe já foi avisada.' };
  if (t.admin_reply && (stage === 'answered' || stage === 'done')) return { who: 'team', text: t.admin_reply };
  return { who: 'you', text: splitTicketBody(t.message).text };
}

/* ───────── "Não lido" (guardado neste aparelho) ─────────
   A coluna `unread_by_customer` não pode ser zerada pelo próprio cliente (não há política de UPDATE),
   então o "visto" fica no navegador: marcamos a data da última resposta da equipe que a pessoa abriu. */

export type SeenMap = Record<string, string>;

export function parseSeen(raw: string | null): SeenMap | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const out: SeenMap = {};
    for (const [k, v] of Object.entries(value)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch { return {}; }
}

/** Primeira vez neste aparelho: o que já existe conta como visto (senão todo chamado antigo acenderia). */
export function seedSeen(tickets: SupportTicket[]): SeenMap {
  const out: SeenMap = {};
  for (const t of tickets) if (t.replied_at) out[t.id] = t.replied_at;
  return out;
}

export function isUnread(t: SupportTicket, seen: SeenMap): boolean {
  if (!t.replied_at) return false;
  const replied = Date.parse(t.replied_at);
  const mine = seen[t.id] ? Date.parse(seen[t.id]) : 0;
  if (Number.isNaN(replied)) return false;
  return replied > (Number.isNaN(mine) ? 0 : mine);
}

export const unreadCount = (tickets: SupportTicket[], seen: SeenMap): number => tickets.filter((t) => isUnread(t, seen)).length;

export function markSeen(seen: SeenMap, t: Pick<SupportTicket, 'id' | 'replied_at'>, now = new Date()): SeenMap {
  const stamp = t.replied_at ?? now.toISOString();
  if (seen[t.id] && Date.parse(seen[t.id]) >= Date.parse(stamp)) return seen;
  return { ...seen, [t.id]: stamp };
}

/* ───────── Assunto do chamado ───────── */

export type CategoryId = 'payouts' | 'sales' | 'products' | 'account' | 'integrations' | 'other';
export interface TicketCategory { id: CategoryId; label: string; short: string; subject: string; tip: string }
export const CATEGORIES: TicketCategory[] = [
  { id: 'payouts', label: 'Saques e financeiro', short: 'Saques', subject: 'Dúvida sobre saque', tip: 'Informe o valor, a data e, se tiver, o ID do saque.' },
  { id: 'sales', label: 'Vendas e checkout', short: 'Vendas', subject: 'Dúvida sobre uma venda', tip: 'Informe o ID da transação ou o e-mail do cliente e conte o que aconteceu.' },
  { id: 'products', label: 'Produtos e área de membros', short: 'Produtos', subject: 'Dúvida sobre um produto', tip: 'Diga o nome do produto e em que etapa você travou.' },
  { id: 'account', label: 'Conta e verificação', short: 'Conta', subject: 'Dúvida sobre minha conta', tip: 'Conte o que a tela mostra. Nunca envie senha ou código de verificação.' },
  { id: 'integrations', label: 'Integrações e API', short: 'Integrações', subject: 'Dúvida sobre integração', tip: 'Diga qual app ou endpoint e inclua a mensagem de erro, sem chaves secretas.' },
  { id: 'other', label: 'Outro assunto', short: 'Outro', subject: '', tip: 'Conte com detalhes para a equipe resolver mais rápido.' },
];
export const categoryById = (id: string | null | undefined): TicketCategory | undefined => CATEGORIES.find((c) => c.id === id);

const KNOWN_LABELS = CATEGORIES.filter((c) => c.id !== 'other').map((c) => c.label);

/** Categoria e referência não têm coluna própria: vão numa linha no começo da mensagem, que a equipe lê
 *  normalmente, e a tela separa de volta (`splitTicketBody`). */
export function composeTicketBody(input: { category?: CategoryId | null; reference?: string; message: string }): string {
  const lines = headerLines(input.category, input.reference);
  const text = input.message.trim();
  return lines.length ? `${lines.join('\n')}\n\n${text}` : text;
}

function headerLines(category?: CategoryId | null, reference?: string): string[] {
  const lines: string[] = [];
  const cat = categoryById(category);
  if (cat && cat.id !== 'other') lines.push(`Categoria: ${cat.label}`);
  const ref = (reference ?? '').replace(/\s+/g, ' ').trim().slice(0, REFERENCE_MAX);
  if (ref) lines.push(`Referência: ${ref}`);
  return lines;
}

/** Quantos caracteres sobram para o texto depois das linhas de categoria/referência. */
export function messageBudget(category?: CategoryId | null, reference?: string): number {
  const lines = headerLines(category, reference);
  return Math.max(0, MESSAGE_MAX - (lines.length ? lines.join('\n').length + 2 : 0));
}

export function splitTicketBody(body: string): { category: string | null; reference: string | null; text: string } {
  const plainBody = { category: null, reference: null, text: body };
  let rest = body;
  let category: string | null = null;
  let reference: string | null = null;
  const cat = /^Categoria: ([^\n]{1,80})\n/.exec(rest);
  if (cat && KNOWN_LABELS.includes(cat[1])) { category = cat[1]; rest = rest.slice(cat[0].length); }
  const ref = /^Referência: ([^\n]{1,120})\n/.exec(rest);
  if (ref) { reference = ref[1]; rest = rest.slice(ref[0].length); }
  if ((category === null && reference === null) || !rest.startsWith('\n')) return plainBody;
  return { category, reference, text: rest.replace(/^\n+/, '') };
}

export interface ComposerDraft { category: CategoryId; subject: string; reference: string; message: string; priority: string; files: File[] }
export const EMPTY_DRAFT: ComposerDraft = { category: 'other', subject: '', reference: '', message: '', priority: 'normal', files: [] };
export const isDraftDirty = (d: ComposerDraft): boolean => Boolean(d.subject.trim() || d.reference.trim() || d.message.trim() || d.files.length || d.category !== 'other' || d.priority !== 'normal');

export interface NewTicketInput { subject: string; message: string; reference: string; category: CategoryId | null }
export type NewTicketErrors = Partial<Record<'subject' | 'message' | 'reference', string>>;

export function validateNewTicket(input: NewTicketInput): NewTicketErrors {
  const errors: NewTicketErrors = {};
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (subject.length < SUBJECT_MIN) errors.subject = 'Resuma o assunto em poucas palavras.';
  else if (subject.length > SUBJECT_MAX) errors.subject = `Use até ${SUBJECT_MAX} caracteres.`;
  if (message.length < MESSAGE_MIN) errors.message = `Conte com um pouco mais de detalhe (mínimo ${MESSAGE_MIN} caracteres).`;
  else if (message.length > messageBudget(input.category, input.reference)) errors.message = 'A mensagem passou do limite. Reduza o texto.';
  if (input.reference.trim().length > REFERENCE_MAX) errors.reference = `Use até ${REFERENCE_MAX} caracteres.`;
  return errors;
}

/* ───────── Anexos ───────── */

type FileLike = { name: string; size: number; type?: string; lastModified?: number };

export function attachmentProblem(file: FileLike): string | null {
  if (file.size <= 0) return `"${file.name}" está vazio.`;
  if (file.size > MAX_FILE_SIZE_BYTES) return `"${file.name}" passa de ${MAX_FILE_SIZE_MB} MB.`;
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const typeOk = Boolean(file.type) && (file.type!.startsWith('image/') || file.type === 'application/pdf');
  if (!typeOk && !ACCEPTED_EXT.includes(ext)) return `"${file.name}": formato não aceito. Envie imagem, PDF, Word, Excel, TXT ou CSV.`;
  return null;
}

/** Junta os novos arquivos aos atuais respeitando limite, tamanho, formato e duplicados. */
export function mergeAttachments<T extends FileLike>(current: T[], incoming: T[]): { files: T[]; errors: string[] } {
  const files = [...current];
  const errors: string[] = [];
  let full = false;
  for (const file of incoming) {
    const problem = attachmentProblem(file);
    if (problem) { errors.push(problem); continue; }
    if (files.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
    if (files.length >= MAX_FILES_PER_MESSAGE) { full = true; continue; }
    files.push(file);
  }
  if (full) errors.push(`Máximo de ${MAX_FILES_PER_MESSAGE} arquivos por mensagem.`);
  return { files, errors };
}

/* ───────── Datas ───────── */

const SP = 'America/Sao_Paulo';
const dayKey = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: SP, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const dayDiff = (a: Date, b: Date): number => Math.round((Date.parse(dayKey(a)) - Date.parse(dayKey(b))) / 864e5);

/** "agora", "5 min", "3 h", "ontem", "seg.", "12 de set." (curto, para a lista). */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso);
  const minutes = Math.max(0, Math.floor((now - then.getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const days = dayDiff(new Date(now), then);
  if (days <= 0) return `${Math.floor(minutes / 60)} h`;
  if (days === 1) return 'ontem';
  if (days < 7) return new Intl.DateTimeFormat('pt-BR', { timeZone: SP, weekday: 'short' }).format(then);
  const sameYear = new Date(now).getFullYear() === then.getFullYear();
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SP, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: '2-digit' }) }).format(then).replace(/ de /g, ' ');
}

/** "23 nov." (com o ano quando não é o ano atual). */
export function formatDate(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  const sameYear = new Date(now).getFullYear() === d.getFullYear();
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SP, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(d).replace(/ de /g, ' ');
}

export const formatClock = (iso: string): string => new Intl.DateTimeFormat('pt-BR', { timeZone: SP, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const formatFull = (iso: string): string => {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: SP, day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(/ de /g, ' ');
  return `${date} às ${formatClock(iso)}`;
};

export function dayLabel(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  const diff = dayDiff(new Date(now), d);
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const sameYear = new Date(now).getFullYear() === d.getFullYear();
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SP, day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(d);
}

export function groupByDay<T extends { id: string; created_at: string }>(items: T[], now: number = Date.now()): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = dayKey(new Date(item.created_at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.created_at, now), items: [item] });
  }
  return groups;
}

/* ───────── Mensagens ───────── */

export function toMessage(row: Tables<'ticket_messages'>): SupportMessage {
  const attachments: Attachment[] = [];
  for (const a of Array.isArray(row.attachments) ? row.attachments : []) {
    if (typeof a === 'object' && a !== null && !Array.isArray(a) && typeof a.path === 'string' && typeof a.name === 'string' && typeof a.size === 'number' && typeof a.type === 'string') {
      attachments.push({ path: a.path, name: a.name, size: a.size, type: a.type });
    }
  }
  return { ...row, attachments };
}

/** Chamados antigos podem não ter linhas em `ticket_messages`: mostra o que está salvo no próprio chamado. */
export function legacyMessages(t: SupportTicket): SupportMessage[] {
  const base = { sender_id: '', read_by_customer: true, read_by_staff: true, attachments: [] as Attachment[], ticket_id: t.id };
  const out: SupportMessage[] = [{ ...base, id: `${t.id}-initial`, body: t.message, created_at: t.created_at, sender_type: 'customer', sender_name: null, sender_role: null }];
  if (t.admin_reply) out.push({ ...base, id: `${t.id}-legacy-reply`, body: t.admin_reply, created_at: t.replied_at || t.created_at, sender_type: 'staff', sender_name: t.admin_name, sender_role: t.admin_role });
  return out;
}

export type TextPart = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };

/** Transforma endereços http(s) do texto em links; nada além de http/https vira link. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /https?:\/\/[^\s<>"']+/gi;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let url = m[0];
    let tail = '';
    while (/[.,;:!?)\]}]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) });
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') parts.push({ type: 'link', text: url, href: parsed.href });
      else parts.push({ type: 'text', text: url });
    } catch { parts.push({ type: 'text', text: url }); }
    if (tail) parts.push({ type: 'text', text: tail });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return parts.length ? parts : [{ type: 'text', text }];
}

/* ───────── Central de ajuda ───────── */

export interface FaqItem { id: string; category: CategoryId; q: string; a: string; link?: { label: string; to: string } }
export const FAQ_ITEMS: FaqItem[] = [
  { id: 'payout-how', category: 'payouts', q: 'Como faço um saque?', a: 'Abra Financeiro › Saldo e saques, informe o valor, escolha o destino e confirme. O pedido aparece no histórico da mesma tela com o andamento.', link: { label: 'Ir para Saldo e saques', to: '/financeiro/saques' } },
  { id: 'payout-late', category: 'payouts', q: 'Meu saque ainda não caiu. O que fazer?', a: 'Veja o status no histórico de saques. Se ele seguir pendente depois do prazo informado na tela, abra um chamado com o valor, a data e o ID do saque.', link: { label: 'Ver meus saques', to: '/financeiro/saques' } },
  { id: 'payout-fees', category: 'payouts', q: 'Onde vejo minhas taxas e o prazo de liberação?', a: 'Em Financeiro › Taxas ficam as tarifas do seu plano e o prazo em que cada venda passa a contar como saldo disponível.', link: { label: 'Ver minhas taxas', to: '/financeiro/taxas' } },
  { id: 'payout-pix', category: 'payouts', q: 'Como cadastro ou troco minha chave Pix?', a: 'Em Financeiro › Dados bancários você cadastra as chaves Pix e as contas usadas nos saques.', link: { label: 'Abrir dados bancários', to: '/financeiro/config' } },
  { id: 'sales-link', category: 'sales', q: 'Como crio um link de pagamento?', a: 'Em Vendas › Link de pagamento você define o valor e a descrição, e compartilha o link para o cliente pagar por Pix ou cartão.', link: { label: 'Criar link de pagamento', to: '/vendas/link-pagamento' } },
  { id: 'sales-missing', category: 'sales', q: 'O cliente diz que pagou, mas a venda não aparece', a: 'Procure o pedido em Vendas e veja se está pendente ou expirado. Se o cliente pagou mesmo, abra um chamado com o ID da transação e o comprovante.', link: { label: 'Ver minhas vendas', to: '/vendas' } },
  { id: 'sales-checkout', category: 'sales', q: 'Como personalizo meu checkout?', a: 'Em Produtos › Checkouts você ajusta cores, banner, contagem regressiva e os meios de pagamento de cada produto.', link: { label: 'Abrir checkouts', to: '/vendas/checkout' } },
  { id: 'products-review', category: 'products', q: 'Meu produto está em análise. Quanto demora?', a: 'Produtos novos passam por aprovação e o status aparece em Meus produtos. Se ficar parado por muito tempo, abra um chamado com o nome do produto.', link: { label: 'Ver meus produtos', to: '/vendas/produtos' } },
  { id: 'products-members', category: 'products', q: 'Como entrego conteúdo na área de membros?', a: 'Em Produtos › Área de membros você cria o curso, organiza módulos e aulas e liga o curso ao produto vendido.', link: { label: 'Abrir área de membros', to: '/vendas/conteudo' } },
  { id: 'account-verify', category: 'account', q: 'Como verifico minha conta?', a: 'Em Minha conta › Identidade você envia os documentos pedidos e acompanha a análise na mesma tela.', link: { label: 'Abrir verificação', to: '/perfil?tab=identidade' } },
  { id: 'account-password', category: 'account', q: 'Como troco minha senha?', a: 'Em Minha conta › Segurança você cria uma senha nova e pode sair dos outros aparelhos.', link: { label: 'Abrir segurança', to: '/perfil?tab=seguranca' } },
  { id: 'account-secrets', category: 'account', q: 'Posso mandar senha ou código no chamado?', a: 'Não. A equipe nunca pede senha, código de verificação nem chave secreta. Se alguém pedir, não envie.' },
  { id: 'api-keys', category: 'integrations', q: 'Onde pego minhas credenciais de API?', a: 'Em Integrações › Credenciais de API você cria, pausa e revoga chaves. O segredo aparece uma única vez, na criação.', link: { label: 'Abrir credenciais', to: '/integracoes?tab=keys' } },
  { id: 'webhooks', category: 'integrations', q: 'Como configuro um webhook?', a: 'Em Integrações › Webhooks você cadastra a URL https, escolhe os eventos e envia um teste para conferir.', link: { label: 'Abrir webhooks', to: '/integracoes?tab=webhooks' } },
  { id: 'docs', category: 'integrations', q: 'Onde está a documentação?', a: 'O guia de integração, com exemplos de assinatura de webhook, fica em Integrações › Documentação.', link: { label: 'Abrir documentação', to: '/integracoes?tab=api' } },
];

export function searchFaq(items: FaqItem[], query: string, category: CategoryId | null): FaqItem[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (category && category !== 'other' && item.category !== category) return false;
    if (!words.length) return true;
    const hay = plain(`${item.q} ${item.a}`);
    return words.every((w) => hay.includes(w));
  });
}
