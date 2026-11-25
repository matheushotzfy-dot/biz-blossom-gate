import type { Tone } from "@/features/admin-disputes/disputesModel";
import { fmtDateTime } from "@/features/admin-finance/format";

export type { Tone };
export const dateLabel = fmtDateTime;

/** Limites que o banco confere de novo (`admin_set_kill_switch`, `admin_add_seller_note`, `admin_export_page`). */
export const LIMITS = { reasonMin: 5, reason: 300, noteMin: 3, note: 2000, maxDays: 400, pageSize: 1000, maxRows: 50_000 } as const;

/* ───────── leitura das respostas do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export type SwitchKey = "payments" | "withdrawals";
export const SWITCH_KEYS: SwitchKey[] = ["payments", "withdrawals"];

export interface SwitchState { paused: boolean; at: string | null; by: string | null; reason: string | null }
export interface HistoryItem { at: string; action: string; by: string | null; details: Record<string, unknown> }
export interface ToolsData {
  switches: Record<SwitchKey, SwitchState>;
  program: { notes: number; exports30d: number; sellers: number };
  history: HistoryItem[];
}

const parseSwitch = (v: unknown): SwitchState => {
  const r = isObj(v) ? v : {};
  return { paused: r.paused === true, at: strOrNull(r.at), by: strOrNull(r.by), reason: strOrNull(r.reason) };
};

export function parseTools(raw: unknown): ToolsData {
  if (!isObj(raw) || !isObj(raw.switches)) throw new Error("Resposta inesperada do servidor.");
  const p = isObj(raw.program) ? raw.program : {};
  return {
    switches: { payments: parseSwitch(raw.switches.payments), withdrawals: parseSwitch(raw.switches.withdrawals) },
    program: { notes: num(p.notes), exports30d: num(p.exports_30d), sellers: num(p.sellers) },
    history: (Array.isArray(raw.history) ? raw.history : []).filter(isObj).map((h) => ({ at: str(h.at), action: str(h.action), by: strOrNull(h.by), details: isObj(h.details) ? h.details : {} })),
  };
}

export interface NoteItem {
  id: string; seller_id: string; seller_name: string; seller_email: string | null;
  author_name: string | null; author_role: string; content: string; created_at: string;
}
export interface NotesData { total: number; items: NoteItem[] }

export function parseNotes(raw: unknown): NotesData {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const items = raw.items.filter(isObj).map((n) => ({
    id: str(n.id), seller_id: str(n.seller_id), seller_name: str(n.seller_name) || "Seller sem nome", seller_email: strOrNull(n.seller_email),
    author_name: strOrNull(n.author_name), author_role: str(n.author_role) || "admin", content: str(n.content), created_at: str(n.created_at),
  }));
  return { total: num(raw.total) || items.length, items };
}

/* ───────── pausas ───────── */

export interface SwitchCopy {
  title: string;
  /** o que acontece enquanto estiver pausado, sem prometer o que o sistema não faz */
  effect: string;
  pause: { label: string; title: string; description: string };
  resume: { label: string; title: string; description: string };
  pausedWord: string;
  openWord: string;
  heroPaused: string;
}

export const SWITCH_COPY: Record<SwitchKey, SwitchCopy> = {
  payments: {
    title: "Pagamentos",
    effect: "Enquanto estiver pausado, nenhuma venda real é registrada. Vendas de teste (simuladas) continuam funcionando.",
    pause: { label: "Pausar pagamentos", title: "Pausar os pagamentos?", description: "Nenhuma venda real será registrada até você liberar. Explique o motivo: ele fica salvo e aparece no histórico." },
    resume: { label: "Liberar pagamentos", title: "Liberar os pagamentos?", description: "As vendas reais voltam a ser registradas. Explique por que está liberando: fica salvo no histórico." },
    pausedWord: "Pausados", openWord: "Liberados", heroPaused: "Pagamentos pausados",
  },
  withdrawals: {
    title: "Saques",
    effect: "Enquanto estiver pausado, os sellers não conseguem pedir novos saques. Os que já estão na fila seguem o fluxo normal.",
    pause: { label: "Pausar saques", title: "Pausar os saques?", description: "Os sellers não conseguirão pedir novos saques até você liberar. Explique o motivo: ele fica salvo e aparece no histórico." },
    resume: { label: "Liberar saques", title: "Liberar os saques?", description: "Os sellers voltam a poder pedir saques. Explique por que está liberando: fica salvo no histórico." },
    pausedWord: "Pausados", openWord: "Liberados", heroPaused: "Saques pausados",
  },
};

