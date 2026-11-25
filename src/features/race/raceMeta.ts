/**
 * Regras puras da Corrida de faturamento: em que fase está a temporada, quanto falta, o que cada
 * prêmio significa para o vendedor e quanto falta para a próxima posição. Fora dos componentes
 * para ser testado sem tela.
 *
 * Unidades: tudo que vem do ranking e dos prêmios está em CENTAVOS (`revenue_cents`, `min_revenue_cents`).
 * Os valores dos outros participantes chegam arredondados para baixo, em milhares de reais; só o seu
 * valor (e a sua quantidade de vendas) chega exato.
 */

export interface Race {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  banner_url: string | null;
  logo_url: string | null;
}

export interface Prize {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  min_revenue_cents: number;
  target_position: number | null;
  sort_order: number;
}

export interface Leader {
  seller_id: string | null;
  seller_name: string;
  seller_avatar: string | null;
  revenue_cents: number;
  sales_count: number;
  rank_position: number;
}

export type RacePhase = "upcoming" | "live" | "ended";

/** O ranking devolve no máximo as 100 primeiras posições. */
export const LEADERBOARD_LIMIT = 100;
/** Os valores dos outros participantes são arredondados para baixo nesta granularidade (R$ 1.000, em centavos). */
export const OTHERS_ROUNDING_CENTS = 100_000;

const ts = (iso: string) => {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : NaN;
};

export function racePhase(race: Pick<Race, "starts_at" | "ends_at">, now: number): RacePhase {
  const start = ts(race.starts_at);
  const end = ts(race.ends_at);
  if (Number.isFinite(start) && now < start) return "upcoming";
  if (Number.isFinite(end) && now >= end) return "ended";
  return "live";
}

export interface TimeParts { d: number; h: number; m: number; s: number }

