import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Radio } from "lucide-react";
import { Money } from "./Money";

export interface DayPulseProps { hourly: number[]; todayRevenue: number; todayOrders: number; lastSaleAt?: string | null; hidden: boolean }

function since(iso?: string | null): string {
  if (!iso) return "Nenhuma venda ainda";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Última venda agora";
  if (m < 60) return `Última venda há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Última venda há ${h} h`;
  return `Última venda há ${Math.floor(h / 24)} d`;
}

/** Pulso do dia: vendas por hora de hoje e tempo desde a última venda. */
export function DayPulse(p: DayPulseProps) {
  const now = new Date().getHours();
  const data = p.hourly.map((v, h) => ({ h, v: h <= now ? v : null }));
  const peak = p.hourly.reduce((best, v, h) => (v > p.hourly[best] ? h : best), 0);
  return (
    <section className="vp-panel flex flex-col p-5" aria-label="Pulso de hoje">
      <div className="flex items-center justify-between">
        <p className="vp-label">Pulso de hoje</p>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-primary"><Radio className="h-3.5 w-3.5" />Ao vivo</span>
      </div>
      <Money value={p.todayRevenue} hidden={p.hidden} className="mt-2 text-[24px] font-extrabold text-foreground" />
      <p className="text-[12px] text-muted-foreground">{p.todayOrders} pagos · {since(p.lastSaleAt)}</p>
      <div className="mt-3 h-[84px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="vpPulse" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#vpPulse)" connectNulls={false} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground"><span>0h</span><span>{p.hourly[peak] > 0 ? `Pico às ${peak}h` : "—"}</span><span>23h</span></div>
    </section>
  );
}