export function heroStatus(data: ToolsData | undefined, failed: boolean): { tone: Tone; label: string; pulse?: boolean } {
  if (!data) return failed ? { tone: "destructive", label: "Não foi possível carregar" } : { tone: "neutral", label: "Carregando…" };
  const paused = SWITCH_KEYS.filter((k) => data.switches[k].paused);
  if (paused.length === 2) return { tone: "destructive", label: "Pagamentos e saques pausados" };
  if (paused.length === 1) return { tone: "destructive", label: SWITCH_COPY[paused[0]].heroPaused };
  return { tone: "success", label: "Tudo liberado", pulse: true };
}

/** "Pausado em 25/11/2026 às 13:45, por Fulana." para o cartão de cada pausa. */
export function sinceLine(s: SwitchState): string | null {
  if (!s.at) return null;
  return `${s.paused ? "Pausado" : "Liberado"} em ${dateLabel(s.at)}${s.by ? `, por ${s.by}` : ""}.`;
}

/* ───────── exportação ───────── */

export type ExportKind = "transactions" | "withdrawals" | "sellers";
export const EXPORT_KINDS: ExportKind[] = ["transactions", "withdrawals", "sellers"];

export const EXPORT_COPY: Record<ExportKind, { title: string; description: string; usesPeriod: boolean; file: string; plural: string }> = {
  transactions: { title: "Transações", description: "Vendas do período, com seller, produto, cliente e valores. Sem CPF nem telefone do cliente.", usesPeriod: true, file: "transacoes", plural: "transações" },
  withdrawals: { title: "Saques", description: "Pedidos de saque do período, com seller, valores, taxa e situação.", usesPeriod: true, file: "saques", plural: "saques" },
  sellers: { title: "Sellers", description: "Todas as contas de seller, de qualquer época. Não depende do período escolhido no topo.", usesPeriod: false, file: "sellers", plural: "contas" },
};

const TX_STATUS: Record<string, string> = {
  paid: "Pago", approved: "Aprovado", pending: "Pendente", processing: "Em processamento", failed: "Falhou", refused: "Recusado", rejected: "Recusado",
  refunded: "Reembolsado", chargeback: "Chargeback", cancelled: "Cancelado", canceled: "Cancelado", expired: "Expirado", completed: "Concluído", in_review: "Em análise",
};
const METHOD: Record<string, string> = { pix: "PIX", credit_card: "Cartão", card: "Cartão", boleto: "Boleto", crypto: "Cripto" };
const WD_TYPE: Record<string, string> = { pix: "PIX", crypto: "Cripto", bank: "Conta bancária" };
const ACCOUNT: Record<string, string> = { active: "Ativa", approved: "Ativa", pending: "Pendente", suspended: "Suspensa", blocked: "Bloqueada", banned: "Bloqueada", rejected: "Recusada", under_review: "Em análise" };
const label = (map: Record<string, string>, v: unknown) => { const s = typeof v === "string" ? v : ""; return s ? (map[s.toLowerCase()] ?? s) : ""; };

