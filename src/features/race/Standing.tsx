import { StatBand, type StatCell } from "@/components/seller-ui/StatBand";
import {
  chaseCell, formatCentsFloor, formatRaceDate, LEADERBOARD_LIMIT, maskedCents, type Leader, type Race, type RacePhase,
} from "./raceMeta";

/** "Sua posição": onde você está, quanto fez na temporada e o que falta para o próximo passo. */
export function Standing({ race, phase, mine, leaders, own, hidden, wonPrizes }: {
  race: Race; phase: RacePhase; mine: Leader | null; leaders: Leader[]; own: { cents: number; capped: boolean } | null; hidden: boolean; wonPrizes: string[];
}) {
  const ownCents = own ? own.cents : null;
  const n = leaders.length;
  const upcoming = phase === "upcoming";

  const position: StatCell = {
    label: phase === "ended" ? "Sua posição final" : "Sua posição",
    value: mine ? `${mine.rank_position}º` : "—",
    featured: !!mine && mine.rank_position <= 3,
    sub: upcoming
      ? "A temporada ainda não começou."
      : mine
        ? `Entre ${n >= LEADERBOARD_LIMIT ? `os ${LEADERBOARD_LIMIT} primeiros` : `${n} ${n === 1 ? "participante" : "participantes"}`}.`
        : own === null
          ? "Você ainda não aparece no ranking."
          : own.cents > 0
            ? `Você ainda está fora dos ${LEADERBOARD_LIMIT} primeiros.`
            : "Nenhuma venda aprovada na temporada.",
  };

  const revenueCents = mine ? mine.revenue_cents : ownCents;
  const revenue: StatCell = {
    label: "Seu faturamento na temporada",
    // No celular a faixa tem duas colunas: sem centavos, para o valor caber inteiro.
    value: revenueCents === null ? "—" : hidden ? "R$ ••••" : (<><span className="text-[21px] sm:hidden">{formatCentsFloor(revenueCents)}</span><span className="hidden sm:inline">{maskedCents(revenueCents, false, true)}</span></>),
    sub: upcoming
      ? "Conta a partir do início da temporada."
      : mine && mine.sales_count > 0
        ? `Valor líquido de ${mine.sales_count} ${mine.sales_count === 1 ? "venda aprovada" : "vendas aprovadas"}.`
        : own?.capped
          ? "Soma parcial: são muitas vendas para somar aqui."
          : "Valor líquido das vendas aprovadas.",
  };

  const chase = chaseCell({ phase, mine, leaders, ownCents, startsLabel: formatRaceDate(race.starts_at), wonPrizes });
  const third: StatCell = { label: chase.label, value: chase.value, sub: chase.sub, featured: chase.featured };

  return <StatBand label="Sua posição na corrida" cells={[position, revenue, third]} />;
}

