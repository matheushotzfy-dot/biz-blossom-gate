import { ArrowDownToLine, Blocks, Eye, EyeOff, QrCode, Share2, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "./Money";

export interface HeroBalanceProps {
  available: number;
  pending: number;
  disputed: number;
  trend?: number;
  hidden: boolean;
  onTogglePrivacy: () => void;
  onPix: () => void;
  onWithdraw: () => void;
  onCharge: () => void;
  onMore: () => void;
}

/**
 * Cartão de saldo — o elemento de marca do painel: verde do cadastro com guilloché
 * (linhas finas concêntricas, como em nota bancária) e o "V" em check de marca d'água.
 */
export function HeroBalance(p: HeroBalanceProps) {
  const up = (p.trend ?? 0) >= 0;
  const stats: Array<{ label: string; value: number }> = [{ label: "A liberar", value: p.pending }];
  if (p.disputed > 0) stats.push({ label: "Em análise", value: p.disputed });

  return (
    <section className="vp-bal flex flex-col p-6 sm:p-8" aria-label="Saldo">
      <span aria-hidden className="vp-bal-ring" />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-white/85">Saldo disponível</p>
        <button onClick={p.onTogglePrivacy} aria-label={p.hidden ? "Mostrar valores" : "Ocultar valores"} aria-pressed={p.hidden} className="vp-bal-eye">
          {p.hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <Money
        value={Math.max(p.available, 0)}
        hidden={p.hidden}
        className="mt-3 block text-[46px] font-extrabold leading-none tracking-[-0.045em] sm:text-[64px]"
        centsClassName="opacity-70"
      />

      <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        {p.trend !== undefined && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-bold">
            {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {up ? "+" : "−"}{Math.abs(p.trend)}% no período
          </span>
        )}
        <div className="flex items-center">
          {stats.map((s, i) => (
            <div key={s.label} className={cn("pr-6", i > 0 && "border-l border-white/25 pl-6", i === 0 && p.trend !== undefined && "sm:border-l sm:border-white/25 sm:pl-6")}>
              <p className="text-[12.5px] text-white/75">{s.label}</p>
              <Money value={s.value} hidden={p.hidden} className="text-[17px] font-bold" centsClassName="opacity-75" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2.5 pt-8">
        <button onClick={p.onPix} className="vp-bal-btn vp-bal-btn-main"><QrCode className="h-[18px] w-[18px]" strokeWidth={2.2} />Cobrar via Pix</button>
        <button onClick={p.onWithdraw} className="vp-bal-btn vp-bal-btn-ghost"><ArrowDownToLine className="h-[18px] w-[18px]" strokeWidth={2.2} />Sacar</button>
        <button onClick={p.onCharge} className="vp-bal-btn vp-bal-btn-ghost"><Share2 className="h-[18px] w-[18px]" strokeWidth={2.2} />Enviar link</button>
        <div className="hidden sm:block">
          <button onClick={p.onMore} className="vp-bal-btn vp-bal-btn-ghost"><Blocks className="h-[18px] w-[18px]" strokeWidth={2.2} />Integrações</button>
        </div>
      </div>
    </section>
  );
}
