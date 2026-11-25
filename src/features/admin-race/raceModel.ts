import type { Tone } from "@/features/admin-disputes/disputesModel";
import { fmtDateTime } from "@/features/admin-finance/format";
import { parseBRL } from "@/components/seller-ui/money";
import { safeNavigationUrl } from "@/lib/safeUrl";

export type { Tone };
export const dateLabel = fmtDateTime;

const TZ = "America/Sao_Paulo";

/* ───────── limites (espelham as funções do banco) ───────── */

export const LIMITS = {
  title: 80, titleMin: 3, description: 500, prizeTitle: 80, prizeDescription: 300, entryName: 40, reason: 300, reasonMin: 5,
  maxDays: 400, maxPosition: 100, maxGoalReais: 100_000_000, maxEntryReais: 1_000_000_000, maxSales: 10_000_000,
} as const;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/* ───────── leitura das respostas do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export interface RaceItem {
  id: string; title: string; description: string; starts_at: string; ends_at: string; is_active: boolean; is_live: boolean;
  banner_url: string | null; logo_url: string | null; created_at: string;
  prizes: number; entries: number; fictional: number; participants: number; revenue_cents: number; sales: number;
}
export interface RacesData { items: RaceItem[]; live_id: string | null }

function parseRaceItem(r: Record<string, unknown>): RaceItem {
  return {
    id: str(r.id), title: str(r.title), description: str(r.description), starts_at: str(r.starts_at), ends_at: str(r.ends_at),
    is_active: r.is_active === true, is_live: r.is_live === true, banner_url: strOrNull(r.banner_url), logo_url: strOrNull(r.logo_url),
    created_at: str(r.created_at), prizes: num(r.prizes), entries: num(r.entries), fictional: num(r.fictional),
    participants: num(r.participants), revenue_cents: num(r.revenue_cents), sales: num(r.sales),
  };
}

export function parseRaces(raw: unknown): RacesData {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  return { items: raw.items.filter(isObj).map(parseRaceItem), live_id: strOrNull(raw.live_id) };
}

export type PrizeKind = "place" | "goal";
export interface PrizeItem { id: string; title: string; description: string; image_url: string | null; kind: PrizeKind; position: number | null; goal_cents: number; sort_order: number }
export interface EntryItem {
  id: string; seller_id: string | null; display_name: string; avatar_url: string | null; revenue_cents: number; sales_count: number; updated_at: string;
  seller: { name: string | null; email: string | null } | null; real_revenue_cents: number; real_sales: number;
}
export interface BoardRow { rank: number; seller_id: string | null; name: string; revenue_cents: number; sales_count: number; is_manual: boolean; has_account: boolean; email: string | null }
export interface HistoryItem { at: string; action: string; by: string | null; details: Record<string, unknown> }
export interface RaceDetail {
  race: RaceItem; live_title: string | null; totals: { participants: number; revenue_cents: number; sales: number };
  prizes: PrizeItem[]; entries: EntryItem[]; board: BoardRow[]; history: HistoryItem[];
}

const parsePrize = (r: Record<string, unknown>): PrizeItem => {
  const place = r.kind === "place";
  return {
    id: str(r.id), title: str(r.title), description: str(r.description), image_url: strOrNull(r.image_url), kind: place ? "place" : "goal",
    position: place ? num(r.position) || null : null, goal_cents: num(r.goal_cents), sort_order: num(r.sort_order),
  };
};
const parseEntry = (r: Record<string, unknown>): EntryItem => ({
  id: str(r.id), seller_id: strOrNull(r.seller_id), display_name: str(r.display_name), avatar_url: strOrNull(r.avatar_url),
  revenue_cents: num(r.revenue_cents), sales_count: num(r.sales_count), updated_at: str(r.updated_at),
  seller: isObj(r.seller) ? { name: strOrNull(r.seller.name), email: strOrNull(r.seller.email) } : null,
  real_revenue_cents: num(r.real_revenue_cents), real_sales: num(r.real_sales),
});
const parseBoard = (r: Record<string, unknown>): BoardRow => ({
  rank: num(r.rank), seller_id: strOrNull(r.seller_id), name: str(r.name) || "Seller", revenue_cents: num(r.revenue_cents), sales_count: num(r.sales_count),
  is_manual: r.is_manual === true, has_account: r.has_account === true, email: strOrNull(r.email),
});

export function parseRaceDetail(raw: unknown): RaceDetail {
  if (!isObj(raw) || !isObj(raw.race)) throw new Error("Resposta inesperada do servidor.");
  const t = isObj(raw.totals) ? raw.totals : {};
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : []);
  return {
    race: parseRaceItem({ ...raw.race, prizes: list(raw.prizes).length, entries: list(raw.entries).length, fictional: list(raw.entries).filter((e) => !strOrNull(e.seller_id)).length }),
    live_title: strOrNull(raw.live_title),
    totals: { participants: num(t.participants), revenue_cents: num(t.revenue_cents), sales: num(t.sales) },
    prizes: list(raw.prizes).map(parsePrize),
    entries: list(raw.entries).map(parseEntry),
    board: list(raw.board).map(parseBoard),
    history: list(raw.history).map((h) => ({ at: str(h.at), action: str(h.action), by: strOrNull(h.by), details: isObj(h.details) ? h.details : {} })),
  };
}

/* ───────── datas (sempre no horário de Brasília) ───────── */

