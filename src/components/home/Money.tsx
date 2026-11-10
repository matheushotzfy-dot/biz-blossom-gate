import { cn } from "@/lib/utils";

export interface MoneyProps { value: number; hidden?: boolean; className?: string; centsClassName?: string; signed?: boolean }

/** Valor em reais com centavos menores — tipografia de extrato bancário. */
export function Money({ value, hidden, className, centsClassName, signed }: MoneyProps) {
  if (hidden) return <span className={cn("vp-num", className)}>R$ ••••</span>;
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const [int, cents] = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(",");
  const sign = safe < 0 ? "− " : signed && safe > 0 ? "+ " : "";
  return (
    <span className={cn("vp-num whitespace-nowrap", className)}>
      {sign}<span className="mr-[0.15em] text-[0.62em] font-semibold opacity-80">R$</span>{int}
      <span className={cn("text-[0.6em] font-semibold opacity-80", centsClassName)}>,{cents}</span>
    </span>
  );
}
