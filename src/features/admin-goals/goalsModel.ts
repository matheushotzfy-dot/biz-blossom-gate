import type { Tone } from "@/features/admin-disputes/disputesModel";
import { fmtDateTime } from "@/features/admin-finance/format";
import { parseBRL } from "@/components/seller-ui/money";
import { fromSpInput, phaseLine, phaseOf, plural, shortDate, toSpInput } from "@/features/admin-race/raceModel";

export type { Tone };
export { fromSpInput, phaseLine, phaseOf, plural, shortDate, toSpInput };
export const dateLabel = fmtDateTime;

/** Limites que o banco confere de novo (CHECKs e `admin_save_goal`). */
export const LIMITS = { title: 80, titleMin: 3, rewardTitle: 80, rewardTitleMin: 2, description: 500, maxDays: 400, maxTarget: 100_000_000, reasonMin: 5, reason: 300 } as const;

/* ───────── leitura das respostas do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export interface GoalCore {
  id: string; title: string; description: string; target: number; starts_at: string; ends_at: string;
  reward_title: string; reward_description: string; is_active: boolean; created_at: string;
}
export interface GoalItem extends GoalCore {
  sellers: number; reached: number; to_deliver: number; revenue: number; top: number;
  awards: { pending: number; paid: number; cancelled: number };
}
export interface GoalsData { items: GoalItem[]; total: number }

const parseCore = (r: Record<string, unknown>): GoalCore => ({
  id: str(r.id), title: str(r.title), description: str(r.description), target: num(r.target), starts_at: str(r.starts_at), ends_at: str(r.ends_at),
  reward_title: str(r.reward_title), reward_description: str(r.reward_description), is_active: r.is_active === true, created_at: str(r.created_at),
});

function parseItem(r: Record<string, unknown>): GoalItem {
  const a = isObj(r.awards) ? r.awards : {};
  return {
    ...parseCore(r), sellers: num(r.sellers), reached: num(r.reached), to_deliver: num(r.to_deliver), revenue: num(r.revenue), top: num(r.top),
    awards: { pending: num(a.pending), paid: num(a.paid), cancelled: num(a.cancelled) },
  };
}

export function parseGoals(raw: unknown): GoalsData {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  return { items: raw.items.filter(isObj).map(parseItem), total: num(raw.total) || raw.items.length };
}

export type AwardStatus = "pending" | "paid" | "cancelled";
export interface AwardInfo { id: string; status: AwardStatus; paid_at: string | null; note: string | null; amount: number; registered_at: string }
export interface RankRow { seller_id: string; name: string; email: string | null; revenue: number; sales: number; reached: boolean; award: AwardInfo | null }
export interface HistoryItem { at: string; action: string; by: string | null; details: Record<string, unknown> }
export interface GoalDetail {
  goal: GoalCore; totals: { sellers: number; revenue: number; sales: number };
  ranking: { total: number; items: RankRow[] }; history: HistoryItem[];
}

const parseStatus = (v: unknown): AwardStatus => (v === "paid" || v === "cancelled" ? v : "pending");

function parseRank(r: Record<string, unknown>): RankRow {
  const a = isObj(r.award) ? r.award : null;
  return {
    seller_id: str(r.seller_id), name: str(r.name) || "Seller", email: strOrNull(r.email), revenue: num(r.revenue), sales: num(r.sales), reached: r.reached === true,
    award: a ? { id: str(a.id), status: parseStatus(a.status), paid_at: strOrNull(a.paid_at), note: strOrNull(a.note), amount: num(a.amount), registered_at: str(a.registered_at) } : null,
  };
}

export function parseGoalDetail(raw: unknown): GoalDetail {
  if (!isObj(raw) || !isObj(raw.goal)) throw new Error("Resposta inesperada do servidor.");
  const t = isObj(raw.totals) ? raw.totals : {};
  const rk = isObj(raw.ranking) ? raw.ranking : {};
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : []);
  const items = list(rk.items).map(parseRank);
  return {
    goal: parseCore(raw.goal), totals: { sellers: num(t.sellers), revenue: num(t.revenue), sales: num(t.sales) },
    ranking: { total: num(rk.total) || items.length, items },
    history: list(raw.history).map((h) => ({ at: str(h.at), action: str(h.action), by: strOrNull(h.by), details: isObj(h.details) ? h.details : {} })),
  };
}

/* ───────── dinheiro (as metas são em reais, com centavos) ───────── */

const f2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (reais: number): string => f2.format(Number.isFinite(reais) ? reais : 0);

/* ───────── situação ───────── */

export type GoalFilter = "all" | "live" | "scheduled" | "ended" | "hidden";

/** Oculta: os sellers não veem. No ar / Agendada / Encerrada, visível: a meta está marcada como ativa e cada uma está numa fase. */
export function goalTag(g: Pick<GoalCore, "is_active" | "starts_at" | "ends_at">, now = Date.now()): { label: string; tone: Tone } {
  if (!g.is_active) return { label: "Oculta", tone: "neutral" };
  const phase = phaseOf(g, now);
  if (phase === "running") return { label: "No ar", tone: "success" };
  if (phase === "upcoming") return { label: "Agendada", tone: "info" };
  return { label: "Encerrada, visível", tone: "warning" };
}

