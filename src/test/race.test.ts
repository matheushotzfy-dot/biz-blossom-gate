import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_LIMIT, chaseCell, countdownTarget, elapsedFraction, formatCents, formatCentsExact, formatCentsFloor, formatRaceDate, gapTo, isPlacePrize,
  prizeStatus, racePhase, spokenTime, timeParts, type Leader, type Prize,
} from "@/features/race/raceMeta";

const D = 86_400_000;
const NOW = Date.parse("2026-11-24T15:00:00Z");
const race = (from: number, to: number) => ({ starts_at: new Date(NOW + from * D).toISOString(), ends_at: new Date(NOW + to * D).toISOString() });

const L = (rank: number, name: string, cents: number, id: string | null = null): Leader => ({ seller_id: id, seller_name: name, seller_avatar: null, revenue_cents: cents, sales_count: 0, rank_position: rank });
const board: Leader[] = [L(1, "Bryan", 87_500_000), L(2, "Airis", 64_200_000), L(3, "Wdzin", 41_800_000), L(4, "Marina", 28_900_000), L(5, "Lucas", 19_700_000)];
const withMine = (rank: number, cents: number): { mine: Leader; leaders: Leader[] } => {
  const mine = L(rank, "Eu", cents, "me");
  const leaders = [...board.slice(0, rank - 1), mine, ...board.slice(rank - 1)].map((l, i) => ({ ...l, rank_position: i + 1 }));
  return { mine: leaders[rank - 1], leaders };
};
const sixthOf = () => withMine(6, 18_000_000).mine;
const place = (n: number): Prize => ({ id: `p${n}`, title: `Prêmio ${n}`, description: null, image_url: null, min_revenue_cents: 1, target_position: n, sort_order: n });
const goal = (cents: number): Prize => ({ id: "g", title: "Meta", description: null, image_url: null, min_revenue_cents: cents, target_position: null, sort_order: 9 });