/** Fuso de Brasília, para o arquivo bater com o que a equipe vê nas telas. */
export function spDateTime(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(d).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** AAAA-MM-DD no fuso de Brasília (nome de arquivo e período). */
export function spDay(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p;
}

export interface Column { header: string; value: (row: Record<string, unknown>) => unknown }
const col = (header: string, value: Column["value"]): Column => ({ header, value });
const pick = (k: string): Column["value"] => (r) => r[k];

/** A ordem das colunas é definida aqui: o JSON do banco não garante ordem de chaves. */
export const COLUMNS: Record<ExportKind, Column[]> = {
  transactions: [
    col("Data", (r) => spDateTime(r.created_at)), col("Status", (r) => label(TX_STATUS, r.status)), col("Valor", pick("amount")), col("Líquido", pick("net_amount")),
    col("Seller", pick("seller_name")), col("E-mail do seller", pick("seller_email")), col("Produto", pick("product")),
    col("Cliente", pick("customer_name")), col("E-mail do cliente", pick("customer_email")), col("Pagamento", (r) => label(METHOD, r.payment_method)),
    col("Simulada", (r) => (r.simulated === true ? "Sim" : "Não")), col("ID", pick("id")),
  ],
  withdrawals: [
    col("Data", (r) => spDateTime(r.created_at)), col("Seller", pick("seller_name")), col("E-mail do seller", pick("seller_email")),
    col("Valor", pick("amount")), col("Taxa", pick("fee_amount")), col("Líquido", pick("net_amount")),
    col("Status", (r) => label(TX_STATUS, r.status)), col("Tipo", (r) => label(WD_TYPE, r.type)), col("ID", pick("id")),
  ],
  sellers: [
    col("Nome", pick("name")), col("E-mail", pick("email")), col("Telefone", pick("phone")), col("Situação da conta", (r) => label(ACCOUNT, r.status)),
    col("Cadastro", (r) => spDateTime(r.created_at)), col("ID", pick("id")),
  ],
};

/**
 * Uma célula do CSV. Texto que começa com = + - @ ou tabulação seria lido como fórmula pelo Excel/Planilhas
 * (nome de cliente é digitado por qualquer pessoa): ganha um apóstrofo na frente. Número sai com vírgula decimal.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Texto do CSV (`;` e quebra de linha do Windows). O BOM entra na hora de baixar. */
export function toCsv(kind: ExportKind, rows: Record<string, unknown>[]): string {
  const cols = COLUMNS[kind];
  return [cols.map((c) => csvCell(c.header)).join(";"), ...rows.map((r) => cols.map((c) => csvCell(c.value(r))).join(";"))].join("\r\n");
}

export function fileName(kind: ExportKind, from: Date, to: Date, today = new Date()): string {
  const base = EXPORT_COPY[kind].file;
  if (!EXPORT_COPY[kind].usesPeriod) return `${base}-${spDay(today)}.csv`;
  const a = spDay(from), b = spDay(to);
  return a === b ? `${base}-${a}.csv` : `${base}-${a}_a_${b}.csv`;
}

export interface Period { from: Date; to: Date }

/** Problema com o período do topo, em português; `null` quando dá para exportar. */
export function periodProblem(p: Period): string | null {
  const days = (p.to.getTime() - p.from.getTime()) / 86_400_000;
  if (!(days > 0)) return "O período escolhido no topo é inválido.";
  if (days > LIMITS.maxDays) return `O período pode ter no máximo ${LIMITS.maxDays} dias. Reduza no seletor do topo.`;
  return null;
}

export function periodText(p: Period): string {
  const a = spDay(p.from).split("-").reverse().join("/"), b = spDay(p.to).split("-").reverse().join("/");
  return a === b ? a : `${a} a ${b}`;
}

export interface ExportPage { rows: Record<string, unknown>[]; count: number; total: number; next: { at: string; id: string } | null }

export function parsePage(raw: unknown): ExportPage {
  if (!isObj(raw) || !Array.isArray(raw.rows)) throw new Error("Resposta inesperada do servidor.");
  const n = isObj(raw.next) && typeof raw.next.at === "string" && typeof raw.next.id === "string" ? { at: raw.next.at, id: raw.next.id } : null;
  return { rows: raw.rows.filter(isObj), count: num(raw.count) || raw.rows.length, total: num(raw.total), next: n };
}

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/* ───────── histórico ───────── */

const KIND_NAME: Record<string, string> = { transactions: "de transações", withdrawals: "de saques", sellers: "de sellers" };
const d = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const join = (...parts: (string | null | false | undefined)[]): string | null => { const p = parts.filter(Boolean) as string[]; return p.length ? p.join(". ") + "." : null; };

export function historyEntry(h: HistoryItem): { title: string; text: string | null } {
  const x = h.details;
  switch (h.action) {
    case "kill_switch_payments_on": return { title: "Pagamentos pausados", text: d(x.reason) ? `Motivo: ${d(x.reason)}` : null };
    case "kill_switch_payments_off": return { title: "Pagamentos liberados", text: d(x.reason) ? `Motivo: ${d(x.reason)}` : null };
    case "kill_switch_withdrawals_on": return { title: "Saques pausados", text: d(x.reason) ? `Motivo: ${d(x.reason)}` : null };
    case "kill_switch_withdrawals_off": return { title: "Saques liberados", text: d(x.reason) ? `Motivo: ${d(x.reason)}` : null };
    case "seller_note_create":
    case "seller_note_created": return { title: "Nota criada", text: join(d(x.seller_name) && `Seller: ${d(x.seller_name)}`, typeof x.length === "number" && `${plural(x.length, "caractere", "caracteres")}`) };
    case "data_export": {
      const kind = d(x.kind) ?? "";
      const total = typeof x.total === "number" ? plural(x.total, "linha", "linhas") : null;
      const from = d(x.from), to = d(x.to);
      return { title: `Exportação ${KIND_NAME[kind] ?? "de dados"}`, text: join(total, from && to && `Período: ${periodText({ from: new Date(from), to: new Date(new Date(to).getTime() - 1) })}`) };
    }
    default: return { title: "Alteração nas ferramentas", text: null };
  }
}

export function noteAuthor(n: NoteItem): string {
  const who = n.author_name ?? "Equipe";
  return n.author_role === "admin" ? who : `${who} (equipe)`;
}