export function timeParts(ms: number): TimeParts {
  const diff = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(diff / 86_400), h: Math.floor((diff % 86_400) / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
}

/** Alvo da contagem: o começo enquanto não começou, o fim enquanto corre; nada depois de acabar. */
export function countdownTarget(race: Pick<Race, "starts_at" | "ends_at">, now: number): number | null {
  const phase = racePhase(race, now);
  if (phase === "upcoming") return ts(race.starts_at);
  if (phase === "live") return ts(race.ends_at);
  return null;
}

/** Fração do tempo da temporada já percorrida, de 0 a 1. */
export function elapsedFraction(race: Pick<Race, "starts_at" | "ends_at">, now: number): number {
  const start = ts(race.starts_at);
  const end = ts(race.ends_at);
  const total = end - start;
  if (!Number.isFinite(total) || total <= 0) return racePhase(race, now) === "ended" ? 1 : 0;
  return Math.min(Math.max((now - start) / total, 0), 1);
}

export const centsToReais = (cents: number) => (Number.isFinite(cents) ? cents / 100 : 0);

const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Valor de outro participante (já arredondado): sem centavos. */
export const formatCents = (cents: number) => brl0.format(centsToReais(cents));
/** "Pelo menos": nunca arredonda para cima, para não prometer mais do que falta. */
export const formatCentsFloor = (cents: number) => brl0.format(Math.floor(centsToReais(cents)));
/** O seu valor: com centavos. */
export const formatCentsExact = (cents: number) => brl2.format(centsToReais(cents));
export const maskedCents = (cents: number, hidden: boolean, exact = false) => (hidden ? "R$ ••••" : exact ? formatCentsExact(cents) : formatCents(cents));

export const ordinal = (n: number) => `${n}º`;

/** Fecha a frase sem duplicar o ponto de nomes abreviados ("Davi R."). */
export const stop = (text: string) => (text.endsWith(".") ? text : `${text}.`);

export const isPlacePrize = (p: Pick<Prize, "target_position">) => typeof p.target_position === "number" && p.target_position > 0;

export const findMine = (leaders: Leader[], userId: string | null | undefined): Leader | null =>
  (userId ? leaders.find((l) => l.seller_id === userId) : null) ?? null;

const holderOf = (leaders: Leader[], position: number) => leaders.find((l) => l.rank_position === position) ?? null;

/**
 * Quanto falta para alcançar quem está numa posição. O valor do outro vem arredondado para baixo,
 * então o que falta é "pelo menos" isso; `tight` avisa quando a diferença é menor que a granularidade.
 */
export function gapTo(mineCents: number, other: Pick<Leader, "revenue_cents">): { cents: number; tight: boolean } {
  const diff = other.revenue_cents - mineCents;
  if (diff > 0) return { cents: diff, tight: false };
  return { cents: 0, tight: true };
}

export type PrizeTone = "ok" | "wait" | "idle";

export interface PrizeStatus {
  tone: PrizeTone;
  /** Selo do cartão (vazio quando não há o que dizer). */
  label: string | null;
  /** Linha de apoio: quem está lá hoje, ou quanto falta. */
  hint: string | null;
  /** Para metas de faturamento: de 0 a 100. */
  progress: number | null;
}

export interface PrizeContext {
  phase: RacePhase;
  mine: Leader | null;
  leaders: Leader[];
  /** Faturamento exato na temporada quando o vendedor está fora do ranking; `null` se desconhecido. */
  ownCents: number | null;
}

/**
 * O que cada prêmio significa para quem está olhando.
 * Prêmio com `target_position` é daquela colocação exata (1º, 2º, 3º): quem está em 1º leva o do 1º,
 * não os três. Sem `target_position`, é uma meta de faturamento: bateu, levou.
 * Enquanto a temporada corre nada é "garantido": a posição ainda pode mudar.
 */
export function prizeStatus(prize: Prize, ctx: PrizeContext): PrizeStatus {
  const { phase, mine, leaders } = ctx;
  const live = phase === "live";
  const ended = phase === "ended";

  if (isPlacePrize(prize)) {
    const pos = prize.target_position as number;
    const holder = holderOf(leaders, pos);
    const isMine = !!mine && mine.rank_position === pos;
    if (isMine) {
      return { tone: "ok", label: ended ? "Conquistado" : "Você está aqui", hint: ended ? null : "Mantenha a posição até o fim da temporada.", progress: null };
    }
    if (mine && mine.rank_position > pos && live && holder) {
      const g = gapTo(mine.revenue_cents, holder);
      return {
        tone: "wait",
        label: null,
        hint: g.tight ? `Está por menos de ${formatCents(OTHERS_ROUNDING_CENTS)} de diferença.` : `Faltam pelo menos ${formatCentsFloor(g.cents)} para chegar lá.`,
        progress: null,
      };
    }
    if (holder && (live || ended)) {
      return { tone: "idle", label: null, hint: stop(ended ? `Ficou com ${holder.seller_name}` : `Hoje: ${holder.seller_name}`), progress: null };
    }
    return { tone: "idle", label: null, hint: null, progress: null };
  }

  // Meta de faturamento
  const goal = prize.min_revenue_cents;
  const have = mine ? mine.revenue_cents : ctx.ownCents;
  if (have === null || have === undefined || goal <= 0) return { tone: "idle", label: null, hint: null, progress: null };
  if (have >= goal) return { tone: "ok", label: ended ? "Conquistado" : "Meta batida", hint: null, progress: 100 };
  const pct = Math.min(Math.max((have / goal) * 100, 0), 100);
  return {
    tone: live ? "wait" : "idle",
    label: null,
    hint: live ? `Faltam ${formatCentsExact(goal - have)} para a meta.` : null,
    progress: pct,
  };
}

export interface Standing {
  label: string;
  value: string;
  sub: string;
  featured?: boolean;
}

/** A terceira célula da faixa "Sua posição": o próximo passo conforme a fase e onde o vendedor está. */
export function chaseCell(args: { phase: RacePhase; mine: Leader | null; leaders: Leader[]; ownCents: number | null; startsLabel: string; wonPrizes?: string[] }): Standing {
  const { phase, mine, leaders, ownCents, startsLabel, wonPrizes = [] } = args;
  if (phase === "upcoming") return { label: "Começa em", value: startsLabel, sub: "As vendas aprovadas passam a contar a partir daí." };
  if (phase === "ended") {
    if (wonPrizes.length > 0) {
      const more = wonPrizes.length - 1;
      return { label: "Seu prêmio", value: wonPrizes[0], featured: true, sub: more > 0 ? `E mais ${more} ${more === 1 ? "prêmio conquistado" : "prêmios conquistados"}.` : "Conquistado nesta temporada." };
    }
    return mine
      ? { label: "Seu prêmio", value: "Sem prêmio", sub: "Esta temporada premiou outras posições e metas." }
      : { label: "Seu prêmio", value: "Sem prêmio", sub: "Você não apareceu no ranking desta temporada." };
  }
  if (!mine) {
    return ownCents && ownCents > 0
      ? { label: "Para entrar no ranking", value: "Vender mais", sub: "Cada venda aprovada soma no seu faturamento da temporada." }
      : { label: "Para entrar no ranking", value: "Primeira venda", sub: "Entra no ranking assim que uma venda for aprovada." };
  }
  if (mine.rank_position === 1) {
    const second = holderOf(leaders, 2);
    if (!second) return { label: "Você lidera", value: "Sozinho", featured: true, sub: "Ninguém mais apareceu no ranking ainda." };
    // O 2º vem arredondado para baixo: a vantagem real é de no máximo isso.
    const edge = Math.max(0, mine.revenue_cents - second.revenue_cents);
    return { label: "Vantagem sobre o 2º", value: `Até ${formatCents(edge)}`, featured: true, sub: stop(`Sobre ${second.seller_name}, que tem cerca de ${formatCents(second.revenue_cents)}`) };
  }
  const above = holderOf(leaders, mine.rank_position - 1);
  if (!above) return { label: "Para subir", value: "Continue vendendo", sub: "Cada venda aprovada conta para o ranking." };
  const g = gapTo(mine.revenue_cents, above);
  return g.tight
    ? { label: `Para chegar ao ${ordinal(above.rank_position)}`, value: "Quase lá", sub: stop(`A diferença para ${above.seller_name} é menor que ${formatCents(OTHERS_ROUNDING_CENTS)}`) }
    : { label: `Para chegar ao ${ordinal(above.rank_position)}`, value: formatCentsFloor(g.cents), sub: stop(`Faltam pelo menos isso para passar ${above.seller_name}`) };
}

export const RACE_STATUSES = ["completed", "approved", "paid"] as const;

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Datas sempre no horário de Brasília, como o resto do painel. */
export function formatRaceDate(iso: string, style: "short" | "long" | "time" = "short"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const f = style === "time" ? dateTimeFmt : style === "long" ? dayFmt : dateFmt;
  return f.format(d).replace(/\./g, "");
}

/** Texto para leitor de tela: "5 dias, 3 horas e 12 minutos". */
export function spokenTime(ms: number): string {
  const t = timeParts(ms);
  const parts: string[] = [];
  if (t.d) parts.push(`${t.d} ${t.d === 1 ? "dia" : "dias"}`);
  if (t.h) parts.push(`${t.h} ${t.h === 1 ? "hora" : "horas"}`);
  if (t.m || parts.length === 0) parts.push(`${t.m} ${t.m === 1 ? "minuto" : "minutos"}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0];
}
