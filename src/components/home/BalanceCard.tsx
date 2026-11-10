import { ArrowDownToLine, Eye, EyeOff, Hourglass, ShieldAlert } from "lucide-react";
import { Money } from "./Money";

export interface BalanceCardProps {
  greeting: string;
  available: number;
  pending: number;
  disputed: number;
  receivedToday: number;
  hidden: boolean;
  onTogglePrivacy: () => void;
  onWithdraw: () => void;
  periodSlot: React.ReactNode;
}

/** Cartão de saldo protagonista: disponível + linha de liberação (a liberar / em análise). */
export function BalanceCard(p: BalanceCardProps) {
  const total = Math.max(p.available, 0) + p.pending + p.disputed;
  const pct = (v: number) => (total > 0 ? Math.max(2, (v / total) * 100) : 0);

  return (
    <section className="vp-balance p-5 sm:p-7" aria-label="Saldo da conta">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13.5px] font-medium opacity-85">{p.greeting}</p>
          {p.periodSlot}
        </div>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-75">Saldo disponível</span>
              <button onClick={p.onTogglePrivacy} aria-label={p.hidden ? "Mostrar valores" : "Ocultar valores"} className="grid h-7 w-7 place-items-center rounded-full vp-balance-chip">
                {p.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Money value={Math.max(p.available, 0)} hidden={p.hidden} className="mt-1 block text-[40px] font-extrabold leading-none sm:text-[52px]" />
            <p className="mt-2 text-[12.5px] opacity-80">
              Recebido hoje <Money value={p.receivedToday} hidden={p.hidden} className="font-bold" />
            </p>
          </div>

          <button onClick={p.onWithdraw} className="vp-balance-cta inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[14px] font-bold transition-transform hover:-translate-y-0.5 active:scale-[0.98]">
            <ArrowDownToLine className="h-4 w-4" /> Sacar
          </button>
        </div>

        {/* Linha de liberação */}
        <div className="mt-7">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[hsl(0_0%_100%/0.15)]" aria-hidden>
            <span className="h-full bg-[hsl(0_0%_100%)]" style={{ width: `${pct(Math.max(p.available, 0))}%` }} />
            <span className="h-full bg-[hsl(0_0%_100%/0.5)]" style={{ width: `${pct(p.pending)}%` }} />
            <span className="h-full bg-warning" style={{ width: `${p.disputed > 0 ? pct(p.disputed) : 0}%` }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
            <Legend dot="bg-[hsl(0_0%_100%)]" label="Disponível" value={<Money value={Math.max(p.available, 0)} hidden={p.hidden} className="font-bold" />} />
            <Legend dot="bg-[hsl(0_0%_100%/0.5)]" icon={<Hourglass className="h-3 w-3" />} label="A liberar" value={<Money value={p.pending} hidden={p.hidden} className="font-bold" />} />
            <Legend dot="bg-warning" icon={<ShieldAlert className="h-3 w-3" />} label="Em análise" value={<Money value={p.disputed} hidden={p.hidden} className="font-bold" />} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Legend({ dot, label, value, icon }: { dot: string; label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 opacity-80"><span className={`h-2 w-2 rounded-full ${dot}`} />{icon}{label}</dt>
      <dd className="mt-0.5 truncate text-[14px]">{value}</dd>
    </div>
  );
}