export const shortDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
};

/** Valor do campo `datetime-local` (sem fuso) para um instante, no horário de Brasília. */
export function toSpInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return parts.replace(" ", "T");
}

/** O contrário: o texto do campo é hora de Brasília (UTC−3, sem horário de verão). Devolve `null` se estiver incompleto. */
export function fromSpInput(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type Phase = "upcoming" | "running" | "ended";

export function phaseOf(r: { starts_at: string; ends_at: string }, now = Date.now()): Phase {
  const s = Date.parse(r.starts_at);
  const e = Date.parse(r.ends_at);
  if (Number.isFinite(s) && now < s) return "upcoming";
  if (Number.isFinite(e) && now >= e) return "ended";
  return "running";
}

export function spanLabel(ms: number): string {
  const h = Math.floor(Math.max(0, ms) / 3_600_000);
  if (h < 1) return "menos de 1 hora";
  if (h < 48) return `${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d} dias`;
  const w = Math.floor(d / 7);
  return `${w} semanas`;
}

/** Em que pé a corrida está: "Termina em 12 dias", "Começa em 3 dias", "Terminou em 13 ago 2026". */
export function phaseLine(r: { starts_at: string; ends_at: string }, now = Date.now()): string {
  const phase = phaseOf(r, now);
  if (phase === "upcoming") return `Começa em ${spanLabel(Date.parse(r.starts_at) - now)}`;
  if (phase === "running") return `Termina em ${spanLabel(Date.parse(r.ends_at) - now)}`;
  return `Terminou em ${shortDate(r.ends_at)}`;
}

export function raceTag(r: Pick<RaceItem, "is_live" | "starts_at" | "ends_at">, now = Date.now()): { label: string; tone: Tone } {
  if (!r.is_live) return { label: "Oculta", tone: "neutral" };
  const phase = phaseOf(r, now);
  if (phase === "running") return { label: "No ar", tone: "success" };
  if (phase === "upcoming") return { label: "Agendada", tone: "info" };
  return { label: "Encerrada, visível", tone: "warning" };
}

/* ───────── dinheiro ───────── */

const f0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const centsToReais = (c: number) => (Number.isFinite(c) ? c / 100 : 0);
export const brl0 = (cents: number) => f0.format(centsToReais(cents));
export const brl2 = (cents: number) => f2.format(centsToReais(cents));
export const reaisToCents = (reais: number) => Math.round(reais * 100);
export const n0 = (v: number) => v.toLocaleString("pt-BR");
export const plural = (n: number, one: string, many: string) => `${n0(n)} ${n === 1 ? one : many}`;

/* ───────── formulários e validação ───────── */

export interface RaceForm { title: string; description: string; starts: string; ends: string; banner_url: string; logo_url: string }
export type FormErrors<T> = Partial<Record<keyof T, string>>;

export function raceErrors(f: RaceForm): FormErrors<RaceForm> {
  const e: FormErrors<RaceForm> = {};
  const title = f.title.trim().replace(/\s+/g, " ");
  if (title.length < LIMITS.titleMin || title.length > LIMITS.title) e.title = `Dê um nome à corrida, de ${LIMITS.titleMin} a ${LIMITS.title} caracteres.`;
  if (f.description.trim().length > LIMITS.description) e.description = `A descrição passa de ${LIMITS.description} caracteres.`;
  const s = fromSpInput(f.starts);
  const en = fromSpInput(f.ends);
  if (!s) e.starts = "Informe o início.";
  if (!en) e.ends = "Informe o fim.";
  if (s && en) {
    const span = Date.parse(en) - Date.parse(s);
    if (span <= 0) e.ends = "O fim precisa ser depois do início.";
    else if (span > LIMITS.maxDays * 86_400_000) e.ends = `A corrida pode durar no máximo ${LIMITS.maxDays} dias.`;
  }
  return e;
}

/** Mudar o início ou o fim de uma corrida que já começou muda quem vence: o servidor pede a senha. */
export function raceNeedsPassword(race: Pick<RaceItem, "starts_at" | "ends_at"> | null, f: Pick<RaceForm, "starts" | "ends">, now = Date.now()): boolean {
  if (!race || Date.parse(race.starts_at) > now) return false;
  return toSpInput(race.starts_at) !== f.starts || toSpInput(race.ends_at) !== f.ends;
}

export interface PrizeForm { title: string; description: string; kind: PrizeKind; position: string; goal: string; image_url: string }

export function prizeErrors(f: PrizeForm, taken: number[]): FormErrors<PrizeForm> {
  const e: FormErrors<PrizeForm> = {};
  const title = f.title.trim();
  if (title.length < 2 || title.length > LIMITS.prizeTitle) e.title = `Dê um nome ao prêmio, de 2 a ${LIMITS.prizeTitle} caracteres.`;
  if (f.description.trim().length > LIMITS.prizeDescription) e.description = `A descrição passa de ${LIMITS.prizeDescription} caracteres.`;
  if (f.kind === "place") {
    const p = Number(f.position);
    if (!/^\d{1,3}$/.test(f.position.trim()) || p < 1 || p > LIMITS.maxPosition) e.position = `A colocação vai de 1º a ${LIMITS.maxPosition}º.`;
    else if (taken.includes(p)) e.position = `O ${p}º lugar já tem um prêmio nesta corrida.`;
  } else {
    const g = parseBRL(f.goal);
    if (!(g > 0)) e.goal = "Informe a meta de faturamento.";
    else if (g > LIMITS.maxGoalReais) e.goal = "A meta pode ir até R$ 100.000.000.";
  }
  const img = f.image_url.trim();
  if (img && !safeNavigationUrl(img)) e.image_url = "O link da imagem precisa começar com http:// ou https://.";
  return e;
}

export function prizeNeedsPassword(raceStarted: boolean, prize: PrizeItem | null, f: PrizeForm): boolean {
  if (!raceStarted) return false;
  if (!prize) return true;
  if (prize.kind !== f.kind) return true;
  if (f.kind === "place") return prize.position !== Number(f.position);
  return prize.goal_cents !== reaisToCents(parseBRL(f.goal));
}

export type EntryMode = "account" | "fictional";
export interface EntryForm { mode: EntryMode; name: string; revenue: string; sales: string; reason: string }

export function entryErrors(f: EntryForm, creating: boolean, hasSeller: boolean): FormErrors<EntryForm> & { seller?: string } {
  const e: FormErrors<EntryForm> & { seller?: string } = {};
  const name = f.name.trim().replace(/\s+/g, " ");
  if (creating && f.mode === "account" && !hasSeller) e.seller = "Escolha o seller.";
  if (!(creating && f.mode === "account" && name === "") && (name.length < 2 || name.length > LIMITS.entryName)) e.name = `O nome exibido vai de 2 a ${LIMITS.entryName} caracteres.`;
  const rev = parseBRL(f.revenue);
  if (rev < 0 || rev > LIMITS.maxEntryReais) e.revenue = "O faturamento vai de R$ 0 a R$ 1.000.000.000.";
  const s = f.sales.trim();
  if (s !== "" && (!/^\d{1,8}$/.test(s) || Number(s) > LIMITS.maxSales)) e.sales = "Informe só números, de 0 a 10.000.000.";
  const reason = f.reason.trim();
  if (reason.length < LIMITS.reasonMin) e.reason = `Explique o motivo (mínimo ${LIMITS.reasonMin} caracteres). Fica na auditoria.`;
  else if (reason.length > LIMITS.reason) e.reason = `O motivo passa de ${LIMITS.reason} caracteres.`;
  return e;
}

/* ───────── quem leva cada prêmio ───────── */

export interface PrizeHolders { prize: PrizeItem; holders: BoardRow[] }

/** Prêmio de colocação vai para quem está naquela posição; meta de faturamento, para todo mundo que já bateu. */
export function holdersFor(prize: PrizeItem, board: BoardRow[]): BoardRow[] {
  if (prize.kind === "place") {
    const r = board.find((b) => b.rank === prize.position);
    return r ? [r] : [];
  }
  return board.filter((b) => b.revenue_cents >= prize.goal_cents && prize.goal_cents > 0).sort((a, b) => a.rank - b.rank);
}

export const prizeHolders = (prizes: PrizeItem[], board: BoardRow[]): PrizeHolders[] => prizes.map((prize) => ({ prize, holders: holdersFor(prize, board) }));

export const prizeLabel = (p: PrizeItem) => (p.kind === "place" ? `${p.position}º lugar` : `Meta de ${brl0(p.goal_cents)}`);

export const holderLine = (b: BoardRow) => `${b.name}${b.email ? ` <${b.email}>` : ""}${b.has_account ? "" : " (sem conta)"}`;

/** Texto para colar numa planilha ou mensagem: um prêmio por bloco. */
export function winnersText(race: string, rows: PrizeHolders[]): string {
  const lines = [race];
  for (const { prize, holders } of rows) {
    lines.push("", `${prizeLabel(prize)}: ${prize.title}`);
    if (holders.length === 0) lines.push("  ninguém ainda");
    for (const h of holders) lines.push(`  ${h.rank}º ${holderLine(h)}, ${brl2(h.revenue_cents)}`);
  }
  return lines.join("\n");
}

/* ───────── histórico ───────── */

const d = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const money = (v: unknown) => (typeof v === "number" ? brl2(v) : "");
const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join("\n") || null;

export function historyEntry(h: HistoryItem): { title: string; text: string | null } {
  const x = h.details;
  switch (h.action) {
    case "race_create": return { title: "Corrida criada", text: join(d(x.title) && `“${d(x.title)}”`, "Nasceu oculta.") };
    case "race_update": {
      const win = (label: string, from: unknown, to: unknown) => from && to ? `${label}: ${dateLabel(String(from))} para ${dateLabel(String(to))}` : "";
      return { title: "Corrida editada", text: join(
        d(x.title_from) && `Nome: “${d(x.title_from)}” para “${d(x.title)}”`,
        win("Início", x.starts_from, x.starts_to), win("Fim", x.ends_from, x.ends_to),
        x.banner_changed === true && "Banner trocado", x.logo_changed === true && "Logo trocado") };
    }
    case "race_activate": return { title: "Colocada no ar", text: "Os sellers passaram a ver esta corrida." };
    case "race_deactivate": return { title: "Tirada do ar", text: d(x.replaced_by) ? "Outra corrida foi colocada no lugar." : "Os sellers deixaram de ver esta corrida." };
    case "race_delete": return { title: "Corrida apagada", text: null };
    case "race_prize_create": return { title: "Prêmio criado", text: d(x.title) || null };
    case "race_prize_update": return { title: "Prêmio editado", text: join(d(x.title),
      x.position_from !== x.position_to && `Colocação: ${x.position_from ?? "meta"} para ${x.position_to ?? "meta"}`,
      x.goal_from !== x.goal_to && (x.goal_from || x.goal_to) && `Meta: ${money(x.goal_from) || "—"} para ${money(x.goal_to) || "—"}`) };
    case "race_prize_move": return { title: "Prêmio reordenado", text: d(x.title) || null };
    case "race_prize_delete": return { title: "Prêmio apagado", text: d(x.title) || null };
    case "race_entry_create": return { title: x.linked === true ? "Valor fixo para um seller" : "Participante sem conta adicionado", text: join(
      d(x.name), `${money(x.revenue_cents)}, ${typeof x.sales_count === "number" ? plural(x.sales_count, "venda", "vendas") : ""}`.replace(/, $/, ""), d(x.reason) && `Motivo: ${d(x.reason)}`) };
    case "race_entry_update": return { title: "Valor fixo alterado", text: join(
      d(x.name), `Faturamento: ${money(x.revenue_from)} para ${money(x.revenue_to)}`, d(x.reason) && `Motivo: ${d(x.reason)}`) };
    case "race_entry_delete": return { title: "Valor fixo removido", text: join(d(x.name), d(x.reason) && `Motivo: ${d(x.reason)}`) };
    default: return { title: "Alteração na corrida", text: null };
  }
}

/* ───────── imagens ───────── */

/** Caminho do arquivo dentro do bucket `race-assets` quando o endereço é de lá; `null` para qualquer outro link. */
export function assetPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/race-assets/";
  const i = url.indexOf(marker);
  if (!url.includes("/storage/v1/object/") || i < 0) return null;
  try { return decodeURIComponent(url.slice(i + marker.length).split("?")[0]); } catch { return null; }
}

export function imageProblem(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "Envie uma imagem PNG, JPG, WebP ou GIF.";
  if (file.size > IMAGE_MAX_BYTES) return "A imagem passa de 5 MB.";
  return null;
}

/* ───────── textos de tela ───────── */

export function heroStatus(data: RacesData | undefined, failed: boolean, now = Date.now()): { tone: Tone; label: string; pulse?: boolean } {
  if (!data) return failed ? { tone: "destructive", label: "Não foi possível carregar" } : { tone: "neutral", label: "Carregando…" };
  const live = data.items.find((r) => r.is_live);
  if (!live) return { tone: "neutral", label: data.items.length === 0 ? "Nenhuma corrida criada" : "Nenhuma corrida no ar" };
  const phase = phaseOf(live, now);
  if (phase === "running") return { tone: "success", label: `No ar, ${phaseLine(live, now).toLowerCase()}`, pulse: true };
  if (phase === "upcoming") return { tone: "info", label: `Agendada, ${phaseLine(live, now).toLowerCase()}` };
  return { tone: "warning", label: "A corrida no ar já terminou" };
}