export function matchesFilter(g: GoalCore, f: GoalFilter, now = Date.now()): boolean {
  if (f === "all") return true;
  if (f === "hidden") return !g.is_active;
  if (f === "ended") return phaseOf(g, now) === "ended";
  const tag = goalTag(g, now).label;
  return f === "live" ? tag === "No ar" : tag === "Agendada";
}

export const isLive = (g: GoalCore, now = Date.now()) => g.is_active && phaseOf(g, now) === "running";

export interface GoalStats { live: number; reachedLive: number; toDeliver: number; delivered: number }
export function statsOf(items: GoalItem[], now = Date.now()): GoalStats {
  return items.reduce<GoalStats>((s, g) => ({
    live: s.live + (isLive(g, now) ? 1 : 0),
    reachedLive: s.reachedLive + (isLive(g, now) ? g.reached : 0),
    toDeliver: s.toDeliver + g.to_deliver,
    delivered: s.delivered + g.awards.paid,
  }), { live: 0, reachedLive: 0, toDeliver: 0, delivered: 0 });
}

export function heroStatus(data: GoalsData | undefined, failed: boolean, now = Date.now()): { tone: Tone; label: string; pulse?: boolean } {
  if (!data) return failed ? { tone: "destructive", label: "Não foi possível carregar" } : { tone: "neutral", label: "Carregando…" };
  if (data.items.length === 0) return { tone: "neutral", label: "Nenhuma meta criada" };
  const s = statsOf(data.items, now);
  if (s.toDeliver > 0) return { tone: "warning", label: `${plural(s.toDeliver, "prêmio", "prêmios")} a entregar` };
  if (s.live > 0) return { tone: "success", label: `${plural(s.live, "meta no ar", "metas no ar")}`, pulse: true };
  return { tone: "neutral", label: "Nenhuma meta no ar" };
}

/** Quanto da meta já foi batido, em % inteiro; nunca mostra 100% antes de bater. */
export function pctOf(revenue: number, target: number): number {
  if (!(target > 0)) return 0;
  const raw = (revenue / target) * 100;
  return revenue >= target ? 100 : Math.min(99, Math.max(0, Math.floor(raw)));
}

/* ───────── formulários e validação ───────── */

export interface GoalForm { title: string; description: string; target: string; starts: string; ends: string; reward_title: string; reward_description: string }
export type FormErrors<T> = Partial<Record<keyof T, string>>;

export function goalErrors(f: GoalForm): FormErrors<GoalForm> {
  const e: FormErrors<GoalForm> = {};
  const title = f.title.trim().replace(/\s+/g, " ");
  if (title.length < LIMITS.titleMin || title.length > LIMITS.title) e.title = `Dê um nome à meta, de ${LIMITS.titleMin} a ${LIMITS.title} caracteres.`;
  if (f.description.trim().length > LIMITS.description) e.description = `A descrição passa de ${LIMITS.description} caracteres.`;
  const target = parseBRL(f.target);
  if (!(target >= 0.01)) e.target = "Informe o valor da meta.";
  else if (target > LIMITS.maxTarget) e.target = "A meta pode ir até R$ 100.000.000.";
  const s = fromSpInput(f.starts);
  const en = fromSpInput(f.ends);
  if (!s) e.starts = "Informe o início.";
  if (!en) e.ends = "Informe o fim.";
  if (s && en) {
    const span = Date.parse(en) - Date.parse(s);
    if (span <= 0) e.ends = "O fim precisa ser depois do início.";
    else if (span > LIMITS.maxDays * 86_400_000) e.ends = `A meta pode durar no máximo ${LIMITS.maxDays} dias.`;
  }
  const reward = f.reward_title.trim().replace(/\s+/g, " ");
  if (reward.length < LIMITS.rewardTitleMin || reward.length > LIMITS.rewardTitle) e.reward_title = `Diga qual é o prêmio, de ${LIMITS.rewardTitleMin} a ${LIMITS.rewardTitle} caracteres.`;
  if (f.reward_description.trim().length > LIMITS.description) e.reward_description = `Os detalhes passam de ${LIMITS.description} caracteres.`;
  return e;
}

/** Mudar valor ou datas de uma meta que já começou muda quem bateu: o servidor pede a senha. */
export function goalNeedsPassword(goal: Pick<GoalCore, "starts_at" | "ends_at" | "target"> | null, f: Pick<GoalForm, "target" | "starts" | "ends">, now = Date.now()): boolean {
  if (!goal || Date.parse(goal.starts_at) > now) return false;
  return Math.round(parseBRL(f.target) * 100) !== Math.round(goal.target * 100) || toSpInput(goal.starts_at) !== f.starts || toSpInput(goal.ends_at) !== f.ends;
}

/* ───────── prêmios ───────── */

