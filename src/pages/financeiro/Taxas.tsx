import { useFees } from "@/hooks/useQueryData";
import { Percent, Info, DollarSign, Calculator, Receipt, ShieldCheck, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";

export default function Taxas() {
  const { data: fees = [] } = useFees();
  const percentFees = fees.filter(f => f.fee_type === "percentage");
  const fixedFees = fees.filter(f => f.fee_type === "fixed");
  const avgPercent = percentFees.length > 0 ? (percentFees.reduce((a, f) => a + f.value, 0) / percentFees.length) : 0;
  const totalFixed = fixedFees.reduce((a, f) => a + f.value, 0);

  const exampleAmount = 1000;
  const examplePctCost = exampleAmount * (avgPercent / 100);
  const exampleNet = exampleAmount - examplePctCost - totalFixed;
  const effectiveRate = exampleAmount > 0 ? ((examplePctCost + totalFixed) / exampleAmount) * 100 : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Taxas e Tarifas</h1>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Estrutura completa e transparente
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi
          label="Taxa percentual média"
          value={`${avgPercent.toFixed(2)}%`}
          sub={`${percentFees.length} ${percentFees.length === 1 ? "taxa percentual" : "taxas percentuais"}`}
          icon={Percent}
          tone="info"
        />
        <FinanceiroKpi
          label="Tarifas fixas (total)"
          value={`R$ ${totalFixed.toFixed(2)}`}
          sub={`${fixedFees.length} ${fixedFees.length === 1 ? "tarifa fixa" : "tarifas fixas"}`}
          icon={DollarSign}
          tone="warning"
        />
        <FinanceiroKpi
          label="Custo efetivo"
          value={`${effectiveRate.toFixed(2)}%`}
          sub="Em uma venda de R$ 1.000"
          icon={TrendingDown}
          tone={effectiveRate > 10 ? "warning" : "success"}
        />
        <FinanceiroKpi
          label="Líquido estimado"
          value={`R$ ${exampleNet.toFixed(2)}`}
          sub="Sobre R$ 1.000 brutos"
          icon={Calculator}
          tone="success"
        />
      </FinanceiroKpiGrid>

      {/* Live simulation */}
      <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-2">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <h2 className="font-black text-foreground tracking-tight">
              Simulação ao vivo · venda de R$ 1.000,00
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-2 text-[12px] font-medium">
          <Row label="Valor bruto" value="R$ 1.000,00" />
          <Row label={`Taxa percentual (${avgPercent.toFixed(2)}%)`} value={`− R$ ${examplePctCost.toFixed(2)}`} negative />
          <Row label="Tarifas fixas" value={`− R$ ${totalFixed.toFixed(2)}`} negative />
          <div className="border-t border-border/50 my-2" />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-display font-black uppercase tracking-[0.14em] text-foreground">Líquido estimado</span>
            <span className="font-display font-black text-success tabular-nums text-[22px] tracking-tight">
              R$ {exampleNet.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {fees.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-secondary border border-border/50 flex items-center justify-center">
            <Percent className="h-7 w-7 text-muted-foreground/60" />
          </div>
          <p className="text-[14px] text-foreground font-display font-bold">Nenhuma taxa configurada</p>
          <p className="text-[12px] text-muted-foreground/70 font-medium">As taxas serão exibidas quando configuradas pelo administrador</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in stagger-3">
          <FeeSection
            title="Taxas Percentuais"
            description="Aplicadas sobre o valor bruto da transação"
            tone="info"
            icon={Percent}
            items={percentFees}
            footer={percentFees.length > 0 ? { label: "Média", value: `${avgPercent.toFixed(2)}%` } : undefined}
            renderValue={(fee) => (
              <>
                <span className="text-foreground">{fee.value}</span>
                <span className="text-[14px] text-info/70 font-bold ml-0.5">%</span>
              </>
            )}
            unit="por transação"
          />
          <FeeSection
            title="Tarifas Fixas"
            description="Cobradas por operação realizada"
            tone="warning"
            icon={DollarSign}
            items={fixedFees}
            footer={fixedFees.length > 0 ? { label: "Total combinado", value: `R$ ${totalFixed.toFixed(2)}` } : undefined}
            renderValue={(fee) => (
              <>
                <span className="text-[14px] text-warning/70 font-bold mr-0.5">R$</span>
                <span className="text-foreground">{Number(fee.value).toFixed(2)}</span>
              </>
            )}
            unit="por operação"
          />
        </div>
      )}

      {/* Formula */}
      <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-3">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/50">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Receipt className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="font-black text-foreground tracking-tight">Fórmula de cálculo</h2>
            <p className="text-[11px] text-muted-foreground/70 font-medium">Como o valor líquido é calculado em cada transação</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 font-mono text-[13px] text-foreground tabular-nums flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">líquido</span>
            <span className="text-muted-foreground/60">=</span>
            <span className="font-bold">bruto</span>
            <span className="text-destructive">−</span>
            <span className="font-bold">(bruto × %)</span>
            <span className="text-destructive">−</span>
            <span className="font-bold">tarifas fixas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40">
            {[
              { label: "Percentuais", desc: "Calculadas sobre o bruto", color: "info" },
              { label: "Fixas", desc: "Cobradas por operação", color: "warning" },
              { label: "Transparência", desc: "Exibidas antes da venda", color: "success" },
            ].map((item) => (
              <div key={item.label} className="bg-card px-4 py-3 flex items-center gap-2.5">
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  item.color === "info" && "bg-info",
                  item.color === "warning" && "bg-warning",
                  item.color === "success" && "bg-success",
                )} />
                <div className="min-w-0">
                  <p className="text-[12px] font-display font-black text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 font-medium truncate">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-info/5 border border-info/20">
            <Info className="h-3.5 w-3.5 text-info mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground/80 font-medium leading-relaxed">
              Os valores acima são informativos. A taxa exata aplicada pode variar conforme o método de pagamento e perfil de risco da operação.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground/80">{label}</span>
      <span className={cn("font-mono font-black tabular-nums", negative ? "text-destructive" : "text-foreground")}>{value}</span>
    </div>
  );
}

function FeeSection({
  title, description, tone, icon: Icon, items, footer, renderValue, unit,
}: {
  title: string; description: string; tone: "info" | "warning";
  icon: typeof Percent; items: any[];
  footer?: { label: string; value: string };
  renderValue: (fee: any) => React.ReactNode;
  unit: string;
}) {
  const toneBg = tone === "info" ? "bg-info/10 text-info" : "bg-warning/10 text-warning";
  const toneText = tone === "info" ? "text-info" : "text-warning";
  return (
    <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", toneBg)}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <div>
            <h3 className="font-black text-foreground tracking-tight">{title}</h3>
            <p className="text-[11px] text-muted-foreground/70 font-medium">{description}</p>
          </div>
        </div>
        <span className={cn("text-[10px] font-black uppercase tracking-[0.12em] tabular-nums px-2 py-0.5 rounded-md border", toneText, tone === "info" ? "border-info/20 bg-info/10" : "border-warning/20 bg-warning/10")}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-[12px] text-muted-foreground/70 font-medium">Nenhuma {tone === "info" ? "taxa percentual" : "tarifa fixa"} ativa</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {items.map((fee) => (
            <div key={fee.id} className="px-5 py-4 hover:bg-secondary/30 transition-colors duration-200">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="text-[13px] font-display font-black text-foreground tracking-tight">{fee.name}</h4>
                  {fee.description && (
                    <p className="text-[11px] text-muted-foreground/70 font-medium mt-0.5 line-clamp-2">{fee.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-black tabular-nums leading-none tracking-tight text-[22px]">
                    {renderValue(fee)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 font-medium mt-1">{unit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {footer && (
        <div className="px-5 py-3 border-t border-border/50 bg-secondary/30 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{footer.label}</span>
          <span className="font-mono font-black text-foreground tabular-nums text-[12px]">{footer.value}</span>
        </div>
      )}
    </section>
  );
}