describe("fase e relógio da temporada", () => {
  it("antes, durante e depois", () => {
    expect(racePhase(race(3, 33), NOW)).toBe("upcoming");
    expect(racePhase(race(-10, 20), NOW)).toBe("live");
    expect(racePhase(race(-40, -10), NOW)).toBe("ended");
  });
  it("no instante exato do fim já está encerrada, e no do começo já está ao vivo", () => {
    expect(racePhase({ starts_at: new Date(NOW - D).toISOString(), ends_at: new Date(NOW).toISOString() }, NOW)).toBe("ended");
    expect(racePhase({ starts_at: new Date(NOW).toISOString(), ends_at: new Date(NOW + D).toISOString() }, NOW)).toBe("live");
  });
  it("a contagem aponta para o começo, depois para o fim, e some ao acabar", () => {
    const up = race(3, 33), live = race(-10, 20), ended = race(-40, -10);
    expect(countdownTarget(up, NOW)).toBe(Date.parse(up.starts_at));
    expect(countdownTarget(live, NOW)).toBe(Date.parse(live.ends_at));
    expect(countdownTarget(ended, NOW)).toBeNull();
  });
  it("divide o tempo e nunca fica negativo", () => {
    expect(timeParts(3 * D + 4 * 3_600_000 + 5 * 60_000 + 6000)).toEqual({ d: 3, h: 4, m: 5, s: 6 });
    expect(timeParts(-5000)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });
  it("fração percorrida fica entre 0 e 1", () => {
    expect(elapsedFraction(race(3, 33), NOW)).toBe(0);
    expect(elapsedFraction(race(-40, -10), NOW)).toBe(1);
    expect(elapsedFraction(race(-10, 10), NOW)).toBeCloseTo(0.5, 5);
    expect(elapsedFraction({ starts_at: "x", ends_at: "y" }, NOW)).toBe(0);
  });
  it("fala o tempo restante para leitor de tela", () => {
    expect(spokenTime(5 * D + 3 * 3_600_000 + 12 * 60_000)).toBe("5 dias, 3 horas e 12 minutos");
    expect(spokenTime(D + 3_600_000)).toBe("1 dia e 1 hora");
    expect(spokenTime(30_000)).toBe("0 minutos");
  });
  it("datas no horário de Brasília", () => {
    expect(formatRaceDate("2026-08-13T18:21:52Z", "long")).toBe("13 de agosto de 2026");
    expect(formatRaceDate("2026-08-14T01:30:00Z", "long")).toBe("13 de agosto de 2026");
    expect(formatRaceDate("nope")).toBe("");
  });
});

describe("valores", () => {
  it("centavos viram reais; o de outros sem centavos, o seu com", () => {
    expect(formatCents(87_500_000)).toMatch(/875\.000/);
    expect(formatCents(87_500_000)).not.toMatch(/,/);
    expect(formatCentsExact(12_345_67)).toMatch(/12\.345,67/);
    expect(formatCentsFloor(26_799_960)).toMatch(/267\.999/); // 267.999,60 nunca vira 268.000
  });
  it("a diferença nunca é negativa e avisa quando é menor que a granularidade", () => {
    expect(gapTo(10_000_000, { revenue_cents: 12_000_000 })).toEqual({ cents: 2_000_000, tight: false });
    expect(gapTo(12_000_050, { revenue_cents: 12_000_000 })).toEqual({ cents: 0, tight: true });
  });
});

describe("status dos prêmios", () => {
  it("prêmio de colocação é da colocação exata: o 1º não leva os três", () => {
    const { mine, leaders } = withMine(1, 90_000_057);
    const ctx = { phase: "live" as const, mine, leaders, ownCents: null };
    expect(prizeStatus(place(1), ctx).label).toBe("Você está aqui");
    expect(prizeStatus(place(2), ctx).label).toBeNull();
    expect(prizeStatus(place(3), ctx).label).toBeNull();
  });
  it("enquanto corre nunca diz 'garantido'; ao acabar vira 'Conquistado'", () => {
    const { mine, leaders } = withMine(2, 70_000_057);
    expect(prizeStatus(place(2), { phase: "live", mine, leaders, ownCents: null }).label).toBe("Você está aqui");
    expect(prizeStatus(place(2), { phase: "ended", mine, leaders, ownCents: null }).label).toBe("Conquistado");
  });
  it("atrás do prêmio, diz o que falta (pelo menos) e quem está lá hoje", () => {
    const { mine, leaders } = withMine(5, 15_000_057);
    const s = prizeStatus(place(3), { phase: "live", mine, leaders, ownCents: null });
    expect(s.tone).toBe("wait");
    expect(s.hint).toMatch(/Faltam pelo menos R\$\s267\.999 para/);
    const other = prizeStatus(place(1), { phase: "live", mine: null, leaders: board, ownCents: null });
    expect(other.hint).toBe("Hoje: Bryan.");
    expect(prizeStatus(place(1), { phase: "ended", mine: null, leaders: board, ownCents: null }).hint).toBe("Ficou com Bryan.");
  });
  it("meta de faturamento: progresso, falta e bateu", () => {
    const { mine, leaders } = withMine(4, 25_000_000);
    const half = prizeStatus(goal(50_000_000), { phase: "live", mine, leaders, ownCents: null });
    expect(half.progress).toBe(50);
    expect(half.hint).toMatch(/Faltam .*250\.000,00/);
    expect(prizeStatus(goal(20_000_000), { phase: "live", mine, leaders, ownCents: null })).toMatchObject({ label: "Meta batida", tone: "ok", progress: 100 });
    expect(prizeStatus(goal(20_000_000), { phase: "ended", mine, leaders, ownCents: null }).label).toBe("Conquistado");
  });
  it("fora do ranking usa o faturamento exato buscado; sem ele não inventa nada", () => {
    expect(prizeStatus(goal(10_000_000), { phase: "live", mine: null, leaders: board, ownCents: 432_150 }).progress).toBeCloseTo(4.3215, 3);
    expect(prizeStatus(goal(10_000_000), { phase: "live", mine: null, leaders: board, ownCents: null })).toEqual({ tone: "idle", label: null, hint: null, progress: null });
  });
  it("reconhece prêmio de colocação", () => {
    expect(isPlacePrize(place(1))).toBe(true);
    expect(isPlacePrize(goal(1))).toBe(false);
    expect(isPlacePrize({ target_position: 0 })).toBe(false);
  });
});

describe("próximo passo", () => {
  const base = { ownCents: null as number | null, startsLabel: "27 nov 2026" };
  it("líder, atrás, sem posição e fases", () => {
    const first = withMine(1, 90_000_057);
    expect(chaseCell({ phase: "live", mine: first.mine, leaders: first.leaders, ...base })).toMatchObject({ label: "Vantagem sobre o 2º", featured: true });
    expect(chaseCell({ phase: "live", mine: first.mine, leaders: first.leaders, ...base }).value).toMatch(/^Até R\$\s25\.001/);
    const sixth = withMine(6, 18_000_000);
    const c = chaseCell({ phase: "live", mine: sixth.mine, leaders: sixth.leaders, ...base });
    expect(c.label).toBe("Para chegar ao 5º");
    expect(c.sub).toMatch(/pelo menos isso para passar Lucas/);
    expect(chaseCell({ phase: "live", mine: null, leaders: board, ...base }).value).toBe("Primeira venda");
    expect(chaseCell({ phase: "live", mine: null, leaders: board, ...base, ownCents: 100 }).value).toBe("Vender mais");
    expect(LEADERBOARD_LIMIT).toBe(100);
    expect(chaseCell({ phase: "upcoming", mine: null, leaders: [], ...base }).value).toBe("27 nov 2026");
    expect(chaseCell({ phase: "ended", mine: first.mine, leaders: first.leaders, ...base, wonPrizes: ["MacBook"] })).toMatchObject({ label: "Seu prêmio", value: "MacBook", featured: true });
    expect(chaseCell({ phase: "ended", mine: first.mine, leaders: first.leaders, ...base, wonPrizes: ["MacBook", "Kit"] }).sub).toBe("E mais 1 prêmio conquistado.");
    expect(chaseCell({ phase: "ended", mine: sixthOf(), leaders: board, ...base }).value).toBe("Sem prêmio");
    expect(chaseCell({ phase: "ended", mine: null, leaders: board, ...base }).sub).toMatch(/não apareceu/);
  });
  it("diferença menor que a granularidade vira 'Quase lá'", () => {
    const { mine, leaders } = withMine(3, 41_800_000 + 300);
    // mine em 3º com valor acima do 2º arredondado? força 4º abaixo do 3º com diferença mínima
    const fourth = withMine(4, 41_800_050);
    expect(chaseCell({ phase: "live", mine: fourth.mine, leaders: fourth.leaders, ...base }).value).toBe("Quase lá");
    expect(mine.rank_position).toBe(3);
    expect(leaders.length).toBe(6);
  });
});