export interface AwardStep { to: AwardStatus; label: string; field: string; tone: "default" | "danger"; title: (name: string) => string; description: (reward: string) => string; placeholder: string; confirm: string }

/** O que dá para fazer com o prêmio de quem bateu a meta. Espelha `admin_set_goal_award`: entregue é definitivo, cancelado pode ser reaberto. */
export function awardSteps(status: AwardStatus | null): AwardStep[] {
  const pay: AwardStep = {
    to: "paid", label: "Marcar como entregue", field: "Como foi entregue", tone: "default", confirm: "Continuar",
    title: (n) => `Marcar o prêmio de ${n} como entregue?`,
    description: (r) => `Prêmio: ${r}. Registre como foi entregue (Pix, código de rastreio, quem entregou). Depois disso o registro não muda mais.`,
    placeholder: "Ex.: Pix enviado em 25/11",
  };
  const cancel: AwardStep = {
    to: "cancelled", label: "Não vai receber", field: "Motivo", tone: "danger", confirm: "Continuar",
    title: (n) => `Cancelar o prêmio de ${n}?`,
    description: (r) => `Prêmio: ${r}. Conte por que esta pessoa não vai receber. Dá para reabrir depois.`,
    placeholder: "Ex.: pediu para não receber",
  };
  const reopen: AwardStep = {
    to: "pending", label: "Reabrir", field: "Motivo", tone: "default", confirm: "Continuar",
    title: (n) => `Reabrir o prêmio de ${n}?`,
    description: (r) => `Prêmio: ${r}. Ele volta a ficar a entregar.`,
    placeholder: "Ex.: o seller voltou atrás",
  };
  if (status === "paid") return [];
  if (status === "cancelled") return [reopen];
  return [pay, cancel];
}

export function awardTag(row: Pick<RankRow, "reached" | "award">): { label: string; tone: Tone } | null {
  const a = row.award;
  if (a?.status === "paid") return { label: "Entregue", tone: "success" };
  if (a?.status === "cancelled") return { label: "Cancelado", tone: "neutral" };
  if (a?.status === "pending") return { label: "A entregar", tone: "warning" };
  if (row.reached) return { label: "A entregar", tone: "warning" };
  return null;
}

/* ───────── histórico ───────── */

const d = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join("\n") || null;

export function historyEntry(h: HistoryItem): { title: string; text: string | null } {
  const x = h.details;
  const win = (label: string, from: unknown, to: unknown) => (from && to ? `${label}: ${dateLabel(String(from))} para ${dateLabel(String(to))}` : "");
  const who = (verb: string) => join(d(x.seller_name) && `${d(x.seller_name)}, ${brl(typeof x.amount === "number" ? x.amount : 0)} na meta`, d(x.note) && `${verb}: ${d(x.note)}`);
  switch (h.action) {
    case "goal_create": return { title: "Meta criada", text: join(d(x.title) && `“${d(x.title)}”`, typeof x.target === "number" && `Meta de ${brl(x.target)}`, d(x.reward) && `Prêmio: ${d(x.reward)}`, "Nasceu oculta.") };
    case "goal_update": return { title: "Meta editada", text: join(
      d(x.title_from) && `Nome: “${d(x.title_from)}” para “${d(x.title)}”`,
      typeof x.target_from === "number" && typeof x.target_to === "number" && `Valor: ${brl(x.target_from)} para ${brl(x.target_to)}`,
      win("Início", x.starts_from, x.starts_to), win("Fim", x.ends_from, x.ends_to),
      d(x.reward_from) && `Prêmio: ${d(x.reward_from)} para ${d(x.reward_to)}`) ?? (d(x.title) ? `“${d(x.title)}”` : null) };
    case "goal_activate": return { title: "Colocada no ar", text: null };
    case "goal_deactivate": return { title: "Ocultada", text: null };
    case "goal_delete": return { title: "Meta apagada", text: join(d(x.title) && `“${d(x.title)}”`, d(x.reason) && `Motivo: ${d(x.reason)}`) };
    case "goal_award_paid": return { title: "Prêmio entregue", text: who("Entrega") };
    case "goal_award_cancelled": return { title: "Prêmio cancelado", text: who("Motivo") };
    case "goal_award_pending": return { title: "Prêmio reaberto", text: who("Motivo") };
    default: return { title: "Alteração na meta", text: null };
  }
}

/* ───────── texto para copiar ───────── */

/** Lista de quem bateu a meta, para colar numa planilha ou mensagem. */
export function reachedText(goal: GoalCore, rows: RankRow[]): string {
  const lines = [`${goal.title} (meta de ${brl(goal.target)}, prêmio: ${goal.reward_title})`];
  const hit = rows.filter((r) => r.reached);
  if (hit.length === 0) lines.push("Ninguém bateu a meta ainda.");
  for (const r of hit) {
    const st = r.award?.status === "paid" ? "entregue" : r.award?.status === "cancelled" ? "cancelado" : "a entregar";
    lines.push(`${r.name}${r.email ? ` <${r.email}>` : ""}, ${brl(r.revenue)}, ${st}`);
  }
  return lines.join("\n");
}
