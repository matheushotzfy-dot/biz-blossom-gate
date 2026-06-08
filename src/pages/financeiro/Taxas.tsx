import { useFees } from "@/hooks/useQueryData";
import { Percent, Info, DollarSign, Zap, CreditCard, Banknote, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
import { PixLogoMark } from "@/components/icons/PixLogoMark";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Taxas() {
  const { data: fees = [] } = useFees();

  const getFee = (name: string, def: number) => {
    const f = fees.find((f) => f.name.toLowerCase().includes(name.toLowerCase()));
    return f ? f.value : def;
  };

  const pixRate = getFee("pix", 1.99);
  const cardRate = getFee("cartão", 4.99);
  const boletoRate = getFee("boleto", 3.49);
  const withdrawFee = getFee("saque", 5.0);

  const deadlines = [
    { label: "Pix", value: "Instantâneo", sub: "Disponível após aprovação", tone: "success" as const },
    { label: "Cartão (D+1)", value: "24 horas", sub: "Padrão da plataforma", tone: "info" as const },
    { label: "Boleto", value: "D+1", sub: "Após a compensação", tone: "warning" as const },
  ];

  const toneCls: Record<string, string> = {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Estrutura de custos transparente"
        title="Taxas e Tarifas"
        subtitle="Veja o custo aplicado a cada método de pagamento e o prazo de liberação dos recebíveis."
        status={{ tone: "info", label: "Plano vigente" }}
      />

      {/* KPI Grid — same standard as Adquirente */}
      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi
          label="Taxa Pix"
          value={`${pixRate}%`}
          sub="Receba na hora"
          icon={PixLogoMark as unknown as LucideIcon}
          tone="success"
        />
        <FinanceiroKpi
          label="Taxa Cartão"
          value={`${cardRate}%`}
          sub="Até 12x parcelado"
          icon={CreditCard}
          tone="info"
        />
        <FinanceiroKpi
          label="Taxa Boleto"
          value={`${boletoRate}%`}
          sub="Compensação 24h"
          icon={Banknote}
          tone="warning"
        />
        <FinanceiroKpi
          label="Tarifa de Saque"
          value={fmt(withdrawFee)}
          sub="Fixo por solicitação"
          icon={DollarSign}
          tone="primary"
        />
      </FinanceiroKpiGrid>

      {/* Prazos de liberação */}
      <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-2">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/50">
          <div className="h-7 w-7 rounded-md bg-warning/10 text-warning flex items-center justify-center">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">Prazos de liberação</h2>
            <p className="text-[11px] text-muted-foreground/70 font-medium">Quando seu saldo fica disponível para saque.</p>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {deadlines.map((p) => (
            <div key={p.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", toneCls[p.tone])}>
                  <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-display font-black text-foreground tracking-tight">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 font-medium truncate">{p.sub}</p>
                </div>
              </div>
              <span className="text-[13px] font-display font-black text-foreground tabular-nums tracking-tight shrink-0">
                {p.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Info footer */}
      <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-3">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="h-7 w-7 rounded-md bg-info/10 text-info flex items-center justify-center shrink-0">
            <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed font-medium">
            As taxas exibidas são baseadas no seu plano atual. Para volumes superiores a{" "}
            <span className="font-black text-foreground tabular-nums">R$ 100.000/mês</span>, fale com seu gerente de conta
            para uma proposta personalizada.
          </p>
        </div>
      </section>
    </div>
  );
}
