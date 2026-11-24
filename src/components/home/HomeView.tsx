import type { ReactNode } from "react";
import { HeroBalance, type HeroBalanceProps } from "./HeroBalance";
import { TodayPulse, type TodayPulseProps } from "./TodayPulse";
import { PendingTasks, type PendingTask } from "./PendingTasks";
import { RevenueChart, type RevenueChartProps } from "./RevenueChart";
import { Performance, type PerformanceProps } from "./Performance";
import { Statement, type StatementProps } from "./Statement";
import { SP_TZ, saoPauloHour } from "./time";

const greeting = (h: number) => (h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
const dateLine = (now = new Date()) => now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: SP_TZ });

export interface HomeViewProps {
  firstName: string;
  /** Aviso de erro de carregamento (acima de tudo). */
  alert?: ReactNode;
  /** Checklist de ativação, entre a saudação e o saldo. */
  banner?: ReactNode;
  hero: HeroBalanceProps;
  today: TodayPulseProps;
  tasks: PendingTask[];
  chart: RevenueChartProps;
  performance: PerformanceProps;
  statement: StatementProps;
}

/** Página Início do seller, só apresentação: recebe tudo pronto de `Dashboard`. */
export function HomeView(p: HomeViewProps) {
  const now = new Date();
  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      {p.alert}

      <header className="pt-1">
        <h1 className="font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.04em] text-foreground md:text-[36px]">
          {greeting(saoPauloHour(now))}, {p.firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground first-letter:uppercase">{dateLine(now)}</p>
      </header>

      {p.banner}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <HeroBalance {...p.hero} />
        <TodayPulse {...p.today} />
      </div>

      <PendingTasks items={p.tasks} />

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RevenueChart {...p.chart} />
        <Performance {...p.performance} />
      </div>

      <Statement {...p.statement} />
    </div>
  );
}
